"""Reconstruct every PSI-159 INTNS frame on a fixed, shared camera grid.

Dependencies: numpy, Pillow. No scipy, downloaded models or hidden temporary
scripts are needed. See scripts/psi159/README.md for assumptions and units.
"""
from __future__ import annotations

import os
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("OMP_NUM_THREADS", "1")

import argparse
import csv
import gzip
import hashlib
import io
import json
import math
import re
import shutil
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path

import numpy as np
from PIL import Image

APP = Path(__file__).resolve().parents[1]
CONFIG = APP / "scripts/psi159/calibration.json"
CHANNELS = ["PTA1", "PTA2", "PTA3", "TCBurner", "TCA", "TCB", "MFCA3FuelFlow", "IonCurrent"]


def timestamp(name: str) -> datetime:
    match = re.search(r"(\d{8}_\d{6}\.\d{3})", name)
    if not match:
        raise ValueError(f"Missing camera timestamp: {name}")
    return datetime.strptime(match[1], "%Y%m%d_%H%M%S.%f")


def abel_matrix(n: int) -> np.ndarray:
    # Path lengths in local volume coordinates: radius 0..0.5.
    edges = np.linspace(0, 0.5, n + 1)
    impact = (edges[:-1] + edges[1:]) * 0.5
    return 2 * (np.sqrt(np.maximum(edges[None, 1:] ** 2 - impact[:, None] ** 2, 0))
                - np.sqrt(np.maximum(edges[None, :-1] ** 2 - impact[:, None] ** 2, 0)))


def smooth_gradient(field: np.ndarray, radial: float, axial: float) -> np.ndarray:
    grad = np.zeros_like(field)
    dr = field[:, 1:] - field[:, :-1]
    grad[:, 1:] += radial * dr
    grad[:, :-1] -= radial * dr
    dz = field[1:] - field[:-1]
    grad[1:] += axial * dz
    grad[:-1] -= axial * dz
    return grad


class Reconstructor:
    def __init__(self, config: dict, test: dict):
        self.z, self.r = config["z"], config["r"]
        self.cx, self.cy = test["centerPixels"]
        radius = config["domainRadiusPixels"]
        self.box = (self.cx - radius, self.cy - radius, self.cx + radius, self.cy + radius)
        self.a = abel_matrix(self.r)
        diff = np.diff(np.eye(self.r), axis=0)
        self.inverse = np.linalg.solve(self.a.T @ self.a + 0.001 * diff.T @ diff + 1e-7 * np.eye(self.r), self.a.T)
        self.lipschitz = float(np.linalg.norm(self.a, 2) ** 2 + 0.05)
        # Pixel centres, not edge coordinates, throughout the forward model.
        y = (np.arange(self.z) + 0.5) / self.z - 0.5
        x = ((np.arange(self.r * 2) + 0.5) / (self.r * 2) - 0.5)
        self.distance = np.hypot(y[:, None], x[None, :])
        self.radial_bin = np.minimum(self.r - 1, (self.distance * 2 * self.r).astype(int))
        self.outside = self.distance >= 0.5
        self.field_distance = np.hypot(y[:, None], ((np.arange(self.r) + 0.5) / self.r * 0.5)[None, :])
        self.count_scale = config["displayCounts"]
        self.noise_floor = 0.0005

    def resize(self, a: np.ndarray) -> np.ndarray:
        return np.asarray(Image.fromarray(a.astype(np.float32)).crop(self.box)
                          .resize((self.r * 2, self.z), Image.Resampling.BILINEAR), dtype=np.float64)

    def reconstruct(self, raw: np.ndarray, background: np.ndarray, valid: np.ndarray,
                    iterations: int = 32) -> tuple[np.ndarray, dict]:
        signal = self.resize(raw.astype(np.float32) - background) / self.count_scale
        weights = np.clip(self.resize(valid), 0, 1)
        saturation = self.resize((raw >= 65000).astype(np.float32)) > 0.01
        # Saturated samples carry lower bounds, never quantitative equality.
        weights[saturation] = 0
        left, right = signal[:, :self.r][:, ::-1], signal[:, self.r:]
        wl, wr = weights[:, :self.r][:, ::-1], weights[:, self.r:]
        w = wl + wr
        projection = np.divide(left * wl + right * wr, w, out=np.zeros_like(left), where=w > 0)
        w = np.minimum(1, w)

        # Spherical prior is used primarily where the camera has no observation.
        good = (weights > 0.95) & ~self.outside
        counts = np.bincount(self.radial_bin[good], minlength=self.r)
        sums = np.bincount(self.radial_bin[good], weights=signal[good], minlength=self.r)
        radial_projection = np.divide(sums, counts, out=np.zeros(self.r), where=counts > 0)
        observed = np.flatnonzero(counts)
        if len(observed):
            radial_projection = np.interp(np.arange(self.r), observed, radial_projection[observed])
        radial_emission = np.maximum(0, self.inverse @ radial_projection)
        centres = (np.arange(self.r) + 0.5) / self.r * 0.5
        prior = np.interp(self.field_distance, centres, radial_emission, right=0)
        prior_weight = 0.00003 + 0.004 * (1 - w)
        field = prior.copy()
        momentum = field.copy()
        acceleration = 1.0
        for _ in range(iterations):
            residual = (momentum @ self.a.T - projection) * w
            grad = residual @ self.a + smooth_gradient(momentum, 0.0003, 0.002)
            grad += prior_weight * (momentum - prior)
            new = np.maximum(0, momentum - grad / self.lipschitz)
            next_acceleration = (1 + math.sqrt(1 + 4 * acceleration ** 2)) / 2
            momentum = new + (acceleration - 1) / next_acceleration * (new - field)
            field, acceleration = new, next_acceleration
        # Sensor noise before/after burning should not become a luminous sphere.
        mean_signal = float(np.sum(signal * weights) / max(float(weights.sum()), 1))
        if mean_signal < self.noise_floor:
            field.fill(0)
        predicted = field @ self.a.T
        observed_energy = float(np.sum(projection ** 2 * w))
        nrmse = math.sqrt(float(np.sum((predicted - projection) ** 2 * w)) / max(observed_energy, 1e-12))
        prior_used = False
        if nrmse > 0.1 and mean_signal >= self.noise_floor:
            # Non-axisymmetric occlusion/igniter transients cannot be explained
            # by an Abel volume. Avoid revolving their residual into disks.
            # Fit only a scalar amplitude to the spherical prior; retain the
            # actual measured scale and mark the frame as inferred/limited.
            projected_prior = prior @ self.a.T
            gain = max(0, float(np.sum(projected_prior * projection * w)) /
                       max(float(np.sum(projected_prior ** 2 * w)), 1e-12))
            field = (prior * gain).astype(np.float32)
            predicted = field @ self.a.T
            nrmse = math.sqrt(float(np.sum((predicted - projection) ** 2 * w)) / max(observed_energy, 1e-12))
            prior_used = True
        peak = int(np.argmax(np.maximum(radial_projection, 0)))
        return field.astype(np.float32), {
            "projectionNrmse": round(nrmse, 5) if observed_energy > 1e-6 else None,
            "inferredFromPrior": prior_used,
            "meanSignal": round(mean_signal, 7),
            "observedFraction": round(float(np.mean(weights > 0.95)), 4),
            "saturatedFraction": round(float(saturation.mean()), 5),
            "radiusPixels": round(float(centres[peak] * 2 * (self.box[2] - self.cx)), 2),
            "projectionIntegral": round(float(np.sum(np.maximum(projection, 0) * w)), 6),
            "emissionIntegral": round(float(np.sum(field * centres[None, :])), 6),
        }


def summarize_validation(metrics: list[dict]) -> dict:
    usable = [m["projectionNrmse"] for m in metrics if m["projectionNrmse"] is not None
              and m["saturatedFraction"] < 0.01 and m["meanSignal"] > 0.002
              and m["emissionIntegral"] > 0 and not m.get("inferredFromPrior", False)]
    return {"medianProjectionNrmse": float(np.median(usable)) if usable else None,
            "framesCompared": len(usable), "maskedValuesAreInferred": True,
            "inferredFrameCount": sum(bool(m.get("inferredFromPrior")) for m in metrics),
            "saturatedFrameCount": sum(m["saturatedFraction"] >= 0.01 for m in metrics)}


def detect_flow_interval(times: list[float], flow_values: list[float | None]) -> dict:
    flow = np.array([v if v is not None else 0 for v in flow_values])
    # Detect sustained raw MFC on/off levels, not individual noisy samples.
    smoothed = np.convolve(flow, np.ones(31) / 31, mode="same")
    threshold = float(np.quantile(smoothed, 0.1) + 0.25 * (np.quantile(smoothed, 0.9) - np.quantile(smoothed, 0.1)))
    active = smoothed > threshold
    boundaries = np.diff(np.r_[False, active, False].astype(int))
    starts = np.flatnonzero(boundaries == 1)
    ends = np.flatnonzero(boundaries == -1) - 1
    runs = [(a, b) for a, b in zip(starts, ends) if times[b] - times[a] >= 1.0]
    if not runs:
        return {}
    start, end = max(runs, key=lambda pair: times[pair[1]] - times[pair[0]])
    return {"flowOnMs": round(times[start] * 1000), "flowOffMs": round(times[end] * 1000),
            "flowTimingSource": "longest sustained raw MFCA3FuelFlow plateau (transients excluded), aligned by wall clock"}


def sensor_export(test_id: str, camera_origin: datetime, dest: Path) -> dict:
    path = APP.parent / f"data/psi-159-drive/{test_id}_data.csv"
    with path.open(newline="") as f:
        next(f)
        rows = list(csv.DictReader(f))
    times, values = [], {name: [] for name in CHANNELS}
    for row in rows:
        hh, mm, ss, ms = map(int, row["Time"].strip().split(":"))
        dt = camera_origin.replace(hour=hh, minute=mm, second=ss, microsecond=ms * 1000)
        times.append((dt - camera_origin).total_seconds())
        for name in CHANNELS:
            try:
                value = float(row[name])
                values[name].append(value if math.isfinite(value) else None)
            except (KeyError, ValueError):
                values[name].append(None)
    # Fixed ~10 Hz, adequate for the chart; absolute alignment is preserved.
    keep, last = [], -math.inf
    for i, t in enumerate(times):
        if t - last >= 0.1 or i == len(times) - 1:
            keep.append(i)
            last = t
    series = []
    for name, data in values.items():
        v = [round(data[i], 6) if data[i] is not None else None for i in keep]
        finite = [x for x in v if x is not None]
        if finite:
            series.append({"name": name, "min": min(finite), "max": max(finite), "v": v})
    (dest / "sensors.json").write_text(json.dumps({
        "testpoint": test_id, "timeOrigin": camera_origin.isoformat(),
        "timeBasis": "seconds from first INTNS exposure, aligned by acquisition wall clock",
        "t": [round(times[i], 3) for i in keep], "series": series,
        "note": "Raw instrument signals; calibration not applied. Negative times precede the first camera exposure.",
    }, separators=(",", ":")))
    return detect_flow_interval(times, values["MFCA3FuelFlow"])


def build(test_id: str, archive_dir: Path, output: Path, config: dict, limit: int | None) -> None:
    test = config["tests"][test_id]
    archive = archive_dir / f"PSI-159_Raw Data_{test_id}_INTNS_ALL.zip"
    if not archive.exists():
        raise FileNotFoundError(archive)
    output.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=f".{test_id}-", dir=output))
    try:
        (staging / "preview").mkdir()
        with zipfile.ZipFile(archive) as zf:
            names = sorted(n for n in zf.namelist() if n.endswith(".tiff"))
            origin, end = timestamp(names[0]), timestamp(names[-1])
            all_names = names
            if limit:
                names = [names[i] for i in np.linspace(0, len(names) - 1, limit).astype(int)]

            def load(name):
                return np.array(Image.open(io.BytesIO(zf.read(name))))

            pre_ids = np.linspace(50, test["ignitionFrame"] - 50, 9).astype(int)
            post_ids = np.linspace(test["extinctionFrame"] + 50, len(all_names) - 1, 9).astype(int)
            # Intensifier dark counts are sparse: a temporal median would be
            # near zero and leave a positive radiometric bias. Use their mean.
            pre_frames = np.stack([load(all_names[i]) for i in pre_ids])
            post_frames = np.stack([load(all_names[i]) for i in post_ids])
            bg_pre = np.mean(pre_frames, axis=0).astype(np.float32)
            bg_post = np.mean(post_frames, axis=0).astype(np.float32)
            valid = np.ones_like(bg_pre)
            valid[(bg_pre > 2000) | (bg_post > 2000)] = 0
            cx, cy = test["centerPixels"]
            yy, xx = np.indices(valid.shape)
            for item in config["hardwareMaskRelativePixels"]:
                x0, y0, x1, y1 = item["bounds"]
                valid[(xx >= cx + x0) & (xx <= cx + x1) & (yy >= cy + y0) & (yy <= cy + y1)] = 0
            rec = Reconstructor(config, test)
            detector_weights = np.clip(rec.resize(valid), 0, 1)
            def detector_mean(frame):
                return float(np.sum(rec.resize(frame) * detector_weights) / detector_weights.sum()) / config["displayCounts"]
            dark_sigma = max(float(np.std([detector_mean(f) for f in pre_frames], ddof=1)),
                             float(np.std([detector_mean(f) for f in post_frames], ddof=1)))
            rec.noise_floor = max(1e-5, 5 * dark_sigma)
            pre_time = float(np.mean([(timestamp(all_names[i]) - origin).total_seconds() for i in pre_ids]))
            post_time = float(np.mean([(timestamp(all_names[i]) - origin).total_seconds() for i in post_ids]))
            del pre_frames, post_frames
            frame_times, previews, metrics = [], [], []
            with (staging / "lut.f16.gz").open("wb") as raw_file, gzip.GzipFile(fileobj=raw_file, mode="wb", mtime=0, compresslevel=6) as packed:
                for i, name in enumerate(names):
                    raw = load(name)
                    t = (timestamp(name) - origin).total_seconds()
                    mix = float(np.clip((t - pre_time) / max(post_time - pre_time, 1e-9), 0, 1))
                    bg = bg_pre * (1 - mix) + bg_post * mix
                    field, quality = rec.reconstruct(raw, bg, valid)
                    packed.write(field.astype("<f2").tobytes())
                    t_ms = round(t * 1000)
                    src = int(re.search(r"_(\d+)\.tiff$", name)[1])
                    frame_times.append(t_ms)
                    metrics.append({"tMs": t_ms, "src": src, **quality})
                    if i % 5 == 0 or i == len(names) - 1 or limit:
                        file = f"p{src:05d}.jpg"
                        # One fixed linear transfer for every preview in every test.
                        preview = (np.clip(raw.astype(np.float32) / config["displayCounts"], 0, 1) * 255).astype(np.uint8)
                        Image.fromarray(preview).resize((320, 239), Image.Resampling.BILINEAR).save(staging / "preview" / file, quality=83)
                        previews.append({"i": len(previews), "src": src, "file": file, "tMs": t_ms})
                    if i % 200 == 0:
                        print(f"{test_id}: {i}/{len(names)} t={t:.2f}s error={quality['projectionNrmse']}", flush=True)
            camera_names = [n for n in zf.namelist() if n.endswith(".mdipsug")]
            camera = {}
            if camera_names:
                rows = list(csv.DictReader(io.StringIO(zf.read(camera_names[0]).decode("utf-8-sig"))))
                for key in ["GainManual", "ExposureManual", "ExposureMode", "PixelFormat", "BufferIncompleteTotal"]:
                    camera[key] = sorted(set(row.get(key, "") for row in rows))
        digest = hashlib.file_digest(archive.open("rb"), "sha256").hexdigest()
        pixel_m = config["burnerDiameterMeters"] / config["burnerDiameterPixels"]
        domain_m = 2 * config["domainRadiusPixels"] * pixel_m
        meta = {
            "schemaVersion": 2, "dataset": "PSI-159", "testpoint": test_id,
            "generatorSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            "calibrationSha256": hashlib.sha256(CONFIG.read_bytes()).hexdigest(),
            "camera": "INTNS (Mono16)", "method": "nonnegative masked Abel fit with spatial regularization and spherical prior in unobserved regions",
            "sourceFile": archive.name, "sha256": digest, "sourceCamera": camera,
            "encoding": "float16-le", "compression": "gzip", "file": "lut.f16.gz",
            "frames": len(names), "z": config["z"], "r": config["r"], "timesMs": frame_times,
            "fps": (len(names) - 1) / max((end - origin).total_seconds(), 1e-9),
            "timeOrigin": origin.isoformat(), "durationMs": frame_times[-1],
            "ignitionMs": round((timestamp(all_names[test["ignitionFrame"]]) - origin).total_seconds() * 1000),
            "extinctionMs": round((timestamp(all_names[test["extinctionFrame"]]) - origin).total_seconds() * 1000),
            "geometry": {"centerPixels": test["centerPixels"], "domainRadiusPixels": config["domainRadiusPixels"],
                         "domainMeters": domain_m, "pixelSizeMeters": pixel_m, "burnerRadiusMeters": config["burnerDiameterMeters"] / 2,
                         "scaleStatus": config["scaleStatus"], "scaleRelativeUncertainty": config["scaleRelativeUncertainty"], "scaleSource": config["source"]},
            "radiometry": {"displayCounts": config["displayCounts"], "units": "linear INTNS counts / displayCounts / local path length", "absoluteCalibration": False, "perFrameNormalization": False,
                           "detectionFloorCounts": rec.noise_floor * config["displayCounts"], "detectionRule": "5 sigma of the measured dark-frame mean over the same observation mask"},
            "validation": summarize_validation(metrics),
            "quality": [{"saturatedFraction": m["saturatedFraction"], "observedFraction": m["observedFraction"],
                         "projectionNrmse": m["projectionNrmse"], "inferredFromPrior": m["inferredFromPrior"]} for m in metrics],
        }
        meta.update(sensor_export(test_id, origin, staging))
        (staging / "lut-index.json").write_text(json.dumps(meta, separators=(",", ":")))
        (staging / "index.json").write_text(json.dumps({"schemaVersion": 2, "testpoint": test_id, "camera": "INTNS", "timeOrigin": origin.isoformat(), "totalFrames": len(all_names), "w": 1392, "h": 1040, "displayW": 320, "displayH": 239, "displayCounts": config["displayCounts"], "path": "preview/", "frames": previews}, separators=(",", ":")))
        (staging / "metrics.json").write_text(json.dumps({"testpoint": test_id, "frames": metrics}, separators=(",", ":")))
        dest = output / test_id
        dest.mkdir(exist_ok=True)
        for file in staging.iterdir():
            target = dest / file.name
            if file.is_dir() and target.exists():
                shutil.rmtree(target)
            os.replace(file, target)
        # Retire the incompatible byte-stretched assets only after success.
        (dest / "lut.bin").unlink(missing_ok=True)
        if (dest / "frames").is_dir():
            shutil.rmtree(dest / "frames")
        print(f"{test_id}: complete {len(names)} frames, median projection error {meta['validation']['medianProjectionNrmse']}", flush=True)
    finally:
        shutil.rmtree(staging, ignore_errors=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-dir", type=Path, default=Path("/private/tmp"))
    parser.add_argument("--output", type=Path, default=APP / "public/psi159")
    parser.add_argument("--test", choices=["21088A1", "21088B1", "21088C1", "all"], default="all")
    parser.add_argument("--limit", type=int, help="Sparse development build; write to a separate --output.")
    args = parser.parse_args()
    if args.limit and args.output.resolve() == (APP / "public/psi159").resolve():
        parser.error("Sparse builds require a separate --output to protect the full-rate assets")
    config = json.loads(CONFIG.read_text())
    for test in config["tests"] if args.test == "all" else [args.test]:
        build(test, args.raw_dir, args.output, config, args.limit)


if __name__ == "__main__":
    main()

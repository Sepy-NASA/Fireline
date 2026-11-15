"""Audit PSI-159 sensor/camera clocks without shifting or modifying source data.

Run with NumPy and Pillow installed. The original INTNS archives are expected in
/private/tmp (override with --archive-dir). Outputs are written beside this file.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import zipfile
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
TESTS = ["21088A1", "21088B1", "21088C1"]


def stamp(name: str) -> datetime:
    return datetime.strptime(re.search(r"\d{8}_\d{6}\.\d{3}", name)[0], "%Y%m%d_%H%M%S.%f")


def font(size: int):
    return ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", size)


def audit(test: str, archive_dir: Path):
    public = ROOT / "app/public/psi159" / test
    meta = json.loads((public / "lut-index.json").read_text())
    sensors = json.loads((public / "sensors.json").read_text())
    previews = json.loads((public / "index.json").read_text())
    metrics = json.loads((public / "metrics.json").read_text())["frames"]
    origin = datetime.fromisoformat(meta["timeOrigin"])
    source = ROOT / f"data/psi-159-drive/{test}_data.csv"
    with source.open(newline="") as f:
        acquisition_config = next(f).strip()
        rows = list(csv.DictReader(f))
    times = []
    for row in rows:
        hh, mm, ss, ms = map(int, row["Time"].strip().split(":"))
        dt = origin.replace(hour=hh, minute=mm, second=ss, microsecond=ms * 1000)
        times.append((dt - origin).total_seconds())
    times = np.asarray(times)
    assert np.all(np.diff(times) > 0)
    raw = {name: np.asarray([float(row[name]) for row in rows]) for name in rows[0] if name != "Time"}
    st = np.asarray(sensors["t"])
    ix = np.clip(np.searchsorted(times, st), 1, len(times) - 1)
    ix -= np.abs(times[ix - 1] - st) < np.abs(times[ix] - st)
    value_errors = {s["name"]: float(np.max(np.abs(np.asarray(s["v"]) - raw[s["name"]][ix]))) for s in sensors["series"]}
    assert np.max(np.abs(times[ix] - st)) < 1e-9
    assert max(value_errors.values()) <= 0.000000501

    camera_t = np.asarray(meta["timesMs"]) / 1000
    signal = np.asarray([m["meanSignal"] for m in metrics])
    floor = meta["radiometry"]["detectionFloorCounts"] / meta["radiometry"]["displayCounts"]
    mask = signal >= floor
    boundaries = np.diff(np.r_[False, mask, False].astype(int))
    runs = list(zip(np.flatnonzero(boundaries == 1), np.flatnonzero(boundaries == -1) - 1))
    ignition = meta["ignitionMs"] / 1000
    recorded_extinction = meta["extinctionMs"] / 1000
    # Ignore isolated post-flame camera events (B1/C1 have one-frame events).
    # This is an operational optical detection criterion, not chemical extinction.
    eligible = [(a, b) for a, b in runs if b - a + 1 >= 3
                and camera_t[b] > ignition + 5
                and camera_t[b] < recorded_extinction + 2]
    _, last = max(eligible, key=lambda ab: ab[1])
    optical_last = float(camera_t[last])
    optical_dark = float(camera_t[last + 1])

    def half_fall(name: str):
        y = raw[name]
        baseline = float(np.median(y[(times >= 0) & (times <= 3)]))
        plateau = float(np.median(y[(times > ignition + 5) & (times < optical_last - 3)]))
        threshold = (baseline + plateau) / 2
        sample = np.flatnonzero((times > optical_dark) & (y < threshold))[0]
        return {"seconds": float(times[sample]), "baseline": baseline,
                "plateau": plateau, "halfThreshold": threshold}

    ion_fall = half_fall("IonCurrent")
    fuel_fall = half_fall("MFCA3FuelFlow")
    # Apparent alignment of different optical instruments; response/filter/spectral
    # differences mean this is not a measurement of hardware clock offset.
    select = (camera_t > ignition + 5) & (camera_t < optical_dark + 2)
    ct = camera_t[select]
    camera_log = np.log1p(np.maximum(signal[select], 0) * 100)
    lags = np.arange(-0.5, 0.5001, 0.01)
    correlations, derivative_correlations = [], []
    for lag in lags:
        pm = np.interp(ct + lag, times, raw["PMT1"])
        correlations.append(float(np.corrcoef(camera_log, np.log1p(np.maximum(pm, 0) * 20))[0, 1]))
        derivative_correlations.append(float(np.corrcoef(np.diff(signal[select]), np.diff(pm))[0, 1]))

    values = {}
    for label, t in [("beforeIgnition", ignition - 0.5), ("opticalDarkPlus1s", optical_dark + 1),
                     ("recordedExtinction", recorded_extinction), ("fuelOffPlus2s", meta["flowOffMs"] / 1000 + 2)]:
        window = np.abs(times - t) < 0.1
        values[label] = {"seconds": t, **{k: float(np.median(raw[k][window])) for k in ["IonCurrent", "MFCA3FuelFlow", "PMT1"]}}

    with zipfile.ZipFile(archive_dir / meta["sourceFile"]) as z:
        names = sorted(n for n in z.namelist() if n.endswith(".tiff"))
        source_origin = stamp(names[0])
        source_ms = [round((stamp(n) - source_origin).total_seconds() * 1000) for n in names]
        assert source_ms == meta["timesMs"]
        assert all(frame["tMs"] == source_ms[frame["src"]] for frame in previews["frames"])
        assert origin == source_origin
        assert meta["timeOrigin"] == sensors["timeOrigin"] == previews["timeOrigin"]
        images = []
        for target in [optical_dark - 5, optical_dark + 0.4, ion_fall["seconds"] + 2]:
            fi = int(np.argmin(np.abs(camera_t - target)))
            image = np.asarray(Image.open(io.BytesIO(z.read(names[fi]))))
            # One display transfer for every image/test. No individual stretching.
            shown = Image.fromarray((np.clip(image / 6000, 0, 1) * 255).astype(np.uint8)).resize((390, 291))
            ri = int(np.argmin(np.abs(times - camera_t[fi])))
            images.append((shown, float(camera_t[fi]), float(raw["IonCurrent"][ri]), float(raw["PMT1"][ri])))

    return {
        "test": test, "timeOrigin": meta["timeOrigin"], "rawSensorRows": len(rows),
        "cameraFrames": len(names), "exportedSensorSamples": len(st),
        "sourceCsvSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "acquisitionConfig": acquisition_config,
        "softwareAlignment": {"sourceCameraTimesExact": True, "previewTimesExact": True,
            "allTimeOriginsEqual": True, "maxExportedSensorTimeErrorSeconds": 0,
            "maxValueRoundingError": max(value_errors.values()),
            "maxSensorExportGapSeconds": float(np.max(np.diff(st))),
            "maxPreviewGapSeconds": float(max(np.diff([f["tMs"] for f in previews["frames"]])) / 1000)},
        "optical": {"criterion": "end of last >=3-frame run above measured 5-sigma dark-mean floor, within main burn window",
            "floorMeanCounts": meta["radiometry"]["detectionFloorCounts"],
            "lastAboveFloorSeconds": optical_last, "firstDarkSeconds": optical_dark,
            "recordedExtinctionMsSeconds": recorded_extinction,
            "recordedMinusOpticalDarkSeconds": recorded_extinction - optical_dark,
            "firstDarkWallClock": (origin + timedelta(seconds=optical_dark)).isoformat()},
        "ionHalfFall": ion_fall, "fuelHalfFall": fuel_fall,
        "ionFallAfterOpticalDarkSeconds": ion_fall["seconds"] - optical_dark,
        "ionFuelPearsonR": float(np.corrcoef(raw["IonCurrent"], raw["MFCA3FuelFlow"])[0, 1]),
        "apparentPmt1Alignment": {"bestLagSeconds": round(float(lags[np.argmax(correlations)]), 3),
            "correlation": max(correlations), "zeroLagCorrelation": correlations[50],
            "bestDerivativeLagSeconds": round(float(lags[np.argmax(derivative_correlations)]), 3),
            "meaning": "PMT sampled at camera time + lag. Negative means PMT leads; not a hardware clock calibration."},
        "values": values,
    }, images


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive-dir", type=Path, default=Path("/private/tmp"))
    args = parser.parse_args()
    results, pictures = [], []
    for test in TESTS:
        result, images = audit(test, args.archive_dir)
        results.append(result)
        pictures.append(images)
    (OUT / "results.json").write_text(json.dumps({"tests": results}, indent=2) + "\n")
    with (OUT / "events.csv").open("w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["test", "first_optical_dark_s", "metadata_extinction_s", "fuel_half_fall_s", "ion_half_fall_s", "ion_after_optical_dark_s", "ion_fuel_pearson_r"])
        for r in results:
            writer.writerow([r["test"], r["optical"]["firstDarkSeconds"], r["optical"]["recordedExtinctionMsSeconds"],
                             r["fuelHalfFall"]["seconds"], r["ionHalfFall"]["seconds"],
                             round(r["ionFallAfterOpticalDarkSeconds"], 3), r["ionFuelPearsonR"]])
    sheet = Image.new("RGB", (1260, 1220), "#101723")
    draw = ImageDraw.Draw(sheet)
    draw.text((22, 18), "Raw INTNS camera and simultaneous raw IonCurrent", font=font(28), fill="white")
    draw.text((22, 57), "Identical display scale: 0-6000 camera counts. IonCurrent has no applied physical calibration.", font=font(19), fill="#b6c5d9")
    for col, label in enumerate(["5 s before optical fade", "0.4 s after optical fade", "After IonCurrent falls"]):
        draw.text((22 + col * 416, 97), label, font=font(22), fill="#b8d9ff")
    for row, (test, images) in enumerate(zip(TESTS, pictures)):
        top = 140 + row * 354
        for col, (im, t, ion, pmt) in enumerate(images):
            left = 22 + col * 416
            sheet.paste(im.convert("RGB"), (left, top))
            draw.text((left, top + 297), f"{test}  t={t:.3f} s", font=font(19), fill="white")
            draw.text((left, top + 322), f"Ion={ion:.3f}    PMT1={pmt:.4f}", font=font(18), fill="#eec67b")
    sheet.save(OUT / "camera-versus-ion.png")
    print(json.dumps({"cameraFramesVerified": sum(r["cameraFrames"] for r in results), "rawSensorRowsChecked": sum(r["rawSensorRows"] for r in results), "events": [{"test": r["test"], "opticalDark": r["optical"]["firstDarkSeconds"], "ionHalfFall": r["ionHalfFall"]["seconds"], "delay": round(r["ionFallAfterOpticalDarkSeconds"], 3), "apparentPmtLag": r["apparentPmt1Alignment"]["bestLagSeconds"]} for r in results]}, indent=2))


if __name__ == "__main__":
    main()

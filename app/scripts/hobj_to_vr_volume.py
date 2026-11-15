#!/usr/bin/env python3
"""Create Fireline VR fields from HALCON HOBJ or Mono16 TIFF camera frames.

This is a camera-intensity reconstruction, not a physics, chemistry or
temperature simulation. The output is the same `lut.f16.gz` format Flame VR
renders; the OBJ is only a convenient 3D preview of one intensity contour.
"""

from __future__ import annotations

import argparse
import gzip
import json
import math
import shutil
import tempfile
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image

from build_flame_data import Reconstructor, timestamp


ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "scripts/psi159/calibration.json"
IMAGE_TYPES = {".hobj", ".tif", ".tiff"}


def collect(sources: list[str], temporary: Path) -> list[Path]:
    """Return HOBJ/TIFF files from paths, directories, or ZIP archives."""
    files: list[Path] = []
    for number, value in enumerate(sources):
        path = Path(value)
        if path.is_dir():
            files.extend(item for item in path.iterdir() if item.suffix.lower() in IMAGE_TYPES)
        elif path.suffix.lower() in IMAGE_TYPES and path.is_file():
            files.append(path)
        elif path.suffix.lower() == ".zip" and path.is_file():
            destination = temporary / f"zip-{number}"
            destination.mkdir(parents=True)
            with zipfile.ZipFile(path) as archive:
                members = [item for item in archive.infolist()
                           if not item.is_dir() and Path(item.filename).suffix.lower() in IMAGE_TYPES]
                for index, item in enumerate(sorted(members, key=lambda member: member.filename)):
                    # Use our own file name: it prevents Zip Slip and keeps the
                    # original timestamp in the name for playback timing.
                    target = destination / f"{index:06d}-{Path(item.filename).name}"
                    with archive.open(item) as source, target.open("wb") as output:
                        shutil.copyfileobj(source, output, 1024 * 1024)
                    files.append(target)
        else:
            raise FileNotFoundError(f"Expected HOBJ, TIFF, ZIP, or directory: {path}")
    if not files:
        raise FileNotFoundError("No HOBJ/TIFF camera frames found")
    return sorted(files)


def hobj_to_tiffs(path: Path, temporary: Path) -> list[Path]:
    """Export image objects from HOBJ with a local HALCON installation."""
    try:
        import halcon as ha  # type: ignore[import-not-found]
    except ImportError as error:
        raise RuntimeError("HOBJ needs HALCON's Python module. Export to TIFF or install HALCON.") from error

    temporary.mkdir(parents=True, exist_ok=True)
    objects = ha.read_object(str(path))
    result: list[Path] = []
    for index in range(1, int(ha.count_obj(objects)) + 1):
        image = ha.select_obj(objects, index)
        kind = ha.get_obj_class(image)
        kind = kind[0] if isinstance(kind, (list, tuple)) else kind
        if str(kind) != "image":
            raise ValueError(f"{path.name}: object {index} is not a camera image")
        target = temporary / f"{path.stem}-{index:04d}.tiff"
        ha.write_image(image, "tiff", 0, str(target))
        result.append(target)
    if not result:
        raise ValueError(f"{path.name}: no image objects")
    return result


def load(paths: list[Path], temporary: Path) -> tuple[list[np.ndarray], list[str]]:
    """Load all HOBJ/TIFF frames as single-channel float arrays."""
    frames: list[np.ndarray] = []
    names: list[str] = []
    for path in paths:
        images = hobj_to_tiffs(path, temporary) if path.suffix.lower() == ".hobj" else [path]
        for image_path in images:
            with Image.open(image_path) as image:
                pixels = np.asarray(image)
            if pixels.ndim != 2:
                raise ValueError(f"{image_path.name}: expected a one-channel intensity image")
            frames.append(pixels.astype(np.float32))
            names.append(path.name)
    if any(frame.shape != frames[0].shape for frame in frames):
        raise ValueError("All frames must have the same dimensions")
    return frames, names


def camera_mask(shape: tuple[int, int], config: dict, test: dict) -> np.ndarray:
    """Build the existing PSI-159 hardware mask in camera-pixel coordinates."""
    height, width = shape
    cx, cy = test["centerPixels"]
    if not (0 <= cx < width and 0 <= cy < height):
        raise ValueError(f"{width}×{height}: camera axis {cx},{cy} is outside this image")
    mask = np.ones(shape, dtype=np.float32)
    for item in config["hardwareMaskRelativePixels"]:
        x0, y0, x1, y1 = item["bounds"]
        left, right = max(0, cx + x0), min(width, cx + x1 + 1)
        top, bottom = max(0, cy + y0), min(height, cy + y1 + 1)
        mask[top:bottom, left:right] = 0
    return mask


def frame_times(names: list[str], fps: float) -> tuple[list[int], str]:
    """Use timestamped filenames; otherwise use the requested frame rate."""
    try:
        values = [timestamp(name) for name in names]
    except ValueError:
        return [round(index * 1000 / fps) for index in range(len(names))], "frame-index clock"
    start = values[0]
    return [round((value - start).total_seconds() * 1000) for value in values], start.isoformat()


def write_obj(field: np.ndarray, path: Path, domain_meters: float) -> Path | None:
    """Revolve a 20%-of-peak intensity profile into a small inspection OBJ."""
    peak = float(field.max())
    if peak <= 0:
        return None
    profile = []
    for row in field:
        visible = np.flatnonzero(row >= peak * 0.2)
        profile.append((visible[-1] + 1) / (2 * field.shape[1]) if len(visible) else 0)
    rows = [index for index, radius in enumerate(profile) if radius > 0]
    if len(rows) < 2:
        return None

    segments, vertices, faces, rings = 40, [], [], []
    for row in rows:
        radius = profile[row] * domain_meters
        y = (0.5 - (row + 0.5) / field.shape[0]) * domain_meters
        ring = []
        for part in range(segments):
            angle = 2 * math.pi * part / segments
            vertices.append((radius * math.cos(angle), y, radius * math.sin(angle)))
            ring.append(len(vertices))
        rings.append(ring)
    for first, second in zip(rings, rings[1:]):
        for part in range(segments):
            next_part = (part + 1) % segments
            faces += [(first[part], second[part], second[next_part]),
                      (first[part], second[next_part], first[next_part])]
    for ring in (rings[0], rings[-1]):
        vertices.append((0, vertices[ring[0] - 1][1], 0))
        centre = len(vertices)
        faces += [(centre, ring[(part + 1) % segments], ring[part]) for part in range(segments)]
    with path.open("w", encoding="utf-8", newline="\n") as output:
        output.write("# Fireline intensity isosurface — inspection only, not a physical flame surface.\n")
        output.writelines(f"v {x:.8g} {y:.8g} {z:.8g}\n" for x, y, z in vertices)
        output.writelines(f"f {a} {b} {c}\n" for a, b, c in faces)
    return path


def write_output(
    frames: list[np.ndarray], names: list[str], fields: list[np.ndarray], quality: list[dict],
    output: Path, config: dict, test: dict, test_id: str, fps: float,
) -> None:
    output.mkdir(parents=True, exist_ok=True)
    times, origin = frame_times(names, fps)
    with (output / "lut.f16.gz").open("wb") as raw, gzip.GzipFile(fileobj=raw, mode="wb", mtime=0) as packed:
        for field in fields:
            packed.write(field.astype("<f2").tobytes())

    previews, preview_dir = [], output / "preview"
    preview_dir.mkdir(exist_ok=True)
    for index, frame in enumerate(frames):
        if index % 5 and index != len(frames) - 1:
            continue
        file = f"p{index:05d}.jpg"
        preview = np.clip(frame / config["displayCounts"], 0, 1) * 255
        Image.fromarray(preview.astype(np.uint8)).resize((320, 239), Image.Resampling.BILINEAR).save(preview_dir / file, quality=83)
        previews.append({"i": len(previews), "src": index, "file": file, "tMs": times[index]})

    pixel_meters = config["burnerDiameterMeters"] / config["burnerDiameterPixels"]
    geometry = {
        "centerPixels": test["centerPixels"], "domainRadiusPixels": config["domainRadiusPixels"],
        "domainMeters": 2 * config["domainRadiusPixels"] * pixel_meters,
        "pixelSizeMeters": pixel_meters, "burnerRadiusMeters": config["burnerDiameterMeters"] / 2,
        "scaleStatus": config["scaleStatus"], "scaleRelativeUncertainty": config["scaleRelativeUncertainty"],
        "scaleSource": config["source"],
    }
    errors = [item["projectionNrmse"] for item in quality if item["projectionNrmse"] is not None]
    metadata = {
        "schemaVersion": 2, "dataset": "HOBJ import", "testpoint": test_id, "camera": "HALCON HOBJ/TIFF",
        "method": "nonnegative masked Abel reconstruction", "sourceFiles": names,
        "file": "lut.f16.gz", "encoding": "float16-le", "compression": "gzip",
        "frames": len(fields), "z": config["z"], "r": config["r"], "timesMs": times,
        "fps": (len(times) - 1) * 1000 / max(times[-1] - times[0], 1),
        "timeOrigin": origin, "durationMs": times[-1], "ignitionMs": 0, "extinctionMs": times[-1],
        "geometry": geometry,
        "radiometry": {"displayCounts": config["displayCounts"], "absoluteCalibration": False, "perFrameNormalization": False},
        "validation": {"medianProjectionNrmse": float(np.median(errors)) if errors else None,
                       "framesCompared": len(errors), "maskedValuesAreInferred": True},
        "quality": [{key: item[key] for key in ("saturatedFraction", "observedFraction", "projectionNrmse", "inferredFromPrior")} for item in quality],
        "limitations": "Axisymmetric relative-emission reconstruction, not a physical or predictive flame model.",
    }
    (output / "lut-index.json").write_text(json.dumps(metadata, separators=(",", ":")), encoding="utf-8")
    (output / "metrics.json").write_text(json.dumps({"testpoint": test_id, "frames": quality}, separators=(",", ":")), encoding="utf-8")
    (output / "index.json").write_text(json.dumps({
        "schemaVersion": 2, "testpoint": test_id, "camera": "HALCON HOBJ/TIFF", "timeOrigin": origin,
        "totalFrames": len(frames), "w": frames[0].shape[1], "h": frames[0].shape[0],
        "displayW": 320, "displayH": 239, "displayCounts": config["displayCounts"], "path": "preview/", "frames": previews,
    }, separators=(",", ":")), encoding="utf-8")
    (output / "sensors.json").write_text(json.dumps({
        "testpoint": test_id, "timeOrigin": origin, "timeBasis": "camera acquisition clock only", "t": [], "series": [],
        "note": "No sensor file was supplied with this import.",
    }, separators=(",", ":")), encoding="utf-8")

    brightest = int(np.argmax([field.sum() for field in fields]))
    mesh = write_obj(fields[brightest], output / f"frame-{brightest:05d}.obj", geometry["domainMeters"])
    print(f"Created {len(fields)} VR fields in {output}")
    print(f"Inspection OBJ: {mesh}" if mesh else "Inspection OBJ: no emission above threshold")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", nargs="+", required=True, help="Flame HOBJ/TIFF files, directory, or ZIP")
    parser.add_argument("--dark", nargs="+", required=True, help="Dark-frame HOBJ/TIFF files, directory, or ZIP")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--test", choices=("21088A1", "21088B1", "21088C1"), default="21088A1")
    parser.add_argument("--fps", type=float, default=23.8, help="Used if filenames contain no timestamps")
    args = parser.parse_args()
    if args.fps <= 0:
        parser.error("--fps must be positive")

    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    test = config["tests"][args.test]
    with tempfile.TemporaryDirectory(prefix="fireline-hobj-") as folder:
        temporary = Path(folder)
        frames, names = load(collect(args.input, temporary / "input"), temporary / "hobj-input")
        dark_frames, _ = load(collect(args.dark, temporary / "dark"), temporary / "hobj-dark")
        if any(frame.shape != frames[0].shape for frame in dark_frames):
            parser.error("Dark frames must match the input dimensions")
        background = np.mean(np.stack(dark_frames), axis=0, dtype=np.float64).astype(np.float32)
        reconstructor = Reconstructor(config, test)
        mask = camera_mask(frames[0].shape, config, test)
        results = [reconstructor.reconstruct(frame, background, mask) for frame in frames]
        fields, quality = zip(*results)
        write_output(frames, names, list(fields), list(quality), args.output, config, test, args.test, args.fps)


if __name__ == "__main__":
    main()

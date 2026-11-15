"""Read-only measurements for the PSI-159 flame review.

Run with Python containing numpy and Pillow. Raw archives are optional and
are read from --raw-dir; no application source or input data is modified.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
TEST_IDS = ("21088A1", "21088B1", "21088C1")


def gauss(a: np.ndarray, sigma: float = 3.0) -> np.ndarray:
    # Same filter as the notebook, so crop measurements are comparable.
    k = int(3 * sigma) | 1
    x = np.arange(k) - k // 2
    w = np.exp(-(x * x) / (2 * sigma * sigma))
    w /= w.sum()
    b = np.apply_along_axis(lambda row: np.convolve(row, w, "same"), 1, a)
    return np.apply_along_axis(lambda col: np.convolve(col, w, "same"), 0, b)


def analyze_test(test_id: str, raw_dir: Path) -> dict:
    base = ROOT / "app/public/psi159" / test_id
    index = json.loads((base / "index.json").read_text())
    meta = json.loads((base / "lut-index.json").read_text())
    frames = index["frames"]
    t = np.array([f["tMs"] / 1000 for f in frames])
    lut = np.fromfile(base / "lut.bin", dtype=np.uint8).reshape(
        meta["frames"], meta["z"], meta["r"]
    )
    # Exact p99 index and nonlinear mapping used in FlameEngine.setRealLut.
    flat = lut.reshape(len(lut), -1)
    p99 = np.maximum(1, np.sort(flat, axis=1)[:, int(flat.shape[1] * 0.99)])
    stretched = np.floor(
        255 * np.minimum(1, flat / p99[:, None]) ** 0.8 + 0.5
    )
    active = np.flatnonzero(flat.max(axis=1))
    source_span = float(t[-1] - t[0])
    engine_span = (len(frames) - 1) / meta["fps"]
    result = {
        "test": test_id,
        "source_span_s": source_span,
        "engine_span_s": engine_span,
        "playback_speed_factor": source_span / engine_span,
        "median_sample_interval_s": float(np.median(np.diff(t))),
        "max_sample_interval_s": float(np.diff(t).max()),
        "effective_source_samples_per_second": (len(frames) - 1) / source_span,
        "lut_active_frames": int(len(active)),
        "sample_71_distinct_byte_values": np.unique(lut[71]).astype(int).tolist(),
        "lut_active_source_window_s": [float(t[active[0]]), float(t[active[-1]])],
        "p99_byte_range_active": [int(p99[active].min()), int(p99[active].max())],
        "mean_brightness_boost_range_active": [
            float((stretched.sum(axis=1)[active] / flat.sum(axis=1)[active]).min()),
            float((stretched.sum(axis=1)[active] / flat.sum(axis=1)[active]).max()),
        ],
        "examples": [],
    }
    for k in active[:: max(1, len(active) // 5)]:
        result["examples"].append({
            "sample": int(k),
            "source_frame": frames[k]["src"],
            "source_t_s": float(t[k]),
            "engine_t_s": int(k) / meta["fps"],
            "lut_mean_byte": float(flat[k].mean()),
            "p99_byte": int(p99[k]),
            "stretched_mean_byte": float(stretched[k].mean()),
        })

    archive = raw_dir / meta["sourceFile"]
    if archive.exists():
        with zipfile.ZipFile(archive) as zf:
            names = sorted(n for n in zf.namelist() if n.endswith(".tiff"))

            def load(i: int) -> np.ndarray:
                return np.array(Image.open(io.BytesIO(zf.read(names[i]))))

            bg = np.median(np.stack([load(i) for i in range(100, 400, 20)]), axis=0)
            selections = sorted(set(
                [e["sample"] for e in result["examples"]]
                + [int(active[0]), int(active[-1]), 71]
            ))
            source_stats = []
            for k in selections:
                src = frames[k]["src"]
                a = load(src)
                signal = gauss(np.maximum(a.astype(np.float32) - bg, 0))
                cx = meta["axisX"]
                col = signal[:, max(0, cx - 350):cx + 350].mean(axis=1)
                ys = np.flatnonzero(col > 0.25 * col.max())
                crop = None
                if len(ys) >= 10:
                    cy = int((ys.min() + ys.max()) // 2)
                    radius = int((ys.max() - ys.min()) // 2)
                    radius = min(radius, cx, a.shape[1] - cx, cy, a.shape[0] - cy)
                    crop = {"cy_px": cy, "radius_px": radius}
                source_stats.append({
                    "sample": k,
                    "source_frame": src,
                    "source_t_s": float(t[k]),
                    "mean_counts": float(a.mean()),
                    "fraction_ge_65000": float(np.mean(a >= 65000)),
                    "crop_used_by_notebook": crop,
                })
            result["raw_samples"] = source_stats
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-dir", type=Path, default=Path("/private/tmp"))
    args = parser.parse_args()
    result = {
        "scope": "Code, shipped LUTs and selected Mono16 source frames; not a physical headset test.",
        "tests": [analyze_test(test_id, args.raw_dir) for test_id in TEST_IDS],
        "source_sha256": {},
    }
    for p in sorted((ROOT / "app/src/features/vr").glob("*")):
        if p.is_file():
            result["source_sha256"][str(p.relative_to(ROOT))] = hashlib.sha256(p.read_bytes()).hexdigest()
    path = OUT / "measurements.json"
    path.write_text(json.dumps(result, indent=2) + "\n")
    for r in result["tests"]:
        print(r["test"], f'source={r["source_span_s"]:.3f}s',
              f'engine={r["engine_span_s"]:.3f}s',
              f'speed={r["playback_speed_factor"]:.3f}x',
              f'sampling={r["effective_source_samples_per_second"]:.3f}Hz',
              f'p99={r["p99_byte_range_active"]}',
              f'boost={r["mean_brightness_boost_range_active"]}')
        for sample in r.get("raw_samples", []):
            print("  raw:", sample)
    print("Wrote", path)


if __name__ == "__main__":
    main()

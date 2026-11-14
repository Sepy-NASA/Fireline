#!/Users/szymonpasieczny/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3
"""Headless visual smoke test for the Vite VR app at http://127.0.0.1:5199/.

Usage:
    verify_vr.py [TEST_ID] [OUTPUT_PNG]
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.parse import quote

import numpy as np
from PIL import Image

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
APP_URL = "http://127.0.0.1:5199/"
DEFAULT_TEST_ID = "21088A1"
DEFAULT_OUTPUT_PNG = "/tmp/verify_vr.png"
SCREENSHOT_TIMEOUT_S = 75.0

# name: (x0, x1, y0, y1), measured on a 1440x900 screenshot.
RECTS = {
    "left chart panel": (150, 620, 180, 660),
    "right chart panel": (820, 1300, 180, 660),
    "lower-centre preview": (520, 920, 500, 790),
    "centre flame": (580, 860, 260, 540),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Capture and verify the rendered VR app in headless Chrome."
    )
    parser.add_argument(
        "test_id",
        nargs="?",
        default=DEFAULT_TEST_ID,
        help=f"test id used in the page URL (default: {DEFAULT_TEST_ID})",
    )
    parser.add_argument(
        "output_png",
        nargs="?",
        default=DEFAULT_OUTPUT_PNG,
        help=f"screenshot output path (default: {DEFAULT_OUTPUT_PNG})",
    )
    return parser.parse_args()


def terminate_chrome(proc: subprocess.Popen | None, profile_dir: str) -> None:
    """Terminate Chrome, then pkill any remaining processes using this profile."""
    if proc is not None and proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                pass

    # Fallback for Chrome renderer/GPU children that may outlive the main process.
    try:
        subprocess.run(
            ["pkill", "-f", profile_dir],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=10,
            check=False,
        )
    except (FileNotFoundError, subprocess.SubprocessError):
        pass


def capture_screenshot(test_id: str, output_png: Path) -> None:
    """Launch headless Chrome, wait for the screenshot, then clean up Chrome."""
    if not os.path.isfile(CHROME):
        raise RuntimeError(f"Chrome executable not found: {CHROME}")

    output_png.parent.mkdir(parents=True, exist_ok=True)
    try:
        output_png.unlink()
    except FileNotFoundError:
        pass

    profile_dir = tempfile.mkdtemp(prefix="verify-vr-chrome-")
    url = f"{APP_URL}?test={quote(test_id, safe='')}#vr"
    command = [
        CHROME,
        "--headless=new",
        "--no-sandbox",
        "--no-first-run",
        f"--user-data-dir={profile_dir}",
        "--enable-unsafe-swiftshader",
        "--use-angle=swiftshader",
        "--window-size=1440,900",
        "--hide-scrollbars",
        "--mute-audio",
        "--virtual-time-budget=45000",
        f"--screenshot={output_png}",
        url,
    ]

    print(f"Test id:   {test_id}")
    print(f"URL:       {url}")
    print(f"Chrome:    {CHROME}")
    print(f"Profile:   {profile_dir}")
    print(f"Output:    {output_png}")
    print("Capturing screenshot (waiting up to 75 s) ...", flush=True)

    proc: subprocess.Popen | None = None
    try:
        proc = subprocess.Popen(
            command,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        deadline = time.monotonic() + SCREENSHOT_TIMEOUT_S
        last_size = -1
        stable_checks = 0
        while time.monotonic() < deadline:
            try:
                size = output_png.stat().st_size
            except FileNotFoundError:
                size = 0

            if size > 0:
                if size == last_size:
                    stable_checks += 1
                else:
                    stable_checks = 0
                    last_size = size
                # Require two stable observations so Chrome has finished writing.
                if stable_checks >= 2:
                    break
            else:
                last_size = -1
                stable_checks = 0

            time.sleep(0.25)
    finally:
        terminate_chrome(proc, profile_dir)
        shutil.rmtree(profile_dir, ignore_errors=True)

    if not output_png.is_file() or output_png.stat().st_size == 0:
        raise RuntimeError(
            f"Chrome did not produce a screenshot at {output_png} within "
            f"{SCREENSHOT_TIMEOUT_S:.0f} s"
        )


def measure(rgb: np.ndarray, rect: tuple[int, int, int, int], name: str) -> dict:
    """Measure luminance and colourfulness in one rectangle of an RGB image."""
    height, width = rgb.shape[:2]
    x0, x1, y0, y1 = rect
    if x0 < 0 or y0 < 0 or x1 > width or y1 > height or x0 >= x1 or y0 >= y1:
        raise ValueError(
            f"{name} rectangle {rect} is outside the {width}x{height} screenshot"
        )

    crop = rgb[y0:y1, x0:x1].astype(np.float64)
    # Rec. 709 relative luminance, expressed on the same 0..255 scale as RGB.
    luminance = 0.2126 * crop[:, :, 0] + 0.7152 * crop[:, :, 1] + 0.0722 * crop[:, :, 2]
    channel_range = crop.max(axis=2) - crop.min(axis=2)
    coloured_pixels = int(np.count_nonzero(channel_range > 40))

    return {
        "rect": rect,
        "pixels": int(crop.shape[0] * crop.shape[1]),
        "mean_luminance": float(luminance.mean()),
        "max_luminance": float(luminance.max()),
        "coloured_pixels": coloured_pixels,
    }


def print_results(size: tuple[int, int], results: dict[str, dict], checks: list[tuple[str, bool, str]]) -> bool:
    print()
    print(f"Screenshot size: {size[0]}x{size[1]}")
    print("Luminance = Rec. 709 weighted RGB; coloured = max(R,G,B) - min(R,G,B) > 40.")
    print()
    print("Measured rectangles:")
    for name, data in results.items():
        x0, x1, y0, y1 = data["rect"]
        print(f"  {name} (x0={x0}, x1={x1}, y0={y0}, y1={y1})")
        print(f"    pixels:                  {data['pixels']}")
        print(f"    mean luminance:          {data['mean_luminance']:.2f}")
        print(f"    max luminance:           {data['max_luminance']:.2f}")
        print(f"    coloured pixels:         {data['coloured_pixels']}")

    print()
    print("Checks:")
    for label, passed, detail in checks:
        print(f"  [{'PASS' if passed else 'FAIL'}] {label}: {detail}")

    all_passed = all(passed for _, passed, _ in checks)
    print()
    print(f"RESULT: {'PASS' if all_passed else 'FAIL'}")
    return all_passed


def main() -> int:
    args = parse_args()
    output_png = Path(args.output_png).expanduser()
    if not output_png.is_absolute():
        output_png = Path.cwd() / output_png

    try:
        capture_screenshot(args.test_id, output_png)
        with Image.open(output_png) as image:
            image.load()
            rgb = np.array(image.convert("RGB"), dtype=np.uint8)
            size = image.size
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        print()
        print("RESULT: FAIL")
        return 1

    try:
        results = {
            name: measure(rgb, rect, name) for name, rect in RECTS.items()
        }
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        print()
        print("RESULT: FAIL")
        return 1

    left = results["left chart panel"]
    right = results["right chart panel"]
    preview = results["lower-centre preview"]
    flame = results["centre flame"]

    checks = [
        (
            "left chart",
            left["mean_luminance"] > 15 and left["coloured_pixels"] > 300,
            f"mean luminance {left['mean_luminance']:.2f} > 15 "
            f"and coloured pixels {left['coloured_pixels']} > 300",
        ),
        (
            "right chart",
            right["mean_luminance"] > 15 and right["coloured_pixels"] > 300,
            f"mean luminance {right['mean_luminance']:.2f} > 15 "
            f"and coloured pixels {right['coloured_pixels']} > 300",
        ),
        (
            "preview",
            preview["mean_luminance"] > 15,
            f"mean luminance {preview['mean_luminance']:.2f} > 15",
        ),
        (
            "flame",
            flame["max_luminance"] > 100,
            f"max luminance {flame['max_luminance']:.2f} > 100",
        ),
    ]

    passed = print_results(size, results, checks)
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())

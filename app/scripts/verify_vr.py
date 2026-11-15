#!/usr/bin/env python3
"""Offline scientific regression checks for the flame/VR data path.

Run with Python containing NumPy and Pillow. Browser/headset checks are
separate: this command does not infer physical validity from bright pixels.
"""
from pathlib import Path
import subprocess
import sys

APP = Path(__file__).resolve().parents[1]
if __name__ == '__main__':
    for command in [
        ['node', '--test', 'tests/flame.test.mjs'],
        [sys.executable, 'scripts/psi159/test_reconstruction.py'],
    ]:
        result = subprocess.run(command, cwd=APP)
        if result.returncode:
            sys.exit(result.returncode)
    print('PASS: data, acquisition clock and reconstruction regressions.')
    print('Physical headset and absolute optical validation are separate checks.')

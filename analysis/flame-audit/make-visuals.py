"""Extract reference frames at explicit seek times and assemble audit figures."""
import argparse
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--video', type=Path, default=Path('/private/tmp/PSI-159_Raw Data_vlc-record-2021-03-29-15h24m41s-udp____21088A1.ts'))
args = parser.parse_args()
times = list(range(130, 191, 5))


def extract(item):
    i, t = item
    subprocess.run(['ffmpeg', '-v', 'fatal', '-ss', str(t), '-i', str(args.video),
                    '-frames:v', '1', '-y', str(OUT / f'reference-{i+1:02d}.png')], check=True)


with ThreadPoolExecutor(max_workers=4) as pool:
    list(pool.map(extract, enumerate(times)))

font_path = '/System/Library/Fonts/Supplemental/Arial.ttf'
font = ImageFont.truetype(font_path, 20)
small = ImageFont.truetype(font_path, 16)
canvas = Image.new('RGB', (1280, 1056), (6, 8, 12))
draw = ImageDraw.Draw(canvas)
for i, t in enumerate(times):
    im = Image.open(OUT / f'reference-{i+1:02d}.png').convert('RGB').resize((320, 240))
    x, y = (i % 4) * 320, (i // 4) * 264
    canvas.paste(im, (x, y + 24))
    draw.text((x + 8, y + 1), f'A1 video  t = {t} s', font=font, fill=(225, 232, 245))
canvas.save(OUT / 'reference-sequence.jpg', quality=94)

# These are morphology examples at different instants, not matched-time views.
figure = Image.new('RGB', (1260, 370), (6, 8, 12))
draw = ImageDraw.Draw(figure)
panels = [
    (Image.open(OUT / 'reference-04.png').convert('RGB'), 'Wideo A1: 145 s'),
    (Image.open(OUT / 'current-intns.jpg').crop((478, 208, 802, 451)), 'Bieżąca rekonstrukcja INTNS'),
    (Image.open(OUT / 'current-physics.jpg').crop((478, 208, 802, 451)), 'Bieżący model „physics”'),
]
for i, (im, title) in enumerate(panels):
    figure.paste(im.resize((420, 315)), (i * 420, 30))
    draw.text((i * 420 + 8, 5), title, font=font, fill=(225, 232, 245))
draw.text((8, 349), 'Porównanie kształtu i wyglądu; przykłady pochodzą z różnych chwil.', font=small, fill=(170, 184, 201))
figure.save(OUT / 'comparison.jpg', quality=94)
print('Wrote reference-sequence.jpg and comparison.jpg')

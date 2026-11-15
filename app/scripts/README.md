# Skrypty Fireline

## HOBJ / TIFF → Flame VR

`hobj_to_vr_volume.py` zmienia obrazy kamery HOBJ lub TIFF na dane używane w
Flame VR (`lut.f16.gz`) oraz pomocniczy podgląd 3D (`frame-*.obj`). Nie tworzy
fizycznej symulacji płomienia — rekonstruuje względną intensywność z obrazu.

```bash
cd app
python -m pip install -r scripts/psi159/requirements.txt
python scripts/hobj_to_vr_volume.py \
  --input /sciezka/do/frames.zip \
  --dark /sciezka/do/dark-frames.zip \
  --test 21088A1 \
  --output /sciezka/do/wyniku
```

`--input` i `--dark` przyjmują pliki, foldery lub ZIP-y. Gdy jeden ZIP zawiera
jednocześnie klatki płomienia i dark, rozpakuj go i podaj je jako dwa osobne
foldery. Do bezpośredniego odczytu `.hobj` potrzebny jest lokalny HALCON;
TIFF działa bez niego.

Źródło archiwów: [NASA PSI-159](https://drive.google.com/drive/folders/1WIvup-SYEZczCj3ah7J99Y7SQdwymBHC).

## Publiczny katalog PSI

`download_psi.py` pobiera bezpośrednio z publicznego API PSI katalog badań,
pełne metadane i inwentarz plików. Nie pobiera binariów, dopóki nie dodasz
`--download`; w ten sposób nie ściągnie przypadkiem wieloterabajtowych archiwów.

```bash
cd app
python scripts/download_psi.py --id PSI-117
python scripts/download_psi.py --query combustion --limit 10
python scripts/download_psi.py --id PSI-117 --download '*metadata*.zip'
```

Domyślny limit pojedynczego pobrania to 100 MB. Zmień go przez `--max-mb`, a
`--max-mb 0` oznacza brak limitu. Wyniki trafiają do ignorowanego przez Git
`data/psi-download/`; szczegółowe pliki pochodzą z aktualnego endpointu PSI,
nie z wklejonego, wygasającego linku S3.

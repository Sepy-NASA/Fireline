# PSI-159 (ACME CFI-G) — pliki pobrane z Google Drive

Aktualizacja 2026-11-15: moduł VR korzysta teraz z pełnych sekwencji INTNS. Rekonstrukcja, źródłowe SHA-256, czas i ograniczenia są opisane w `app/scripts/psi159/README.md` oraz metadanych `app/public/psi159/*/lut-index.json`. Poniższy opis pobrania ma charakter historyczny i dotyczy wcześniejszego etapu projektu.


Źródło: <https://drive.google.com/drive/folders/1WIvup-SYEZczCj3ah7J99Y7SQdwymBHC>
Badanie: **PSI-159 — Advanced Combustion via Microgravity Experiments / Cool Flames Investigation with Gases**
DOI: `10.60555/cyt1-kh64` · Licencja: **CC0 1.0 Universal** · Wydanie: 20-Nov-2025
Rozmiar całego badania (wg `pages.csv`): 2 085 592 429 259 B (~2,09 TB).

Data pobrania (lokalnie): 2026-11-14. Pobrano **tylko małe pliki metadanych i warunków testu**;
dużych archiwów kamery (Images/HiBMS/Images_Converted, 370 MB–1,4 GB) **nie pobierano** —
folder nie zawiera danych INTNS potrzebnych do rekonstrukcji pola ε(r,z), a te archiwa są
poza zakresem mocka VR.

| Plik | Rozmiar (B) | SHA-256 |
|---|---|---|
| PSI-159_manifest.csv | 560 878 | 9e015891762e409f8708c6e9f9a2f227195da2c166ec50c61ee92eada2f51f2e |
| PSI-159_pages.csv | 472 | 466c30e45a86680416a019a9fb528e6bfa5f4e4aa2788dcd6a84abdbffee32e7 |
| PSI-159_download_to_drive.ipynb | 18 328 | 971781980449f7e5c059c4f0c5c3d399a0c431ecbfc7f1a600347c9188811eba |
| 21088A1_data.csv | 4 782 398 | 1495efa3990c9deb328e027fb80bc5b06b48d4fadfe8a3e6ff58cd28543de33e |
| 21088A1_TP.txt | 1 096 | 4117f9fedbcc7aad7e8ae681c79c095139a511be93daa35bcd48e475e514295a |
| 21088A1_mfcSetpoints.csv | 1 807 | 394882ce14883f192e253d396f709774ba3d6cb2a9ab457c7689ba15ec3aaf50 |
| 21088A1_ImageComments.txt | 31 324 | 04ebce766854c5ea01cff0ea14b0bf4d9e5ee4c274d782fe1656a5e6bbff7834 |

## Kluczowe fakty testu 21088A1 (z TP.txt / mfcSetpoints / ImageComments)

- Test Point: **21088A1**, Experiment 5, ACME CFI-G.
- Kamery (archiwum, zakres klatek): IPSU1 = 1076 (0–1076), ACME = 696 (10–696),
  **Intensified (INTNS) = 2017 (0–2017)**.
- Oś czasu: pre-ignition 15:26:44, zapłon 15:27:13, ustabilizowanie 15:27:16,
  stały przepływ 15:27:23, **wygaszenie 15:28:11**, MFC off 15:28:14.
- MFC: MFCA1 (mieszanka O₂, full-scale 20), MFCA3 (paliwo, full-scale 0.2).

> Pole płomienia renderowane w module VR jest **syntetyczne** (mock): repozytorium nie
> zawiera klatek INTNS, a rekonstrukcja `lutgen.mjs` nie została uruchomiona. Nazwy,
> wersje i sumy powyżej dokumentują jedynie pliki metadanych, z których czerpane są
> etykiety kontekstu w interfejsie.

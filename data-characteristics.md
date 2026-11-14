# PSI Combustion Data – First Look

Pulled from the NASA PSI repository on 2026-11-14. Files created in `data/`:

| File | What it is |
|---|---|
| `data/investigations-catalog.csv` | One row per investigation (24 rows): name, hardware, dates, file counts, publications, link |
| `data/file-inventory.csv` | Every file listed in PSI for those 24 investigations (~66,500 rows): folder, type, size |
| `data/experimental-tables/*.csv` | 22 small "test matrix" tables (one row ≈ one test/run). **Best starting point.** |
| `data/metadata/*.zip` | Short descriptive text files (ISA format) per investigation |

## 1. Size and shape

- **24 combustion investigations** (searching "combustion" returns 26; the 2 extra are materials science/fluid physics and can be ignored).
- **17 were flown experiments, 7 were ground-based analysis/modeling projects** that reuse flight data (PSI-60, 62, 115, 117, 142, ...).
- About **66,500 files totalling 13.5 TB**. You can't download it all, and you don't need to.
- **98.6% of files are "Raw Data"**: videos (`mp4`, `ts`), camera images in zips, and sensor logs (`txt`, `dat`, `csv`).
- Only about **240 files are "Analyzed Data"**, almost all from SAME/SAME-R (smoke), CFI, DAFT and a few ground studies.
- There are also roughly 400 human-readable documents (reports, presentations, engineering docs). These are useful for understanding each experiment.

Largest investigations: the five ACME gas-flame experiments are about 2 TB each. FLEX/FLEX-2 are about 1 TB each. The fire-safety investigations (Saffire, SAME, DAFT) are small, from a few MB to 35 GB.

## 2. Investigations grouped by fire-safety theme

| Theme | Investigations | Fuel type | Hardware |
|---|---|---|---|
| **Prevention – solid material flammability** | BASS (PSI-26), BASS-II (PSI-25), Saffire-I/II/III (PSI-98/99/100), PSI-62 (model) | Solids: PMMA (acrylic), SIBAL cotton-fiberglass fabric, Nomex, silicone, candle wax | MSG glovebox; Saffire flew in the **Cygnus cargo ship**, giving large samples (~40×94 cm) |
| **Prevention – gas flames / flammability limits** | ACME: BRE (PSI-20), CLD (PSI-21), s-Flame (PSI-23), Flame Design (PSI-10), CFI-G (PSI-159), E-FIELD (PSI-22); SPICE (PSI-107), SLICE (PSI-106), PSI-60 | Methane, ethylene, propane, propylene, ethane, butane | CIR rack (ACME); MSG (SPICE/SLICE) |
| **Suppression** | FLEX (PSI-69), FLEX-2 (PSI-68), CFI (PSI-39), PSI-117, PSI-142 | Liquid droplets: methanol, heptane, octanes, dodecane | CIR + MDCA droplet apparatus |
| **Detection** | SAME (PSI-102), SAME-R (PSI-101), DAFT/DAFT-2 (PSI-47), PSI-115 (model) | Smoke from heated Kapton, Teflon, silicone, lampwick, Pyrell; DAFT used test dust | Smoke/dust instruments (P-Trak, DustTrak) |

## 3. What the experimental tables contain

Each table is a list of tests with their **conditions** (inputs) and, for some, **results** (outputs). This is the closest thing to a ready-made dataset.

| Table | Rows | Conditions (inputs) | Results (outputs) |
|---|---|---|---|
| FLEX (PSI-69) | 274 | fuel, pressure, O₂ / CO₂ / He fractions, droplet size | extinction diameter, burning rate, burn time, **how the test ended** (Extinction 186 / Disruption 61 / Completion 27) |
| SPICE (PSI-107) | 469 | fuel, nozzle size, fuel rate, air speed | (results are in raw data) |
| CFI-G normal + inverse (PSI-159) | 179 + 154 | fuel, O₂ fraction (**up to 0.85**), pressure 0.5–3.3 bar | ignited yes/no, burn time, self-extinguished vs. flow terminated, peak temperature |
| Flame Design normal + inverse (PSI-10) | 207 + 120 | O₂ fraction, pressure, flows | adiabatic flame temperature (calculated) |
| BASS-II (PSI-25) | 129 | material, O₂ 13.6–22.2 %, air flow | O₂/CO₂/CO before and after |
| BASS (PSI-26) | 122 | material, shape, size | — |
| SAME-R (PSI-101) | 109 | material, airflow, smoke aging time | smoke result ratio (Rt/R0) |
| CFI (PSI-39) | 87 | fuel blend, O₂ 0.17/0.21, pressure 0.5–5 atm, helium | — |
| ACME BRE/CLD/E-FIELD/s-Flame | 18–32 each | test-day summaries: fuel bottle, O₂ levels | number of flames ignited |
| Saffire I/II/III | 2–15 | material, size, airflow, flow direction, O₂ ≈ 21.5–22 % | burn time, burn/spread length (Saffire-II) |
| SAME, DAFT, FLEX-2, SLICE, PSI-142 | 2–12 | short summaries | — |

### Key conditions in the data

- **Oxygen:** most tests use roughly normal air (~21%). The higher-oxygen tests that matter for the Moon (≥30%) are mainly in **CFI-G** (up to 85% in inverse flames), **Flame Design** (up to 40%), **ACME BRE** (up to 40%) and **FLEX** (up to 34%). BASS-II focused on *lower* O₂ (down to 13.6%) to find extinction limits.
- **Pressure:** ranges from about 0.5 to 3+ atm (ACME, CFI, FLEX). This is useful because a Moon base would use reduced pressure (~0.7 atm / 10.2 psi).
- **Airflow:** about 0–85 cm/s. In microgravity, airflow from fans replaces buoyancy, so it strongly affects whether something keeps burning.
- **Suppressants:** FLEX includes CO₂ (up to 0.7 mole fraction) and helium (up to 0.45). These are directly relevant to extinguisher design.

## 4. Data quality issues to expect

These tables were typed by hand and are not clean. Examples found:

- **Units mixed into values:** `"30 cm/s"`, `"0.27 mm"`, `"~ 21.5"`, `"22.1 to 22.0"`.
- **Multiple values in one cell:** `"21; 26.5; 40"` (ACME BRE O₂), `"0.5; 1.0; 1.5"` (FLEX-2).
- **Spreadsheet artifacts:** `"3400%"` should almost certainly be 34; `"40% CH5"` and `"O2 with N3"` look like auto-increment typos for CH4 and N2.
- **Inconsistent labels:** `Yes`/`yes`, `PMMA`/`pmma`, `75 % Propylene`/`75% Propylene`.
- **Placeholders:** `RAMPED`, `RAMP`, `-`, `n/a`, blanks. FLEX test #114 has a pressure of `0`, which is probably missing data.
- **Duplicates:** SPICE has 34 exactly duplicated rows.
- **Different column names for the same thing:** O₂ appears as `XO2`, `Oxygen`, `Percent O2`, `Calibrated initial O2 % by vol`, and in both fractions (0.21) and percentages (21).
- The **material/sample column mixes material, shape and size** in free text (e.g. `"200 micron PMMA film 2 cm wide"`).

Treat these as "to verify," not facts. Check the investigation's reports before correcting anything.

## 5. Good first questions to explore

1. **FLEX:** how does oxygen, CO₂ or helium level relate to *Extinction* vs. *Completion*? This is the strongest suppression dataset, with 274 tests and a clear outcome column.
2. **CFI-G:** in which oxygen/pressure combinations did ignition fail or flames self-extinguish? This is the main high-oxygen data.
3. **BASS-II:** how low can oxygen go before a material stops burning at a given airflow? This connects to material selection.
4. **SAME/SAME-R:** how do smoke results differ by material? This connects to detector design.
5. **Coverage gaps:** plot every test on an "oxygen vs. pressure" chart, colored by investigation. Empty areas show conditions that haven't been tested, such as Moon-base conditions (~30% O₂, ~0.7 atm).

## 6. Easy tools for this

- **Excel / Google Sheets / LibreOffice Calc:** open the CSVs directly. Use filters, pivot tables (e.g. count FLEX `Test end` by oxygen level), and scatter charts.
- **OpenRefine** (free): good for the cleanup issues above, such as merging `Yes`/`yes`, splitting `"30 cm/s"` into number + unit, and splitting multi-value cells.
- **The PSI website:** use each investigation's `url` from the catalog to read objectives, then open its *Reports* or *Presentations* folder to understand the columns.
- **Later, if you want:** Google Colab with pandas can combine all tables into one dataset. That isn't needed for a first look.

## 7. How the data was obtained (for repeating it)

The PSI site is a JavaScript app, but it uses a public JSON API:

- Search: `GET https://psi.nasa.gov/geode-py/ws/repo/search?size=500&ffield=Research%20Area&fvalue=combustion%20science`
- Investigation details: `GET https://psi.nasa.gov/geode-py/ws/repo/investigations/PSI-26`
- File list: `POST https://psi.nasa.gov/geode-py/ws/files/v2` with body `{"folder":"","fileType":"study","studyId":"PSI-26","version":4}`
- Download link: `GET https://psi.nasa.gov/geode-py/ws/studies/PSI-26/download?file=<file name>&redirect=false` returns a temporary S3 link.

The data is public under the CC0 license.

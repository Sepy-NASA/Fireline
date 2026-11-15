# DATA_ANAL — PSI Combustion Evidence vs. the Lunar Rover Cabin Material Review

**Use case supported:** *Mission Risk Canvas — section 4, "Inspect the strongest direct material records"*
**Scope:** Data analysis and interpretation only. This document is not a material certification, a hazard probability assessment, or a substitute for NASA-STD-6001 testing.

---

## 1. Executive summary

1. **The best direct material analogue in the entire PSI bundle is Saffire-II sample 2-5** — a large cotton-fiberglass (SIBAL) sample burned in microgravity at ~22.1% O₂ and 20 cm/s airflow, with the only cleanly tabulated numeric flame-spread rate (2.1 mm/s) for a rover-relevant material in the supplied data.
2. **The evidence gap to the rover scenario is real and quantified:** across all 22 experimental tables there are **zero tests at 30% O₂** (every solid-material test sits at or below 22.2% O₂ — a gap of at least 7.8 percentage points in the direction that increases flammability) and **zero tests at partial (1/6-g) gravity**.
3. **The closest tested condition to the rover atmosphere is not a material test at all:** ACME BRE (PSI-20) explicitly examined the NASA mission-design atmospheres of 14.7 psia/21%, 10.2 psia/26.5%, and 8.2 psia/34% O₂ — but with ethylene/methane gas flames on porous burners, never polymer coupons.
4. **Same material family ≠ same outcome:** silicone samples barely burned in microgravity yet burned completely in 1-g controls; SIBAL burn time differed ~6× between concurrent (420 s) and opposed (70 s) flow; PMMA burned out adjacent Nomex without igniting it. Geometry, flow direction, and configuration drive the result.
5. **No defensible numeric "risk match" can be computed from this bundle.** The honest, data-faithful product is a condition-coverage map, preserved source rows, and a register of the mission-specific tests still missing.

---

## 2. Rover design basis vs. tested conditions — the coverage matrix

| Parameter | Rover target (engineer-provided) | Saffire-II (PSI-99) | Saffire-I (PSI-98) | Saffire-III (PSI-100) | BASS-II (PSI-25) | Coverage verdict |
|---|---|---|---|---|---|---|
| **Oxygen** | **30%** | 21.5–22.1% | 21.5–21.7% | *not tabulated* | 13.6–22.2% (PMMA 14.2–22.2%, SIBAL 16.4–20.8%) | ❌ **Uncovered** — gap ≥ 7.8 pp |
| **Airflow** | unknown until design basis supplied | 20 cm/s | 20 cm/s | 30 cm/s | fan/display free text, not physical cm/s | ⚠️ **Analog-only** — Saffire-III is the only 30 cm/s data point |
| **Gravity** | **1/6 g** | ~0-g (Cygnus) | ~0-g (Cygnus) | ~0-g (Cygnus) | ~0-g (ISS/MSG) | ❌ **Uncovered** — no partial-gravity combustion data exists in this PSI bundle |
| **Pressure** | provisional 10.2 psia comparison point only | ~1 atm (Cygnus cabin) | ~1 atm | ~1 atm | ~1 atm (ISS) | ❌ **Uncovered** as a *tested material condition*; only BRE tested 10.2 psia, with gas fuel |
| **Material** | PMMA/acrylic + cotton-fiberglass textile | PMMA, PMMA/Nomex, SIBAL, silicone (9 samples) | SIBAL (2 large samples) | SIBAL (2 large samples) | 41 PMMA, 26 SIBAL, 3 Nomex, 59 other | ✅ **Material families matched**; exact grades/formulations unverified |

Every value in this table was computed or read directly from the files listed in §9. The "1/6 g" gap was additionally confirmed by a full-text search of the PSI scrap (`data/psi_scrap/`), which contains no lunar or partial-gravity content for any investigation.

---

## 3. Evidence tier 1 — direct solid-material records

### 3.1 Saffire-II (PSI-99) — the strongest direct material bridge

Source: `data/experimental-tables/PSI-99_Experimental table_SAFFIRE-2.csv` · accession PSI-99 · DOI 10.60555/2chp-m469

Nine samples, each 29 × 5 cm, burned in the Cygnus flow duct (concurrent flow unless noted). Percent O₂ is **derived from measured CO₂ production** referenced to the ISS-reported initial O₂ (Note 1) — it is a reconstruction, not a direct setpoint readout.

| Sample | Material | Thickness (as entered) | O₂ | Airflow | Ignition | Burn time | Tabulated low-g outcome | Data-quality flag |
|---|---|---|---|---|---|---|---|---|
| 2-1 | Silicone | 0.27 mm | ~21.5% | 20 cm/s | 80 W / 9.2 s | *Insignificant* | burn length ~0 | — |
| 2-2 | Silicone | 0.61 mm | ~22.1% | 20 cm/s | 80 W / 9.2 s | *Insignificant* | burn length ~0 | — |
| 2-3 | Silicone | 1.03 mm | ~22.1% | 20 cm/s | 80 W / 9.2 s | *Insignificant* | burn length ~0 | — |
| 2-4 | Silicone | `037 mm` (likely 0.37 mm — **verify**) | ~22.1% | 20 cm/s | 80 W / 9.2 s | *Insignificant* | burn length ~0 (opposed) | Thickness string garbled |
| **2-5** | **Cotton-fiberglass (SIBAL)** | `037 mm` (likely 0.37 mm — **verify**) | ~22.1% | 20 cm/s | 80 W / 9.2 s | **145 s** | **burn length 29 cm, spread 2.1 mm/s** | ✅ Cleanest numeric spread rate in the table |
| 2-6 | *(blank material field)* | `037 mm` | ~22.1% | 20 cm/s | 80 W / 9.2 s | 115 s | 29 cm, 2.6 mm/s | ⚠️ Material field empty; likely SIBAL — verify in report |
| 2-7 | PMMA & Nomex | 0.85 and 0.37 mm | ~22.1% | 20 cm/s | 80 W / 9.2 s | 140 s | PMMA portion fully consumed; **Nomex never ignited** (Note 2) | Layered configuration — not a bulk-material test |
| **2-8** | **PMMA** | *"See Fig. 5"* (not in row) | 22.1→22.0% | 20 cm/s | 97 W / 30 s | **600 s** | "~10 cm (Note 3)" = length of **significant visible damage**; spread field → "Note 4" | ⚠️ No clean numeric spread rate |
| **2-9** | *(blank; "1 cm" thick)* | 1 cm | 22.0→21.9% | 20 cm/s | 97 W / 30 s | **900 s** | "~10 cm (Note 4)" = **anchored flame** at sample base, regression **0.01–0.04 mm/s** | ⚠️ "~10 cm" is **not** a spread measurement |

**Engineering reading of the PMMA rows (2-8, 2-9).** Both PMMA rows point their spread-length field to Note 4, which describes an *anchored* flame with a very slow regression rate (0.01–0.04 mm/s). For 2-8 the "~10 cm (Note 3)" figure is explicitly the length of fuel with significant visible damage, not a measured spread length. **Neither row yields a defensible PMMA flame-spread rate at low gravity.** The report (not bundled in usable form here — see §9) must be consulted before quoting any PMMA number.

**Engineering reading of the SIBAL row (2-5).** This is the one row where the table itself delivers a complete, numeric observation: full-length burn (29 cm) at 2.1 mm/s concurrent spread, ~22.1% O₂, 20 cm/s. If the rover textile is a cotton-fiberglass blend of comparable areal density, this is a genuine **same material family** analogue — with formulation and thickness still to verify against the BOM.

**Bonus exhibits (use-case-consistent, previously unused):**

- **Buoyancy sensitivity — silicone 2-1 to 2-4:** all four silicone samples produced *insignificant* burning in microgravity, while the tabulated 1-g controls burned *completely* (2-1, 2-4) or 7.6 cm at 1.2 mm/s (2-2). A ready-made, table-native demonstration that removing buoyancy changes the verdict on a material.
- **Configuration effect — 2-7:** PMMA next to Nomex burned out completely while the Nomex layer did not ignite. Material *arrangement*, not just material *identity*, controls the outcome.

### 3.2 Saffire-I (PSI-98) — flow direction matters, at scale

Source: `data/experimental-tables/PSI-98_Experimental table_SAFFIRE-1.csv` · accession PSI-98 · DOI 10.60555/0t15-1z43

| Sample | Material | Size | Thickness | O₂ | Airflow | Ignition | Burn time | Direction |
|---|---|---|---|---|---|---|---|---|
| S1 | SIBAL fabric | 40.6 × 94 cm | 0.37 cm | 21.5–21.7% | 20 cm/s | 182 W / 8 s | **420 s** | Concurrent |
| S2 | SIBAL fabric | 40.6 × 94 cm | 0.37 cm | ~21.5% | 20 cm/s | 182 W / 8 s | **70 s** | Opposed |

Identical material, geometry, thickness, and flow speed — only the **flow direction** differed, and the burn time changed by a factor of **~6**. This is the cleanest single comparison in the bundle for the message *"airflow condition is not a footnote; it is the result."* Only two real sample rows exist (plus flow-visualization entries); no acrylic, no 30% O₂, no lunar gravity.

### 3.3 Saffire-III (PSI-100) — the only 30 cm/s material data point

Source: `data/experimental-tables/PSI-100_Experimental table_SAFFIRE-3.csv` · accession PSI-100 · DOI 10.60555/040q-4h36

Two SIBAL fabric samples, 40.6 × 94 cm, 0.33 cm thick, at **30 cm/s** (S1 concurrent, S2 opposed). The supplied table carries **no oxygen column and no outcome columns** — usable only as evidence that the Saffire family operated at two flow speeds, not as a result matrix.

---

## 4. Evidence tier 2 — material screening context (BASS / BASS-II)

### 4.1 BASS-II (PSI-25) — 129 solid-sample tests, lower-O₂ screening

Source: `data/experimental-tables/PSI-25_Experimental table_BASS-II.csv` · accession PSI-25 · DOI 10.60555/4qc4-de67 · MSG, 2014–2016

- **Material census (by row content):** PMMA **41** · SIBAL **26** · Nomex **3** · other (wax candles, wax/candle wake configs, misc.) **59**.
- **Oxygen coverage (calibrated initial O₂, 129 rows):** **13.6% – 22.2%** by volume.
  - PMMA tests: **14.2–22.2%** O₂.
  - SIBAL tests: **16.4–20.8%** O₂.
- **Geometry spread:** PMMA films 0.1–0.4 mm, slabs 1–5 mm, rods 6.4–12.7 mm ("1/4-inch" to "1/2-inch" clear/black rods); SIBAL films 1–2 cm wide.
- **What is genuinely useful:** the table includes *calibrated* gas-composition columns (initial/final O₂, CO₂, CO) — real, per-test atmosphere reconstruction, and evidence of extinction behavior at O₂ levels *below* air (down to 13.6%).
- **Boundaries (confirmed by inspection):** airflow fields are irregular free text mixing fan potentiometer settings, display readings, and occasional cm/s estimates — **not a clean numeric flow matrix**. Several rows contain embedded notes ("ext", "blowoff", "no ign at any flow"). One row (Miller M3) shows a corrupted O₂ entry ("223"). No 1/6-g, no 30% O₂, no rover-pressure control.

### 4.2 BASS (PSI-26) — a material/geometry index, not a result matrix

Source: `data/experimental-tables/PSI-26_Experimental table_BASS.csv` · accession PSI-26 · DOI 10.60555/58h4-dy80

122 rows listing date/GMT/test/sample/material only — PMMA spheres and slabs, SIBAL 1–2 cm, Nomex blend and Nomex III, Ultem sheet, Japan-wax and paraffin candles, wake-ignition configurations. **No condition or outcome columns.** Use for discovery and material taxonomy; never quote it as a flammability result.

---

## 5. Evidence tier 3 — atmosphere and mechanism context (different fuel)

### 5.1 ACME BRE (PSI-20) — the closest tested atmosphere to the rover, in the wrong fuel phase

Source: `data/experimental-tables/PSI-20_Experimental table_ACME BRE.csv` · accession PSI-20 · DOI 10.60555/vb93-3y72

- The cataloged investigation objective explicitly names the NASA-considered exploration atmospheres: **14.7 psia / 21% O₂ · 10.2 psia / 26.5% · 8.2 psia / 34%** — the 10.2 psia point sits at the rover's provisional pressure.
- The daily-summary table records 17 burning days (Feb 2019 – Jan 2021+) on 25 mm and 50 mm porous burners with 100% or 50% ethylene, plus methane days; tested O₂ levels: **21, 25, 26.5, 34, 40%** (two typo'd entries "3400%" and "2100%" correspond to 34% and 21%). Flames-ignited counts per day run 6–21.
- Notes state chamber pressures were varied but are **not identified** in the summary table — per-test pressure must come from the source reports.
- **Hard boundary:** gaseous ethylene/methane flames on a porous burner emulate condensed-phase *burning-rate* behavior; they are **not polymer coupon flammability tests** and cannot establish a PMMA or textile limit at 30% O₂.

### 5.2 ACME CFI-G (PSI-159) — high-O₂ gas-flame mechanism context

Source: `data/experimental-tables/PSI-159_Experimental table_CFI-G_Normal Flames.csv` and `..._Inverse Flames.csv` · accession PSI-159 · DOI 10.60555/cyt1-kh64

- **Normal flames:** 179 rows, ambient O₂ mole fraction **0.180–0.400**, pressures ~0.5–4 bar (per-row "approx p"), ethane and other light fuels, with hot-ignition, burn-time, and self-extinction/flow-termination fields.
- **Inverse flames:** 154 rows, O₂ at the oxidation side up to **0.85** — the 85% headline value comes from the O₂-fed burner stream of an *inverse* flame, not from a habitable-volume atmosphere.
- **Hard boundary:** gas-phase diffusion-flame research (cool flames, ignition, extinction). **Not material qualification evidence**, and the 85% value is a burner condition, never a habitat recommendation.

---

## 6. Adjacent branches (clearly fenced off from the material question)

### 6.1 Suppression — FLEX (PSI-69)

Source: `data/experimental-tables/PSI-69_Experimental table_FLEX.csv` · accession PSI-69 · DOI 10.60555/mbq8-0451

274 liquid-droplet tests: **157 methanol, 117 heptane**. Outcome distribution verified row-by-row and matching the data notes exactly: **186 Extinction / 61 Disruption / 27 Completion**. Columns include ambient pressure (mmHg), initial N₂/CO₂/He mole fractions, initial droplet diameter, extinction diameter, burning rate, and burn time. This is the evidence base for a **separate suppressant-effectiveness branch** (CO₂ vs. He dilution) — it does not establish solid-material flammability limits and must not be mixed into the material-screening canvas except as an explicitly labeled follow-up.

### 6.2 Detection — SAME (PSI-102), SAME-R (PSI-101), DAFT/DAFT-2 (PSI-47)

- **SAME** (`PSI-102_Experimental table_SAME.csv`): per-sample smoke-generation runs (e.g., Teflon, Kapton) with airflow, weight-loss rate, and aging durations — smoke particle growth under low-gravity transport.
- **SAME-R** (`PSI-101_Experimental table_SAME-R.csv`): reflight with sample-type/session structure (Kapton etc.), inlet velocity and aging schedule fields.
- **DAFT/DAFT-2** (`PSI-47_Experimental table_DAFT.csv`): feasibility sessions qualifying a *modified P-Trak* condensation counter against **Arizona road dust aerosol in ISS N₂** — a measurement-feasibility study, not a lunar smoke-alarm qualification.
- **Boundary:** detection evidence informs rover smoke-alarm nuisance/alarm-response discussions. It is **not material flammability evidence**.

---

## 7. Evidence-gap register — parameter by parameter

Each gap maps to one next engineering action (mirrors use-case §6, now with data provenance):

| # | Parameter / item | Status in this PSI bundle | Strongest available evidence | Next engineering action |
|---|---|---|---|---|
| 1 | **1/6-g material flammability** | ❌ No partial-gravity combustion data anywhere in the bundle (scrap-verified) | Microgravity (~0-g) Saffire/BASS rows bound the problem from below; 1-g tabulated controls bound it from above | Treat 1/6 g as an uncovered condition; support/planning for LUCI / FM2-class partial-gravity tests |
| 2 | **30% O₂ material test** | ❌ All solid-material tests ≤ 22.2% O₂ | Saffire-II at 21.5–22.1% (nearest) | Mission-specific screening at 30% O₂ per NASA-STD-6001 under the signed design basis |
| 3 | **Rover pressure as a test condition** | ❌ ~1 atm for all material tests | BRE *objective* names 10.2 psia/26.5% — but gas-fuel only, per-test pressure not in table | Pull BRE raw-data pressure logs (file inventory) before any pressure claim |
| 4 | **Rover airflow** | ⚠️ Unknown input; Saffire family tested 20 and 30 cm/s only | Saffire-I concurrent-vs-opposed (6× burn-time change) | Confirm fan/ventilation range from design basis; compare against 20–30 cm/s tested envelope |
| 5 | **PMMA formulation/thickness identity** | ⚠️ "PMMA" rows exist (Saffire-II 2-8/2-9; BASS-II films/slabs/rods) but no grade traceability | Saffire-II 2-8 (flat PMMA, thickness deferred to Fig. 5) | Confirm exact grade, coating, laminate from BOM; treat rows as **analogue only** until then |
| 6 | **PMMA low-g spread rate (numeric)** | ⚠️ Blocked by Note 3/Note 4 in the Saffire-II table | 2-9 anchored-flame regression 0.01–0.04 mm/s (anchored, not free spread) | Retrieve and review the Saffire-II final report and Fig. 5 before quoting any number |
| 7 | **Cotton-fiberglass identity** | ✅ SIBAL rows with numeric spread (2-5: 2.1 mm/s); ⚠️ row 2-6 material field blank, 2-5 thickness garbled | Saffire-II 2-5; Saffire-I S1/S2 | Verify `037 mm` → 0.37 mm and the blank 2-6 material field in the source report |
| 8 | **Suppression / detection extension** | ✅ Present but separate | FLEX 274 droplet tests; SAME/SAME-R smoke; DAFT counter qualification | Keep on dedicated branches; never merge into material-clearance logic |

**What this register is not:** it is not a probability, a score, or a clearance decision. It is the auditable list of what the data does and does not cover.

---

## 8. Visual representations — business pitch

All figures are generated directly from the source CSVs (script: figure-generation run, values traceable to the files in §9). Suggested placement: Fig. 1 as the anchor visual for the "Rover evidence gap" branch summary; Fig. 2 while inspecting Saffire-I/-II sample rows; Fig. 3 as the "condition coverage plot" handed off to the Visualize view.

---

### Fig. 1 — Condition coverage map (`figures/fig1_condition_coverage.png`)

**What it shows.** Every solid-material test in the PSI bundle placed on the two axes that matter most for the rover review — airflow velocity and oxygen concentration — with the rover's 30% O₂ target drawn as a red line across the top and the entire region above 22.2% O₂ shaded as uncovered territory. The Saffire-II, Saffire-I, and Saffire-III samples cluster tightly at ~21.5–22.1% O₂ and 20–30 cm/s; the 129 BASS-II solid-sample tests appear as an oxygen band spanning 13.6–22.2% whose airflow was never tabulated in physical units. The rover condition — 30% O₂, one-sixth gravity, airflow still to be confirmed from the design basis — sits alone in the red zone, far from any measurement.

**The pitch.** *"This one chart is the whole argument for mission-specific testing. Every material test NASA has flown in microgravity lives in the green zone near Earth-air oxygen. The moment we specify a rover cabin at 30% oxygen, we move into territory where no solid material has ever been tested under low-gravity conditions — not once, in thirteen and a half terabytes of archival data. The chart doesn't tell us the material is unsafe; it tells us, with audit-proof provenance, that no one has measured it. That is precisely the kind of visual a review board remembers, and it justifies the next test campaign without pretending we already know the answer."*

**Demo use.** When the engineer opens the Saffire-II node, this figure makes the mismatch visible in one glance: the amber PMMA markers and green SIBAL markers sit seven-plus oxygen points below the red star. Note also that the Saffire-III triangle at 30 cm/s is the bundle's only flow variation — and it carries no oxygen or outcome data in the tabulated export.

---

### Fig. 2 — Flow direction & buoyancy sensitivity (`figures/fig2_flow_direction_buoyancy.png`)

**What it shows.** Two side-by-side experiments-on-one-canvas. Left: identical SIBAL fabric at identical oxygen (~21.5%) and identical flow speed — but concurrent flow burned for 420 seconds while opposed flow burned for 70, a ~6× swing driven by nothing but flow direction, with Saffire-II's concurrent 29×5 cm sample (145 s) in between. Right: the four silicone samples from the same Saffire-II sample card — virtually zero burn length in microgravity, yet their 1-g controls were completely consumed (two of them fully, one to 7.6 cm at 1.2 mm/s). Same material, same igniter; remove buoyancy and the fire all but goes out.

**The pitch.** *"Before anyone asks whether the rover's acrylic is 'flammable,' this figure shows why that question has no single answer in space. On the left, the same fabric burns six times longer when the air flows with the flame instead of against it — airflow configuration is the result, not a footnote. On the right, a material that a standard Earth test would write off as a fire hazard becomes almost inert in microgravity — which means Earth screening data can silently over- and under-state risk in the vehicle. Both panels come from the same sample cards as the rows in our evidence table; nothing here is modeled. The message for the lunar rover: we must test in the configuration the rover actually flies — its gravity, its atmosphere, its flow field — or we are comparing apples to orbit."*

**Demo use.** This is the figure behind the use-case's "geometry/flow/configuration matter" boundary. It also showcases the table-native silicone µg-vs-1-g contrast, which no slide narration currently exploits. The asterisked "0.37* mm" thickness preserves the source's garbled `037 mm` entry as a visible verification flag rather than silently correcting it.

---

### Fig. 3 — Material × O₂ evidence matrix (`figures/fig3_material_o2_matrix.png`)

**What it shows.** All 914 test records in the bundle's key tables mapped as counts by investigation (rows, color-coded by evidence type: green solid-material, violet gas flames, blue liquid droplets, grey index-only) and oxygen band (columns), with the rover-relevant 27–34% band outlined in red. The picture is unambiguous: the solid-material mass (Saffire family, BASS-II) sits entirely at or below 22.2% O₂, while the 27–34% band contains only gas-flame experiments — 13 ACME BRE burner-summary records at 34% and 11 CFI-G records — plus 24 liquid-droplet FLEX tests, none of which is a material coupon. CFI-G's 219 records above 34% underline that the highest-oxygen work in PSI is gaseous flame physics, not habitation materials.

**The pitch.** *"This is our due-diligence exhibit: 914 test records, every one of them accounted for. Follow the red box — the oxygen range a lunar rover will actually live in — and you find experiments burning ethylene gas and fuel droplets, but not a single piece of solid material. Follow the green rows and you find real polymers and fabrics, but never above 22.2% oxygen. The two sets never intersect, and that intersection is exactly what the rover review needs. This matrix is how we convert 'the data can be overwhelming' into a defensible statement of coverage: we know precisely which cell of this map is empty, we can name the investigations that could fill it, and we can hand the review board the exact source tables behind every count."*

**Demo use.** Ideal for the "30% O₂ rover material evidence" branch summary and for the Visualize handoff. Every cell count is reproducible from the CSVs (BASS-II's one corrupted O₂ entry excluded and footnoted). It also pre-empts the "isn't there high-oxygen data?" question: yes — CFI-G's 219 records above 34% — and this figure simultaneously shows why they don't answer the material question.

---

## 9. Source appendix

### Files used (all under `data/`)

| Evidence | File |
|---|---|
| Saffire-II rows & notes | `experimental-tables/PSI-99_Experimental table_SAFFIRE-2.csv` |
| Saffire-I rows | `experimental-tables/PSI-98_Experimental table_SAFFIRE-1.csv` |
| Saffire-III rows | `experimental-tables/PSI-100_Experimental table_SAFFIRE-3.csv` |
| BASS-II test matrix | `experimental-tables/PSI-25_Experimental table_BASS-II.csv` |
| BASS sample index | `experimental-tables/PSI-26_Experimental table_BASS.csv` |
| ACME BRE daily summaries | `experimental-tables/PSI-20_Experimental table_ACME BRE.csv` |
| CFI-G normal/inverse flames | `experimental-tables/PSI-159_Experimental table_CFI-G_Normal Flames.csv`, `..._Inverse Flames.csv` |
| FLEX droplet tests | `experimental-tables/PSI-69_Experimental table_FLEX.csv` (latin-1 encoded) |
| SAME / SAME-R / DAFT | `experimental-tables/PSI-102_...csv`, `PSI-101_...csv`, `PSI-47_...csv` |
| Investigation metadata | `investigations-catalog.csv`, `investigations-detail.json`, `psi_scrap/raw/PSI-*.detail.json` |
| File inventory (13.5 TB context) | `file-inventory.csv` |

### Accessions & DOIs

| Investigation | Accession | DOI |
|---|---|---|
| SAFFIRE-II | PSI-99 | 10.60555/2chp-m469 |
| SAFFIRE-I | PSI-98 | 10.60555/0t15-1z43 |
| SAFFIRE-III | PSI-100 | 10.60555/040q-4h36 |
| BASS-II | PSI-25 | 10.60555/4qc4-de67 |
| BASS | PSI-26 | 10.60555/58h4-dy80 |
| ACME BRE | PSI-20 | 10.60555/vb93-3y72 |
| ACME CFI-G | PSI-159 | 10.60555/cyt1-kh64 |
| FLEX | PSI-69 | 10.60555/mbq8-0451 |

### Verification flags carried into the mock

1. Saffire-II thickness `037 mm` (samples 2-4, 2-5, 2-6) — likely 0.37 mm; **verify in report**.
2. Saffire-II "?-g" header garbling in the CSV export — verify gravity labels against the report.
3. Saffire-II 2-8 thickness deferred to "Fig. 5" — report required.
4. Saffire-II 2-6 material field blank — likely SIBAL; **verify**.
5. BASS-II Miller M3 O₂ entry "223" corrupted — exclude from statistics (excluded here).
6. ACME BRE "3400%"/"2100%" typos = 34%/21%; per-test chamber pressures not in the summary table.
7. The Saffire-II final report itself is **not** among the bundled Science Documents (only image nomenclature, merge-result workbook, objectives/status paper, and readme) — retrieval is an action item, not a click away.

### Figures

| Figure | File |
|---|---|
| Fig. 1 — Condition coverage map | `figures/fig1_condition_coverage.png` |
| Fig. 2 — Flow direction & buoyancy sensitivity | `figures/fig2_flow_direction_buoyancy.png` |
| Fig. 3 — Material × O₂ evidence matrix | `figures/fig3_material_o2_matrix.png` |

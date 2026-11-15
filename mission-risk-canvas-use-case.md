# Mission Risk Canvas use case: lunar rover cabin material review

## Purpose

This document defines a reviewable, data-grounded demo scenario for the **Analyze** view. It follows a NASA fire-safety engineer as they use the workspace to assess whether the available microgravity combustion evidence can inform material screening for a pressurized lunar rover.

The goal is not to have the system pronounce a material safe or unsafe. It is to help the engineer find the closest evidence, preserve the conditions under which it was collected, compare it with the rover design basis, expose the evidence gap, and identify the next engineering action.

## Scenario and engineering question

An engineer is preparing a fire-safety review for a **pressurized lunar rover**. The current concept assumes:

- lunar surface operations at approximately **one-sixth Earth gravity**;
- a cabin oxygen concentration of **30%**;
- cabin pressure and airflow to be taken from the current rover design basis (not yet supplied in the bundled PSI files);
- an interior materials list that includes a PMMA/acrylic component and a cotton-fiberglass textile, with exact grades, formulations, thicknesses, coatings, joints, and installation locations to be confirmed from the design package.

The engineer’s question is:

> **What PSI combustion evidence is relevant to the proposed rover cabin materials and atmosphere, what does it actually show, and what remains untested before the materials can be cleared for this use?**

This is a literature-and-data triage workflow, not a material certification, hazard probability calculation, or substitute for NASA-STD-6001 testing and mission-specific analysis.

### Inputs that come from the engineer

The mock should make the provenance of each input visible:

| Input | Demo value | Provenance / handling |
|---|---|---|
| Gravity | 1/6 g | Mission assumption supplied by the engineer. PSI combustion tables in this bundle do **not** contain lunar-gravity tests. |
| Oxygen | 30% | Rover scenario assumption supplied by the engineer. Preserve as an input, not an experimental result. |
| Pressure | Read from uploaded rover design basis | Do not silently infer. The task brief mentions ≤10.2 psia as an expected lunar-habitat context; use 10.2 psia only as a clearly marked **provisional comparison point** if the PDF has no approved value. |
| Airflow | Read from uploaded ventilation / fire-safety specification | Do not assume a value. Fan-driven airflow is especially important in microgravity; the rover’s 1/6-g flow field is not equivalent to the PSI microgravity setup. |
| Materials | Read from the uploaded bill of materials / cabin description | Normalize only when exact grade and formulation are stated. “PMMA” or “acrylic” is not enough to claim an exact formulation match. |

The rover PDF and bill of materials are **demo inputs to be supplied or mocked**. They are not present in `data/` and must not be represented as NASA source documents.

## What the supplied data can support

The bundled data contains a catalog of 24 investigations, 22 experimental tables, detail metadata, and a large PSI file inventory. It is a useful discovery and evidence-linking set, but the investigations use different fuels, geometries, apparatus, conditions, and measurements. A shared term such as “flammability” does not make their results directly interchangeable.

| Evidence | Source in `data/` | Useful for this review | Important boundary |
|---|---|---|---|
| **Saffire-II (PSI-99)** | `experimental-tables/PSI-99_Experimental table_SAFFIRE-2.csv` | The strongest direct material/large-sample bridge in the supplied tables. Rows include silicone, cotton-fiberglass (SIBAL), PMMA, and PMMA/Nomex; fields include airflow, oxygen, burn time, and burn/spread observations. | The tabulated oxygen is about 21.5–22.1%, not 30%. Airflow is listed as 20 cm/s. The table’s “?-g” headers are garbled in this export and should be checked against the report before treating each label as definitive. No 1/6-g test. |
| **Saffire-I (PSI-98)** | `experimental-tables/PSI-98_Experimental table_SAFFIRE-1.csv` | Two SIBAL fabric samples, 40.6 × 94 cm, ~0.37 cm thick, at 20 cm/s and ~21.5–21.7% O₂; burn time differs between concurrent and opposed flow. Useful for showing geometry/flow direction matter. | Only two actual sample rows plus flow-visualization entries; not an acrylic dataset, not 30% O₂, not lunar gravity. |
| **BASS-II (PSI-25)** | `experimental-tables/PSI-25_Experimental table_BASS-II.csv` | 129 rows with PMMA films/rods and other samples; oxygen is reported in the table and includes lower-O₂ screening. Useful for finding sample/material and oxygen-related records. | Oxygen is mostly in a lower/near-air range (the data notes report 13.6–22.2%). Airflow/fan fields are irregular free text, and this matrix is not a clean 1/6-g, 30%-O₂ rover comparison. Check source reports before interpreting ambiguous runs. |
| **BASS (PSI-26)** | `experimental-tables/PSI-26_Experimental table_BASS.csv` | 122 rows describing samples including PMMA, SIBAL, Nomex, spheres, slabs, and candles. Useful for material and geometry discovery. | The supplied table is primarily a sample/test list and does not provide a consistent numeric result matrix. |
| **ACME BRE (PSI-20)** | `experimental-tables/PSI-20_Experimental table_ACME BRE.csv` | Records candidate exploration oxygen levels in a gaseous-fuel burner study; notes include 21%, 26.5%, 34%, and 40% combinations. Useful as atmosphere-context evidence. | This is a daily summary of **ethylene gas flames**, not a polymer coupon test. Notes state chamber pressures varied but are not identified in the summary table. Do not use it to assert that PMMA burns at 30% O₂. |
| **Flame Design (PSI-10)** | `PSI-10` experimental tables | Oxygen/pressure/flow-dependent gaseous diffusion-flame measurements; may inform combustion-model context. | Gas flames are not solid-material flame-spread tests. Individual table entries include placeholders and need checking. |
| **CFI-G (PSI-159)** | `PSI-159` normal and inverse flame tables | High-oxygen gas-flame context: the tables include oxygen fractions up to 0.85, pressure, ignition, burn time, and self-extinction/flow-termination fields. | This is gaseous-fuel flame research, not a rover-material test. The 85% value is a tested chamber condition, not a habitat recommendation or an acrylic limit. |
| **FLEX (PSI-69)** | `experimental-tables/PSI-69_Experimental table_FLEX.csv` | 274 liquid-droplet tests with fuel, pressure, O₂/CO₂/He fractions, droplet size, burn time, burning rate, and test outcome. The data notes summarize 186 Extinction, 61 Disruption, and 27 Completion outcomes. Useful for a separate suppression branch. | Methanol/heptane and other liquid-droplet suppression tests do not establish solid-material flammability or rover material limits. |
| **SAME / SAME-R / DAFT** | PSI-102 / PSI-101 / PSI-47 tables | A later detection branch can connect smoke behavior, detector response, and dust discrimination to rover alarm nuisance risks. | Detection evidence is not material flammability evidence. DAFT’s dust aerosol is a measurement-feasibility study, not a lunar rover smoke-alarm qualification. |

The file inventory lists reports, science documents, presentations, and raw data, but almost all repository content is raw data. The demo should deep-link to PSI records and relevant report entries rather than imply that all 13.5 TB has been ingested or that every file is immediately interpretable.

## Engineer workflow in the Analyze view

### 1. Start a risk-review session

The engineer opens **Analyze** and creates a session named **Lunar rover cabin — material evidence review**. The initial root node is a research question, not an AI-generated risk score.

Suggested root-node text:

> Assess the PSI evidence relevant to PMMA/acrylic and cotton-fiberglass cabin materials for a lunar rover at 1/6 g and 30% O₂. Use the approved pressure and airflow from the attached design basis. Separate measured evidence from transfer assumptions and list the missing tests.

The center canvas shows this question as the root. The context card summarizes the stated conditions and identifies missing pressure/airflow fields until they are supplied.

### 2. Add mission documents and confirm extracted inputs

The engineer adds two external documents:

1. **Rover Cabin Design Basis.pdf** — cabin pressure, atmosphere control limits, fan/ventilation operating range, cabin layout, and hazard assumptions.
2. **Cabin Materials / BOM.pdf** — material trade names, grades/formulations, thicknesses, coatings, substrate layers, joints, and installation locations.

For the mock demo, the files can be simulated with seeded records and extracted fields. The app must label them **Engineer-provided document (mock upload)**, show the source page/section when available, and ask the engineer to confirm extracted values before using them.

The engineer confirms or edits:

- pressure and whether it is nominal, minimum, or emergency mode;
- oxygen range, including the 30% target and any transient upper bound;
- airflow range and direction near each material;
- exact PMMA formulation and thickness;
- exact textile specification and installation context;
- whether material layers, adhesives, or coatings are part of the risk question.

Each confirmed input becomes a mission-parameter or material node. Unconfirmed fields remain visibly **unknown**. The AI does not treat a PDF sentence as an experimental measurement.

### 3. Ask the agent to find PSI evidence

The engineer asks in the left chat panel:

> Find the closest PSI evidence for PMMA/acrylic and cotton-fiberglass in low-gravity fire conditions. Compare tested oxygen, airflow, sample geometry, and measured outcomes with the rover inputs. Add the best-matching investigations and datasets to this canvas. Do not infer a 1/6-g result from microgravity data.

The mock agent searches the locally indexed catalog, investigation details, and experimental tables. It returns evidence in ranked groups, with reasons rather than a probability:

- **Direct material match, different environment:** Saffire-II PMMA and SIBAL rows; oxygen around 22%, airflow 20 cm/s, sample geometry and tabulated burn observations.
- **Material screening context:** BASS-II and BASS PMMA/SIBAL/Nomex samples, with caveats about lower O₂ coverage, inconsistent condition fields, and limited outcome normalization.
- **Atmosphere context, different fuel:** ACME BRE’s candidate oxygen conditions including 30%-adjacent and higher-O₂ cases, explicitly marked as gaseous ethylene flames rather than polymer tests.
- **High-O₂ mechanism context, different fuel:** CFI-G, clearly labeled gas-flame data and not material qualification evidence.
- **Separate suppression evidence:** FLEX, offered only if the engineer wants to evaluate suppressants after the material branch.

The agent adds nodes for relevant investigations and datasets, places them around the question, and draws labeled links such as **material tested**, **condition context**, **different fuel**, and **suppression follow-up**. Each recommendation includes a click-through to the table or PSI record.

### 4. Inspect the strongest direct material records

The engineer selects the Saffire-II dataset node. The right panel should show the specific table evidence and preserve the original conditions. Examples available in the supplied table include:

- **Sample 2-5, cotton-fiberglass (SIBAL):** 29 cm × 5 cm sample, thickness entered as `037 mm` in the table (likely 0.37 mm, but verify), 20 cm/s airflow, ~22.1% O₂, 145 s burn time, tabulated burn length 29 cm and spread length 2.1 mm/s.
- **Sample 2-8, PMMA:** 29 cm × 5 cm, thickness referred to a figure rather than given in that row, 20 cm/s airflow, ~22.1–22.0% O₂, 600 s burn time, ~10 cm significant visible damage; the spread-length field points to a note rather than a clean numeric value.
- **Sample 2-9, listed as 1 cm thick:** 29 cm × 5 cm, 20 cm/s airflow, ~22.0–21.9% O₂, 900 s burn time. The table lists `~10 cm (Note 4)` in the burn-length field; Note 4 describes an anchored flame and very slow regression (0.01–0.04 mm/s), so verify the interpretation in the source report rather than treating `~10 cm` as a clean spread measurement.

These rows make a useful engineering observation: **the available Saffire-II table has material- and geometry-specific observations at near-air oxygen, not a validated 30% O₂ rover limit**. The SIBAL row is a stronger directly tabulated spread observation than the PMMA row; PMMA’s spread field has an unresolved note. The app must link the report and flag the note instead of inventing an exact spread rate.

The engineer can compare these with the uploaded BOM. If the rover acrylic is an exact PMMA formulation and comparable thickness, mark it **same material family; formulation/geometry still to verify**. If it is a different acrylic blend, coating, or laminate, mark it **analogue only**.

### 5. Create a “Rover evidence gap” branch

The engineer selects the mission node, PMMA node, SIBAL node, Saffire-II, BASS-II, and ACME BRE, then creates a branch called **30% O₂ rover material evidence**.

The branch’s right-panel summary separates three kinds of statements:

**Measured in PSI**
- Saffire-II has large-sample low-gravity material observations for PMMA and SIBAL near 22% O₂, at the airflow recorded in its table.
- BASS/BASS-II provide additional solid-sample context, with condition and outcome limitations.
- ACME BRE includes higher-oxygen gaseous ethylene flame tests, not polymer coupon tests.

**Mission inputs**
- Rover gravity is 1/6 g, as supplied in the design scenario.
- The oxygen target is 30%, as supplied by the engineer.
- Pressure and airflow come from the uploaded design basis or remain unknown.

**Transfer limitations / evidence gaps**
- No partial-gravity combustion dataset for 1/6 g is present in this PSI bundle.
- Saffire-II material tests are near 21.5–22.1% O₂, below the 30% target.
- Test geometry, material formulation, airflow, pressure, and ignition conditions must be compared before treating rows as relevant analogues.
- A gas-flame experiment cannot be used as a solid-polymer flammability threshold.
- A row labelled “PMMA” does not prove identity with the rover’s exact grade, coating, laminate, or installation.

The branch should not convert these gaps into a numeric fire probability or a “94% risk match.” The available files do not provide a calibrated rover-risk model or evidence to support such a percentage.

### 6. Decide the next engineering action

The agent proposes an evidence-backed action list, not a clearance decision:

1. Verify the rover’s pressure, atmosphere operating envelope, and fan-flow values against the signed design basis.
2. Confirm exact material formulations, thicknesses, coatings, and installed geometry from the BOM and supplier data.
3. Retrieve and review the Saffire-II final report for the PMMA spread-length notes and the table’s garbled gravity notation.
4. Compare the rover conditions against individual test rows, not only investigation-level summaries.
5. Identify the 30% O₂ / rover-pressure / rover-flow / 1/6-g combination as an **uncovered or weakly covered condition**, not a predicted failure.
6. Recommend mission-specific material screening or follow-on testing under approved conditions; do not label a material safe or unsafe based on these analogues alone.

The engineer saves the session and optionally sends selected investigation tables and report references to **Visualize** for a condition-coverage plot. The working set is the handoff list for a later analysis or review package.

## Recommended graph content for the demo

```text
Lunar rover material evidence review
├── Mission environment (engineer-provided)
│   ├── Gravity: 1/6 g [not represented in supplied PSI tests]
│   ├── Oxygen: 30% [target]
│   ├── Pressure: from design basis [unknown until confirmed]
│   └── Airflow: from ventilation spec [unknown until confirmed]
├── Rover materials (engineer-provided BOM)
│   ├── PMMA/acrylic [grade and thickness to confirm]
│   └── Cotton-fiberglass textile [spec to confirm]
├── Direct solid-material evidence
│   ├── Saffire-II (PSI-99) → PMMA / SIBAL rows and burn observations
│   ├── Saffire-I (PSI-98) → large SIBAL samples, ~21.5–21.7% O₂
│   ├── BASS-II (PSI-25) → solid samples / lower-O₂ screening context
│   └── BASS (PSI-26) → material and geometry index
├── Atmosphere context — different fuel
│   ├── ACME BRE (PSI-20) → elevated-O₂ ethylene burner summaries
│   └── CFI-G (PSI-159) → high-O₂ gaseous flames, not material tests
└── Follow-up branch (optional)
    ├── FLEX (PSI-69) → liquid-droplet suppression outcomes
    └── SAME / DAFT → detection and dust-vs-smoke context
```

Node color should identify the **type of evidence**, not a risk level: blue for mission inputs / investigations, amber for materials, green for datasets or measured results, violet for environment/context, and red only for explicit hazards or unresolved issues. Avoid a glowing red “high risk” result unless the app has a defensible, sourced risk model.

## Demo script (about 60–75 seconds)

**Engineer action:** open the seeded session, review the rover assumptions, and attach the mock cabin design basis and material list.

**Prompt:** “Find the closest PSI evidence for PMMA and cotton-fiberglass. Compare its oxygen, flow, geometry, and results with this rover design. Add the best evidence and show what is not covered.”

**Agent response:** the canvas fills with Saffire-II, Saffire-I, BASS/BASS-II, and the material nodes; ACME BRE and CFI-G appear in a separate atmosphere-context group. FLEX is available as an optional suppression branch, not presented as material evidence.

**Engineer action:** click Saffire-II and inspect samples 2-5 and 2-8/2-9. The right panel shows the original table values, report link, and a clear “~22% O₂; 20 cm/s; not 1/6 g or 30% O₂” comparison.

**Takeaway:** “We found a useful material analogue and an important coverage gap. The data does not qualify the rover material at 30% oxygen and one-sixth gravity. It tells us which report to inspect and what mission-specific test conditions we still need.”

## Replace / correct the current slide narration

The current draft says the agent “flags a 94% risk match” and that “a specific acrylic polymer exhibits rapid flame spread under Lunar airflow conditions.” Neither statement is supported by the supplied files. The PSI bundle has no lunar-gravity material test, no calibrated rover-risk percentage, and no PMMA result at the stated 30% O₂ rover conditions.

Suggested data-faithful narration:

> “Let’s walk through a real engineering scenario. We’re reviewing materials for a pressurized lunar rover designed for one-sixth gravity and 30% oxygen. We add the rover’s design basis and cabin materials list, then ask the agent to find the closest PSI evidence. It links Saffire-II’s PMMA and SIBAL tests, BASS material studies, and separate high-oxygen gas-flame investigations. The strongest direct material table shows Saffire-II observations near 22% oxygen and 20 centimeters per second of airflow—not the rover’s 30% oxygen, and not one-sixth gravity. The canvas makes that mismatch visible, preserves the source rows, and shows the next question for engineering: what mission-specific test closes the gap?”

## Mock-specific behavior and boundaries

- There is no rover PDF or BOM in the supplied `data/` folder. Use clearly labeled demo fixtures or user-selected files; never imply NASA supplied those documents.
- For a mock upload, show extracted fields with source/page and require user confirmation. If real PDF parsing is not implemented, simulate extraction from a seeded fixture and label it as simulated.
- The assistant should return the exact PSI accession, experimental-table filename, sample/test identifier, and source link with every substantive statement.
- A “relevance” indicator may rank **retrieval relevance** (material match, condition overlap, outcome availability, source quality) if its components are transparent. It must not be displayed as probability of fire, safety certification, or an empirical percentage without a validated model.
- Keep measured data, engineer-provided assumptions, agent interpretation, and unknowns visually distinct in the graph and details panel.

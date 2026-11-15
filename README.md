# Fireline

<p align="center">
  <img src="social-preview.jpg" alt="Fireline — microgravity fire-safety insights" width="720" />
</p>

<p align="center">
  <strong>Microgravity fire-safety insights from NASA PSI data.</strong><br />
  A NASA Space Apps Challenge prototype for browsing, comparing, and explaining combustion research.
</p>

> [!WARNING]
> **Fireline is a hackathon mock/prototype.** It is not a NASA operational tool,
> a certified analysis product, or a source of engineering or safety guidance.
> The hosted GitHub Pages site is the same static mock: it has no production
> backend, live data ingestion, scientific-validation workflow, or guaranteed
> availability. Treat all generated summaries, rankings, connections, and UI
> interactions as demonstrations.

## What it demonstrates

Fireline organizes NASA Physical Sciences Informatics (PSI) microgravity
combustion investigations around fire prevention, detection, and suppression.

| View | Purpose |
| --- | --- |
| **Analyze** | A research workspace combining a deterministic, data-grounded copilot, an investigation graph, and a working set. |
| **Explore** | Search and filters for investigations, datasets, and files in the local index. |
| **Overview** | A coverage map of oxygen/pressure conditions, safety areas, and potential gaps. |
| **Visualize** | Configurable scatter, line, bar, and coverage-map views over indexed table samples. |
| **Flame VR** | WebXR/desktop playback of reconstructed PSI-159 CFI-G emission fields, synchronized with source previews and sensor traces. |

The copilot and **Connections** UI are deliberately simulated. The copilot uses
a deterministic intent router over the generated local index, while Connections
only demonstrates how external documents or data sources could appear in a
future product. Browser workspace state is stored in `localStorage`.

## Run locally

Requirements: Node.js 24 (the version used by the Pages workflow) and npm.

```bash
git clone https://github.com/Sepy-NASA/app.git
cd app/app
npm ci
npm run dev
```

Vite serves the frontend at `http://localhost:5173` by default. Useful commands:

```bash
npm run build        # rebuild data, type-check, and create a production bundle
npm run lint         # lint the frontend
npm run test:flame   # verify timing and reconstructed-field assets
npm run test:vr      # verify hand-interaction behaviour
```

## GitHub Pages

The [Pages workflow](.github/workflows/deploy-pages.yml) builds the static Vite
bundle after every push to `main` and deploys it to GitHub Pages. Its published
site is intentionally a **demo/mock** with the same local, bundled datasets and
simulated interactions as this repository. The development-only `/psi-api`
proxy is not a live data service on GitHub Pages.

## Data sources and provenance

The source material is NASA PSI combustion data, retained locally so the demo
can run as a static site:

- [NASA Physical Sciences Informatics — combustion search](https://psi.nasa.gov/physci/repo/search?q=combustion)
  supplies the investigation catalogue, investigation details, and experimental tables.
- [NASA Combustion Science](https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/)
  provides mission and investigation context.
- [A Researcher’s Guide to International Space Station Combustion Science](https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/)
  is supporting scientific context.
- [PSI-159 / ACME CFI-G source folder](https://drive.google.com/drive/folders/1WIvup-SYEZczCj3ah7J99Y7SQdwymBHC)
  is the documented source for the raw sensor CSVs and INTNS archives used by
  the optional Flame VR reconstruction workflow.

The included source extracts live in:

```text
data/investigations-catalog.csv       # investigation-level PSI catalogue
data/investigations-detail.json       # objectives, methods, publications, and context
data/experimental-tables/*.csv        # experiment/test-condition tables
data/psi-159-drive/                   # locally retained PSI-159 support data, when available
```

The project’s investigation list and links are documented in
[about-data.md](about-data.md) and [data-links.md](data-links.md). Source data
and the manual taxonomy remain distinct: the taxonomy is an interpretation for
this prototype, not an additional NASA dataset.

## How the data is processed

`app/scripts/build-data.mjs` creates the frontend’s static index at build time.

1. It parses the local catalogue CSV, investigation JSON, and experimental-table CSVs.
2. It detects oxygen, pressure, and airflow columns using their headers; parses
   multi-value cells; skips placeholders such as `N/A`, `RAMP`, and `EXTINCT`;
   and normalizes oxygen fractions/percentages plus pressure values in mmHg or
   bar to the displayed units. The handling of outliers is explicit (for
   example, `3400%` is treated as `34%`).
3. It computes per-table and per-investigation condition ranges, test counts,
   and data-quality flags for duplicate rows, packed values, placeholders, and
   missing values. For bundle size, chart data is an evenly spaced sample of at
   most 250 rows per source table.
4. It joins the result with the hand-curated taxonomy in
   `app/scripts/curated.mjs`: safety category, fuel/material, equipment,
   platform, target environment, incident links, and rationale.
5. It assigns a transparent heuristic relevance score and writes typed static
   modules to `app/src/generated/` for the graph, search, overview, and charts.

The app rebuilds this index during `npm run dev` and `npm run build`.
Generated files are outputs — edit the raw files or curation source instead.

## Flame VR: measured-data reconstruction, not a physics simulation

Flame VR contains no physical, transport, chemistry, temperature, or predictive
flame simulation. It visualizes an **axisymmetric reconstruction of measured
PSI-159 ACME CFI-G INTNS camera data**:

1. `app/scripts/build_flame_data.py` reads the NASA INTNS archives and matching
   sensor CSVs when they are available locally. The raw archives are not
   redistributed by this project.
2. It puts every source exposure on a shared camera grid, estimates the dark
   field using the recorded dark frames, preserves the acquisition timestamps,
   and aligns the raw sensor time series to that clock.
3. It applies documented masks and reconstructs a radial emission field with a
   non-negative, spatially regularized Abel fit. Data hidden by hardware,
   saturation, or a limited view are marked as inferred; they are not independent
   3D measurements.
4. The output is a gzip-compressed sequence of 128×64 linear float16 emission
   fields with provenance and quality metadata. The browser streams the fields,
   ray-marches them in WebGL/Three.js, and displays source-frame previews and
   sensor traces at the same time position.

The display palette, exposure, absorption, and scale are visualization controls.
They do not establish absolute radiance, temperature, chemistry, extinction
limits, or engineering predictions. See the detailed
[PSI-159 reconstruction notes](app/scripts/psi159/README.md). For HOBJ camera
files contained in a raw archive, use the
[HOBJ-to-VR importer](app/scripts/README.md).

## Repository map

```text
.github/workflows/  GitHub Pages deployment
app/                React/Vite frontend and data-build scripts
data/               local PSI source extracts
metadata/           supporting metadata
notebooks/          analysis notebooks
about-data.md       investigation/source list
data-links.md       external NASA resource links
social-preview.jpg  GitHub repository social-preview image
```

## Scope and attribution

Fireline was created for a hackathon and is not affiliated with, endorsed by,
or maintained by NASA. NASA PSI records and documents remain the authoritative
source for their data, context, and licensing. Verify findings against the
original PSI record and the underlying research before using them in any
scientific, operational, or safety decision.


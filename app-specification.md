# Fireline — current application specification

## Status and purpose

Fireline is a **static hackathon mock/prototype** for exploring NASA Physical
Sciences Informatics (PSI) combustion research. It helps a reviewer browse
bundled investigations, connect selected evidence on a visual canvas, compare
table values, and inspect a measured-data reconstruction in 3D/XR.

It is not a NASA operational system, an engineering/safety decision tool, or a
scientifically validated predictive model. GitHub Pages publishes the same
static demonstration as a local production build.

## What is included

| Area | Current behaviour |
| --- | --- |
| Navigation | Four bookmark views: **Analyze**, **Explore**, **Visualize**, and **Flame VR**. Hash links can open a view directly (for example `#vr`). |
| Analyze | Local review sessions with a React Flow canvas, graph nodes and edges, branches, node tooltips/details, and a cross-view working set. A fresh session begins by defining a review goal; the first launch seeds a lunar-rover demonstration session. |
| Tracer copilot | A deterministic, scripted intent router for the rover demo. It displays a thinking/streaming treatment, highlights nodes, creates selected graph changes, and links to Explore or Visualize. It is **not** an LLM, retrieval system, or external agent. |
| Connections | A mock dialog that adds representative external-source nodes. It can preview and confirm only recognised demo PDF names; it does not parse arbitrary PDFs, connect accounts, call MCP servers, or upload data to a backend. |
| Explore | Search and facet filters over the bundled investigation index, 22 experimental tables, and a lazy-loaded local file inventory. Users can preview bundled tables, add datasets/files to the working set, add them to Analyze, or open a PSI investigation/download link. |
| Visualize | Scatter, line, bar, and coverage-map templates over indexed table samples, plus fixed rover-evidence and evidence-figure views. Charts are exploratory summaries, not a cross-investigation statistical model. |
| Flame VR | Desktop WebGL plus optional WebXR VR/AR playback of PSI-159 INTNS reconstruction fields. It supports experiment switching, timestamp-based playback, camera-frame and sensor context, visual display controls, and controller/hand interactions when the headset/browser exposes them. |

There is **no separate Overview view**. The former coverage/overview concept is
implemented as the Coverage map, Rover evidence, and Evidence figures templates
inside Visualize.

## Data and processing

The build reads local source extracts from `data/` and runs
`app/scripts/build-data.mjs`. It creates typed static modules for the search
index, graph, condition ranges, relevance reasons, file inventory, and chart
samples. The pipeline normalizes selected oxygen, pressure, and flow columns;
keeps explicit data-quality flags; and limits chart samples to 250 rows per
source table. The curated taxonomy is project interpretation, not a NASA
dataset.

The app bundles the experimental tables and inventory used by its interface.
Explore can form direct public PSI file links. During `npm run dev`, the Vite
`/psi-api` proxy can resolve temporary PSI download URLs for eligible previews.
GitHub Pages has no proxy or backend, so such CORS-dependent previews are not
available there; bundled data and ordinary PSI links remain available.

To keep the Git repository and static deployment small, the bundled dataset is
**mostly mocked, compact demonstration data**. It combines limited
PSI-derived catalogue/index extracts with representative static UI records.
Large raw PSI materials — including camera images, videos, complete sensor
CSVs, and ZIP archives — are deliberately not versioned; the linked PSI
records and `download_psi.py` are the route to the original source files.

`app/scripts/download_psi.py` is a separate command-line utility, not a UI
service. It queries the public PSI API to save a catalog, investigation metadata
and file inventory locally; an explicit `--download` filter is required before
it downloads any binary source file.

## Flame VR data model and limitations

Flame VR renders `public/psi159/<test>/lut.f16.gz`: a time sequence of 128×64
float16 relative-emission fields reconstructed from PSI-159 intensified-camera
(INTNS) frames. `build_flame_data.py` applies the documented camera mask and
dark-field treatment, preserves acquisition timestamps, and uses a nonnegative,
spatially regularized Abel reconstruction. Hidden, saturated, and unobserved
regions can be inferred by a spherical prior and are marked in quality metadata.

The Three.js renderer ray-marches those fields. Palette, exposure, absorption,
gamma, threshold, volume scale, and camera controls only change presentation.
There is no fluid, transport, combustion, chemistry, thermal, or predictive
simulation, and no absolute radiance or temperature claim. The optional
`hobj_to_vr_volume.py` importer produces the same field format from HOBJ/TIFF
camera images; its OBJ is an inspection isosurface, not a physical flame mesh.

## Technical architecture

- React 19, TypeScript, Vite 8, and Tailwind CSS 4.
- Radix UI primitives and project-local shadcn-style components.
- Zustand persistence for sessions, selected view, and working set in browser
  `localStorage` (`fireline-rover-demo-v2`). There is no database, server-side
  account, collaboration, or cloud sync.
- `@xyflow/react` for the Analyze canvas; Recharts for charts; Three.js for the
  Flame VR renderer and WebXR integration.
- The VR bundle is lazy-loaded so the regular workspace does not load Three.js
  initially.

## Explicit non-goals

- Live PSI ingestion or background synchronization in the published app.
- Real AI chat, semantic retrieval, external MCP integration, or arbitrary PDF
  extraction.
- Scientific validation of cross-study comparisons, safety scoring, or mission
  recommendations.
- A physical/predictive flame model or validated headset ergonomics.
- A guarantee that third-party PSI files, previews, or signed links remain
  available.

## Local development and deployment

Run from `app/`:

```bash
npm ci
npm run dev
npm run build
npm run test:flame
npm run test:vr
```

The Pages workflow builds the static Vite bundle when `main` is updated. It
does not publish local PSI downloads or raw INTNS archives. See
[README.md](README.md) for source provenance, processing detail, and the
associated scripts.

# Fireline — microgravity combustion fire-safety workspace

A mock, SI-powered web dashboard for **NASA Space Apps 2026**: summarize, rank, and interpret NASA PSI
microgravity combustion investigations to support fire-safety research for spacecraft, stations,
lunar/Martian bases, and pressurized rovers.

Built for the hackathon with a static frontend and browser state persisted to `localStorage`.
Flame VR includes full-rate measured INTNS reconstruction, a reduced transport solver and scientific regression checks.

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS v4 (black + NASA-blue theme), shadcn-style UI primitives
- `@xyflow/react` for the neo4j-like graph canvas
- Recharts for chart templates; hand-rolled SVG for the O₂×pressure coverage map
- Zustand (persisted) for global state — sessions, canvas, working set, cross-view selection

## Views (bookmarks)

| View | Purpose |
|---|---|
| **Analyze** | Default. Three-pane workspace: copilot chat (left) · graph canvas with session context card (center) · add-to-canvas palette / node details (right). Sessions, branches, mock Connections ("Add data"). |
| **Explore** | Search engine over the indexed data. Facet filters (safety area, context, file type, category), three result tabs (Data / Investigations / Files), selection into the Working Set. |
| **Overview** | Executive knowledge map: O₂×pressure coverage with the lunar-base window, safety-area posture, gaps, and the Working Set organizer. The Explore↔Overview pairing. |
| **Visualize** | Chart templates (scatter, line, bar, coverage map) over chosen datasets with axis mapping. |

## Running

```bash
cd app
pnpm install
pnpm dev          # runs the data build, then starts Vite (default :5173)
pnpm build        # rebuilds data, type-checks, builds production bundle
```

`pnpm dev` regenerates `src/generated/` from the raw PSI data in `../data/` plus the curated
knowledge in `scripts/curated.mjs`, then serves the app.

## Data pipeline

- `scripts/curated.mjs` — hand-curated domain knowledge (safety areas, fuels, hardware, environments,
  incidents, external sources, relevance rationale).
- `scripts/build-data.mjs` — parses `../data/*` (catalog CSV, detail JSON, 22 experimental tables),
  cleans messy cells (mixed units, multi-values, placeholders, typos like `3400%`), computes per-test
  O₂/pressure/flow ranges, transparent relevance scores, and emits typed modules into `src/generated/`.
- Everything the app displays comes from this index — including data-quality flags for unverified rows.

## Mock "SI" behavior

The copilot is a deterministic intent router over the real generated data: it answers fire-safety
questions with actual numbers, adds relevant investigation nodes to the canvas, highlights referenced
nodes (pulsing glow), attaches clickable chips and cross-view links. Connections simulates linking
external standards, documents, and a mock MCP datasource.

## Flame VR

### Hand controls (VR / AR)

Enable hand tracking in the headset, open your fingers, then point at an object
or bring your hand to its surface. Pinch your thumb and index finger to grab the
flame, a sensor panel or the camera preview. Move your hand to reposition it and
turn your wrist to rotate it. Pinch the same object with both hands to resize it
by moving your hands apart/together, or rotate it by turning the line between
your hands. Open your fingers to release. Tracking loss releases the object;
open your fingers before grabbing again.

The blue outline/cursor shows the target; green indicates a held object. Pinch
the buttons below the scene for play/pause, backward playback, flame size,
workspace reset and previous/next frame. Choose **Choose experiment** to see
each recording's oxygen, pressure, flow and burn conditions, with the current
experiment marked. The desktop experiment picker shows the same catalog.
Pinch the player heading to move or resize the playback panel itself.
Pinch and drag the timeline
below the buttons to scrub through the recording; release to keep it paused at
the selected time. The experiment name and parameters appear on the playback
panel, with no head-locked overlay above the scene. All controls use English.
Reset places the workspace in front of the
current head position, including seated use. Panel layouts survive test changes.

Sensor panels use one trace per channel with independent raw signal scales,
sample readouts and a synchronized time cursor. The thermocouple traces retain
their small signal values instead of sharing the fuel-flow scale. Readouts use
the nearest acquired sensor sample; missing samples break the plotted line.

Run gesture and manipulation regressions with `npm run test:vr`. Physical
headset verification remains necessary for tracking quality and comfort.

The viewer loads all 2017 / 1944 / 1829 INTNS exposures for A1/B1/C1, as linear
float16 emission fields. Playback, source previews and raw sensors share the
acquisition clock. `Source` switches between measured reconstruction and a
reduced spherical hot-ethane model computed in a worker.

Fixed geometry preserves flame growth. Masks, saturated exposures and
transients that cannot support an Abel reconstruction are marked as inferred.
The physical camera scale remains an estimate; the model does not claim
cool-flame chemistry or absolute radiance/temperature validation.

```sh
# Node 24 is used for the native TypeScript scientific tools.
npm run test:flame
# Python 3.11+ with NumPy/Pillow:
python3 -m pip install -r scripts/psi159/requirements.txt
python3 scripts/verify_vr.py
# Rebuild only when the NASA INTNS source archives are available:
python3 scripts/build_flame_data.py --raw-dir /path/to/archives
npm run calibrate:flame
# Export the same solver and fixed-clock comparison media:
node scripts/export-flame-model.mjs
python3 scripts/export_flame_preview.py
```

See [the reconstruction and model notes](scripts/psi159/README.md). The
notebook and media entry points use these canonical scripts. The comparison movie
at `../flame-simulation.mp4` shows emission projections on the real experiment
clock; it is not a headset recording. A physical Quest/AR check remains separate.

# Fireline — microgravity combustion fire-safety workspace

A mock, SI-powered web dashboard for **NASA Space Apps 2026**: summarize, rank, and interpret NASA PSI
microgravity combustion investigations to support fire-safety research for spacecraft, stations,
lunar/Martian bases, and pressurized rovers.

Built for the hackathon as an interactive mock — no backend, no tests, all state in the browser
(persisted to `localStorage`).

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

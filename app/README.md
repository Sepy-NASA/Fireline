# Fireline frontend

This directory contains the Vite, React, and TypeScript frontend for Fireline.
The repository-level [README](../README.md) is the source of truth for the
project overview, data provenance, mock/demo disclaimer, and VR methodology.

## Develop

```bash
npm ci
npm run dev
```

`npm run dev` rebuilds `src/generated/` from `../data/` before starting Vite.
Use `npm run build` for the production build, `npm run lint` for linting,
`npm run test:flame` for the reconstructed-field checks, and `npm run test:vr`
for interaction tests.

## Data build

`scripts/build-data.mjs` reads the local NASA PSI catalogue, investigation
details, and experimental-table CSVs from `../data/`. It joins those files with
the hand-curated domain taxonomy in `scripts/curated.mjs`, then emits typed
modules to `src/generated/`. Generated files should be rebuilt, not edited by
hand.

## Flame VR

Flame VR renders reconstructed PSI-159 CFI-G INTNS emission fields and aligns
them with source-frame previews and raw sensor traces on the acquisition clock.
It is a data visualization, not a physical or predictive flame simulation.
See [the reconstruction notes](scripts/psi159/README.md) for inputs,
assumptions, and limitations.

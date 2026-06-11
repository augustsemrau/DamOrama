# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dam-Orama is a single-player tactile flood-defence puzzle game in a rotatable diorama basin. The player places materials (sand, clay, stone) to protect houses from an incoming flood. The core loop is: **read terrain → build defence → release water → understand failure → retry (build preserved)**.

Authoritative document: **`dam-orama-spec-v0.5.md`** — gameplay-first spec covering play features, the three levels, the simulation contract, and acceptance criteria. (`dam-orama-spec-v0.4-mvp.md` is the superseded prior revision, kept for history.)

## Build & Development Commands

```bash
npm install          # Install dependencies (pinned versions)
npm run dev          # Vite dev server with HMR (localhost:5173)
npm run build        # Production build to dist/
npm test             # Run all tests once (vitest --run)
npx vitest run src/levels/solvability.test.js   # Run a single test file
```

## Tech Stack

Pure JavaScript ES modules (no TypeScript) · Three.js (pinned) · Vite · Vitest (node env, no jsdom needed). No physics engine, no frameworks, no WebGPU.

## Architecture

- **`src/core/`** — `Grid` (flat typed arrays: terrainHeight, materialHeight, waterDepth, materialId, occupancy; 128×128), `EventBus`, `Constants` (all tuning constants live here)
- **`src/sim/`** — `WaterSim` (virtual pipes, **fixed timestep** SIM_DT=1/60 ×2 substeps, head-limited emitter), `Erosion` (also records postmortem stats: maxSpeed, maxOvertop, erosionTotal)
- **`src/game/`** — `GameLoop` (build→flood→verdict; fixed-step accumulator; flood-start snapshot so retry preserves the build), `EditTools`, `Budget`, `UndoSystem` (sparse stroke diffs), `WinLoss` (averaged footprint depth), `Postmortem` (breach heuristic), `Progress` (localStorage stars), `FloodRunner` (headless flood for tests and tuning probes)
- **`src/levels/`** — `terrainKit.js` (composable slopes/carves/knolls/rim; carves compose by max-depth, never stacked), `level1/2/3.js` (terrain, source, budgets, reference solutions, designed-to-fail builds), `solvability.test.js`
- **`src/render/`** — `SceneBuilder`, `TerrainMesh` (event-driven updates only), `WaterMesh` (frame-driven during flood; **must call computeVertexNormals or Phong renders black**), `Houses`/`StoneBlocks`/`Beacon`/`SourceMarker`
- **`src/input/`** — `CameraControls` (custom orbit: RMB drag, wheel, Q/E/F), `PointerInput` (raycast against flat plane, not terrain mesh)
- **`src/ui/`** — `components.js` (all DOM overlay components), `styles.css`
- **`src/audio/`** — `SoundScape` (procedural Web Audio, no assets)

`window.__damorama` exposes `{gameLoop, grid, sim, budget, level}` for browser debugging/Playwright tests.

## The simulation contract (read before touching sim or levels)

1. **Fixed timestep, no frame-rate coupling.** `WaterSim.step()` advances exactly SIM_DT. Only `GameLoop.tick()` accumulates real time. v0.4 died by violating this.
2. **Deterministic.** No randomness in the sim path. Same build → same outcome.
3. **Tuning = making tests pass.** Never tune by screenshot. `FloodRunner.runFlood(level, {build})` is the wind tunnel; per-level solvability tests assert undefended-loses (in a watchable 4s..end window), reference-wins-within-budget, and each level's designed-to-fail build. Write a throwaway probe script against FloodRunner when retuning.
4. **Emitters are head-limited.** A source can only push water until backwater reaches `source.head` above its terrain — otherwise inflow beyond conveyance stacks a water tower.
5. **Erosion happens only where water flows over material.** The sand/clay identity is the threshold gap (sand 0.35 < trickle speed ~0.5-0.7 < clay 0.9): a marginal overtop notches sand into a breach but leaves clay untouched. EROSION_MIN_DEPTH must stay below overtop-film depth (~1mm).
6. **Walls get flanked.** Any wall whose crest stands above adjacent ground spills around its ends — terrain must offer anchor points (gorge sides, ridges, highlands) and reference walls must cover the full carve feather span.

## Key design decisions

- Stone = tall un-erodable material (no special-casing in the flux loop); water flows over it only if submerged
- Retry restores the flood-start snapshot bit-exact (build + budget) — erosion damage heals
- Smoothing is volume-conserving; remove refunds fully; undo restores exactly
- Houses are static sensor footprints on raised pads; pads make the trickle-vs-gush distinction land
- Stars = remaining budget *value* (clay ×3, stone ×15) vs per-level thresholds
- Postmortem: eroded > overtopped > unblocked, one beacon, no path tracing

## Testing

Tests co-located with source (`*.test.js`). The solvability suite is the design's regression armor — if a sim-constant change breaks a level, those tests catch it. Browser verification via Playwright MCP against `npm run dev` (use `window.__damorama`, freeze with `gameLoop.phase = 'hold'` for screenshots).

## Branch Context

- `main` — v0.3-era prototype
- `rework/v04` — v0.4 build (superseded; sim was frame-rate coupled)
- `rework/v05` — gameplay-first clean rebuild (current)

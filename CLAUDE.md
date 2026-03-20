# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dam-Orama is a single-player tactile flood-defence puzzle game in a rotatable diorama basin. The player places materials (sand, clay, stone) to protect houses from an incoming flood. The core loop is: **construct defence → release water → understand failure → retry instantly**.

Two key documents:
- `dam-orama-spec-v0.4-mvp.md` — authoritative gameplay spec (rules, materials, level data, scope boundaries)
- `docs/superpowers/specs/2026-03-20-dam-orama-v04-build-design.md` — technical build design (architecture, module structure, acceptance criteria)

## Build & Development Commands

```bash
npm install          # Install dependencies (pinned versions)
npm run dev          # Vite dev server with HMR (localhost:5173)
npm run build        # Production build to dist/
npm run preview      # Preview production build
npm test             # Run all tests once (vitest --run)
npx vitest run src/core/Grid.test.js   # Run a single test file
```

## Tech Stack

- **Pure JavaScript** ES modules (no TypeScript)
- **Three.js** (pinned version) — 3D rendering with WebGLRenderer
- **Vite** — build tool, targets `esnext`
- **Vitest** + **jsdom** — test runner and DOM environment

No Rapier physics in v0.4 MVP. No WebGPU renderer. No frameworks.

## Architecture

Layered architecture with a central grid and event bus for decoupling.

### Grid (central data store)

`src/core/Grid.js` — single source of truth. Flat typed arrays: `terrainHeight`, `materialHeight`, `waterDepth`, `materialId`, `occupancy`. No separate erosion buffer — erosion decrements `materialHeight` directly. All access through canonical accessors (`getSurfaceHeight`, `isBlocked`, etc.). **128×128 baseline**; 256×256 is stretch.

### EventBus

`src/core/EventBus.js` — tiny pub/sub connecting modules. Events: `phase-changed`, `terrain-changed`, `budget-changed`, `tool-changed`, `house-flooded`, `postmortem-ready`.

### Layers

- **`src/core/`** — Grid, Constants, EventBus
- **`src/game/`** — GameLoop (3-phase state machine), Level loader, Materials (property defs), EditTools (paint/smooth/remove operators), ResourceBudget, UndoSystem (sparse stroke diffs), WinLoss
- **`src/sim/`** — WaterSim (pluggable algorithm, CPU Virtual Pipes default), Erosion
- **`src/renderer/`** — SceneBuilder, TerrainMesh (updated on events only, not every frame), WaterMesh (updated every frame during flood), HouseVisuals
- **`src/input/`** — PointerInput (raycast against flat plane, not terrain mesh), CameraControls
- **`src/ui/`** — Toolbar, BudgetDisplay, PhaseControls, Postmortem
- **`src/levels/`** — Level JSON files

### Key design decisions

- **Stone = absolute impermeable wall cell** — water cannot enter, does not erode, cannot be smoothed
- **Terrain mesh is event-driven** — only updates on edit/erosion, not every frame
- **Water mesh is frame-driven** — updates every frame during flood phase only
- **Smoothing is volume-conserving** — total material before == after
- **Undo uses sparse stroke diffs** — not bounding-box snapshots
- **Postmortem is simple** — breach region + failure cause heuristic, no path tracing
- **Flood detection uses averaged footprint depth** — not single-cell threshold
- **Performance gate is milestone 1** — 128×128 must sustain 60fps before proceeding
- **No terrain excavation** — player only places material on top of fixed terrain
- **Quality locked at level load** — never changes mid-run

## Testing

Tests co-located with source (`*.test.js` next to `*.js`). No mocking framework. Run individual tests with `npx vitest run <path>`.

## Branch Context

- `main` — prior prototype (v0.3 era, different architecture)
- `rework/v04` — clean-room v0.4 MVP build (current)

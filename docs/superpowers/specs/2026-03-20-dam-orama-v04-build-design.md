# Dam-Orama v0.4 MVP — Build Design

This document captures the technical design decisions for building the v0.4 MVP vertical slice. It supplements `dam-orama-spec-v0.4-mvp.md` (the authoritative gameplay/scope spec) with implementation-level architecture.

## Approach

- **Clean-room build** on `rework/v04` branch — no code carried from `main`
- **Spec milestones in order** (6 milestones, each producing a testable checkpoint)
- **CPU-only water sim** through milestone 5; GPU path deferred to milestone 6
- **WebGLRenderer** (not WebGPU renderer) for MVP simplicity
- **No Rapier physics** — stone blocks are grid occupancy blockers, not rigid bodies
- **DOM overlays** for all UI — no framework
- **Desktop-first** input; touch compatibility deferred to milestone 6
- **Audio deferred** — spec lists audio priorities but does not gate MVP acceptance on them; add during milestone 5 tuning or post-MVP
- **Pin dependency versions** in package.json (exact versions, not ranges) per spec §12.4

## Module Structure

```
src/
├── main.js                    # Bootstrap, render loop, wiring
├── core/
│   ├── Grid.js                # Unified grid: terrain, water, material, erosion, occupancy
│   └── Constants.js           # Grid size, cell size, material IDs, thresholds
├── game/
│   ├── GameLoop.js            # 3-phase state machine (Construction/Flood/Resolution)
│   ├── Level.js               # JSON level loader, procedural terrain generation
│   ├── Materials.js           # Placement logic for sand, clay, stone
│   ├── ResourceBudget.js      # Budget tracking and refund on removal
│   ├── UndoSystem.js          # Construction-phase cell snapshots
│   └── WinLoss.js             # Flood evaluation + postmortem data
├── sim/
│   ├── WaterSim.js            # Facade: picks GPU or CPU backend
│   ├── WaterSimCPU.js         # Virtual Pipes SWE in JavaScript
│   ├── WaterSimGPU.js         # WebGPU compute shader backend (milestone 6)
│   └── Erosion.js             # Flow-based terrain erosion
├── renderer/
│   ├── SceneBuilder.js        # Three.js scene, camera, lights, OrbitControls
│   ├── TerrainMesh.js         # PlaneGeometry + vertex displacement from grid
│   ├── WaterMesh.js           # Water surface plane from grid
│   └── HouseVisuals.js        # House meshes + dry/flooded visual state
├── input/
│   ├── PointerInput.js        # Pointer events → grid coordinate painting
│   └── CameraControls.js      # OrbitControls wrapper, Q/E/F shortcuts
├── ui/
│   ├── Toolbar.js             # Material selector + brush size
│   ├── BudgetDisplay.js       # Remaining resource counters
│   ├── PhaseControls.js       # "Start Flood" / "Retry" buttons
│   └── Postmortem.js          # Breach highlight + failure label overlay
├── shaders/
│   └── water-sim.wgsl         # GPU compute shader (milestone 6)
└── levels/
    └── level-01.json          # "The Basin"
```

## Core: Unified Grid

`Grid.js` is the single source of truth for all cell-based data. It owns flat typed arrays:

| Buffer | Type | Per-cell | Purpose |
|--------|------|----------|---------|
| `terrainHeight` | Float32Array | 1 float | Base terrain elevation (read-only after level load) |
| `materialHeight` | Float32Array | 1 float | Player-placed material height on top of terrain |
| `waterDepth` | Float32Array | 1 float | Current water depth |
| `materialId` | Uint8Array | 1 byte | 0=none, 1=sand, 2=clay, 3=stone |
| `erosionDamage` | Float32Array | 1 float | Accumulated erosion (reduces materialHeight) |
| `occupancy` | Uint8Array | 1 byte | Bitmask: stone blocker, house footprint |

Grid dimensions come from the level JSON. Default for Level 1: 256x256 cells, cellSize 0.0625 (16 world units total).

All subsystems access grid data through typed accessors: `getTerrainHeight(x, y)`, `setWaterDepth(x, y, d)`, `getMaterialId(x, y)`, etc. Index = `y * width + x`.

## Water Simulation

**CPU-first.** `WaterSimCPU.js` is the only backend through milestone 5.

**Algorithm:** Virtual Pipes method (shallow water equations).

Each cell maintains 4 flux values (N/S/E/W) in a separate `Float32Array` owned by WaterSimCPU. Per substep:

1. Compute pressure head: `terrainHeight + materialHeight - erosionDamage + waterDepth`
2. For each cell, compute flux to each neighbor based on pressure difference
3. Clamp total outflux so it doesn't exceed available water volume
4. Apply net flux to update water depth in the grid
5. Compute velocity (for erosion) from net flux direction/magnitude

**Stability:** CFL condition limits effective timestep. 2–4 substeps per frame at 60fps (tuned in milestone 5).

**Water source:** During flood phase, `waterDepth` at source cells incremented each substep by `flowRate * dt`. Source position, radius, rate, duration from level JSON.

**Boundary:** Closed basin — flux clamped to zero at grid edges.

**Velocity buffer:** `Float32Array` (2 floats per cell, vx/vy) computed from net flux. Used by Erosion.js, not stored in Grid.

`WaterSim.js` facade exposes `init(grid)`, `step(dt)`, `reset()`. In milestones 1–5 it instantiates WaterSimCPU directly. Milestone 6 adds GPU detection.

## Erosion

`Erosion.js` runs after each water sim step. For cells with `materialHeight > 0`:

1. Compute flow speed from velocity buffer magnitude
2. If speed > `erosionThreshold` (from level JSON): apply erosion
3. Erosion rate depends on material: `erosionRateSand` (fast) vs `erosionRateClay` (slow)
4. Stone (materialId=3) does not erode
5. `erosionDamage` increases; effective material surface = `materialHeight - erosionDamage`
6. When erosionDamage >= materialHeight, material is fully eroded (cell cleared)

## Rendering

**Renderer:** Three.js `WebGLRenderer` with `antialias: true`. No post-processing.

**Camera:** `PerspectiveCamera` with `OrbitControls`. Constrained min/max distance and polar angle. Q/E snap 45 degrees, F recenters on basin.

**Terrain mesh:** `PlaneGeometry(16, 16, width-1, height-1)` matching grid resolution. Each frame, vertex Y positions set to `terrainHeight + materialHeight - erosionDamage`. Vertex colors: warm earth tones for dry cells, darker when waterDepth > 0 at that cell.

**Water mesh:** Second `PlaneGeometry`, same dimensions. Vertex Y = `terrainHeight + materialHeight - erosionDamage + waterDepth`. Vertices with `waterDepth < threshold` pushed below terrain to hide. `MeshPhysicalMaterial` with `transmission` or opacity for transparency.

**Houses:** Box geometries at level-defined grid positions. Two material states:
- Dry: warm, saturated colors (most visually prominent objects in scene)
- Flooded: desaturated, darkened

**Basin walls:** Four vertical planes around the 16x16 world perimeter. Textured or colored to sell the diorama/tabletop feel.

**Lighting:** `HemisphereLight` (warm sky, cool ground) + `DirectionalLight` for definition.

## Input

**PointerInput.js:** Listens to `pointerdown/move/up` on the Three.js canvas. On pointer events during Construction phase:
1. Raycast from camera through pointer position against terrain mesh
2. Convert hit point to grid coordinates
3. Depending on active tool mode:
   - **Paint:** Set materialId and increase materialHeight within brush radius (budget-checked)
   - **Smooth:** Average materialHeight across cells in brush radius (no budget cost)
   - **Remove:** Clear materialId and materialHeight within brush radius (refunds budget)
4. Trigger undo snapshot before first cell modification per stroke

Ignores pointer input during Flood and Resolution phases.

**CameraControls.js:** Wraps OrbitControls — RMB drag to orbit, scroll to zoom. Keyboard: Q/E rotate 45 degrees, F recenter. Active in all phases.

No gesture conflicts: LMB = build, RMB = camera. Always.

## UI (DOM Overlays)

All UI is plain HTML/CSS positioned over the canvas. No framework.

- **Toolbar.js** — Fixed bottom bar. Sand/Clay/Stone/Smooth/Remove mode buttons with active highlight. Brush size slider (`[` / `]` keyboard shortcuts).
- **BudgetDisplay.js** — Shows remaining sand volume, clay volume, stone block count. Updates on place/remove.
- **PhaseControls.js** — "Start Flood" button visible in Construction. "Retry" button visible in Resolution. Hidden during Flood.
- **Postmortem.js** — Appears in Resolution on loss: shows breach origin region, failure cause label (overtopped / eroded through), which house flooded first.

## Game State Machine

`GameLoop.js` manages three phases:

**Construction:**
- Grid is editable, water sim inactive
- Player places/removes materials, budget enforced
- Undo available (Ctrl/Cmd+Z)
- Transitions to Flood on "Start Flood" click

**Flood:**
- Grid locked, no edits allowed
- Water source active for `durationSec` from level JSON
- Water sim + erosion step each frame
- Flood detection checks water depth at house cells each frame
- After source stops: wait `settleTimeSec`, then transition to Resolution

**Resolution:**
- Sim paused
- WinLoss evaluates all house flood states
- Postmortem data generated and displayed
- "Retry" resets: fresh grid from level JSON, budgets restored, undo cleared, back to Construction

## Win/Loss & Postmortem

`WinLoss.js` tracks during flood phase:
- **Breach origin:** First grid cell where water crosses defense line toward houses
- **First flooded house:** First house where water depth at footprint cells exceeds flood threshold
- **Failure cause:** Overtopped (water over material crest without erosion) vs Eroded (material height reduced before water crossed)

During flood phase, also records the **max water depth path** — the sequence of cells forming the highest-depth connected path from source to breach. This is computed on transition to Resolution by tracing from breach origin back toward source following maximum waterDepth neighbors.

On Resolution, produces a postmortem object:
```js
{
  won: bool,
  breachCell: {x,y},
  maxDepthPath: [{x,y}, ...],   // source-to-breach trace for visualization
  firstFloodedHouse: id,
  failureCause: 'overtopped'|'eroded'
}
```

**Replay scrub** (5-second simulation replay) is a nice-to-have for milestone 5. If implemented, it requires a ring buffer of waterDepth snapshots (~1 snapshot per second × 5 seconds). The static postmortem (breach origin, max depth path, failure label) is the mandatory feedback; the scrub enhances it but is not required for the build to be acceptable.

## Undo System

`UndoSystem.js` operates during Construction only:
- Before each placement stroke, snapshot affected cells (bounding box of grid region)
- Stores: materialHeight, materialId, erosionDamage, occupancy for each cell in bbox
- On undo: restore all cells in most recent snapshot, refund budget
- Stack clears on transition to Flood phase

## Development Milestones

Following the spec's sequence:

**Milestone 1 — Module structure + water sim + camera**
- Project scaffold (Vite, package.json, index.html)
- Grid.js, Constants.js
- WaterSimCPU.js with Virtual Pipes
- SceneBuilder.js, TerrainMesh.js, WaterMesh.js
- CameraControls.js
- Level.js + level-01.json (terrain only, no houses yet)
- main.js wiring: load level → render terrain → manually trigger water → watch it flow
- Deliverable: interactive water toy with camera controls

**Milestone 2 — Game state machine**
- GameLoop.js (Construction/Flood/Resolution phases)
- PhaseControls.js ("Start Flood" / "Retry")
- Water source injection during flood phase
- Grid reset on retry
- Deliverable: can start flood, watch water, retry

**Milestone 3 — Materials and budgets**
- Materials.js (sand, clay, stone placement + smooth + remove modes)
- ResourceBudget.js
- PointerInput.js (raycast painting)
- Toolbar.js + BudgetDisplay.js
- UndoSystem.js
- Stone as occupancy grid blocker
- Deliverable: can build defenses with budget, undo, then flood test

**Milestone 4 — Houses and postmortem**
- HouseVisuals.js (house meshes from level JSON)
- Flood detection (water depth at house footprints)
- WinLoss.js + Postmortem.js
- Erosion.js
- Deliverable: full game loop with win/loss and failure explanation

**Milestone 5 — Tuning pass**
- Tune: flood duration, source rate, erosion rates, level geometry
- Tune: settle time, flood threshold, brush sizes
- Playtest readability and retry cadence
- Optional: replay scrub of last 5 seconds (nice-to-have; static postmortem is sufficient)
- Deliverable: a level that can be won and lost, where failure is readable

**Milestone 6 — Performance and platform**
- QualityManager.js: startup benchmark runs one sim step at each resolution tier (256, 192, 128), picks highest that sustains 60fps. Manual override via URL param (`?quality=low`).
- Quality tier selection at level load (locked for the run per spec §12.6)
- Optional WaterSimGPU.js + water-sim.wgsl if CPU can't hold 60fps at 256x256
- Touch-compatible input (build/inspect mode toggle)
- Mobile UI sizing (48px touch targets)
- Deliverable: runs acceptably on target platforms

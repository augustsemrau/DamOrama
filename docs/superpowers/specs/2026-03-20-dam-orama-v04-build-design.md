# Dam-Orama v0.4 MVP — Build Design

Technical design for building the v0.4 MVP vertical slice. Supplements `dam-orama-spec-v0.4-mvp.md` (authoritative gameplay/scope spec) with implementation decisions.

## Approach

- **Clean-room build** on `rework/v04` branch — no code carried from `main`
- **Spec milestones in order**, each with hard acceptance criteria
- **CPU-only water sim** — GPU path is post-MVP unless CPU fails milestone 1 perf gate
- **WebGLRenderer** (not WebGPU renderer)
- **No Rapier physics** — stone is grid-only
- **DOM overlays** for all UI — no framework, but with a tiny event bus for state
- **Desktop-first** input; touch deferred to milestone 6
- **Audio deferred** to milestone 5 or post-MVP
- **Pin dependency versions** in package.json (exact versions, not ranges) per spec §12.4
- **128×128 grid is the baseline**; 256×256 is an optimization stretch goal

## Module Structure

```
src/
├── main.js                    # Bootstrap + top-level wiring ONLY
├── core/
│   ├── Grid.js                # Unified grid with canonical accessors
│   ├── Constants.js           # Grid size, cell size, material IDs, thresholds
│   └── EventBus.js            # Tiny pub/sub for UI and game state
├── game/
│   ├── GameLoop.js            # 3-phase state machine with transition guards
│   ├── Level.js               # JSON level loader, procedural terrain generation
│   ├── Materials.js           # Material property definitions and rules
│   ├── EditTools.js           # Paint, smooth, remove brush operators
│   ├── ResourceBudget.js      # Budget tracking and refund on removal
│   ├── UndoSystem.js          # Sparse stroke diffs
│   └── WinLoss.js             # Flood evaluation + simple postmortem
├── sim/
│   ├── WaterSim.js            # Water simulation (pluggable algorithm)
│   └── Erosion.js             # Flow-based terrain erosion
├── renderer/
│   ├── SceneBuilder.js        # Three.js scene, camera, lights, OrbitControls
│   ├── TerrainMesh.js         # PlaneGeometry, updated only on edit/erosion events
│   ├── WaterMesh.js           # Water surface plane, updated every frame
│   └── HouseVisuals.js        # House meshes + dry/flooded visual state
├── input/
│   ├── PointerInput.js        # Pointer events → grid coordinate painting
│   └── CameraControls.js      # OrbitControls wrapper, Q/E/F shortcuts
├── ui/
│   ├── Toolbar.js             # Material selector + tool mode + brush size
│   ├── BudgetDisplay.js       # Remaining resource counters
│   ├── PhaseControls.js       # "Start Flood" / "Retry" buttons
│   └── Postmortem.js          # Breach region + failure label overlay
└── levels/
    └── level-01.json          # "The Basin"
```

### Module boundaries

- **`main.js`** is strictly bootstrap and wiring. It instantiates modules, connects them via EventBus, and runs the render loop. No game logic lives here.
- **`Materials.js`** defines material properties (erosion rates, permeability, placement rules). **`EditTools.js`** implements the brush operators that apply those properties to the grid.
- **`WinLoss.js`** reads grid state to evaluate outcomes. It does not own visual state — it emits events that `HouseVisuals.js` and `Postmortem.js` subscribe to.

## Core: Unified Grid

`Grid.js` is the single source of truth for all cell-based data. Flat typed arrays:

| Buffer | Type | Per-cell | Purpose |
|--------|------|----------|---------|
| `terrainHeight` | Float32Array | 1 float | Base terrain elevation (read-only after level load) |
| `materialHeight` | Float32Array | 1 float | Remaining player-placed material (decremented by erosion directly) |
| `waterDepth` | Float32Array | 1 float | Current water depth |
| `materialId` | Uint8Array | 1 byte | 0=none, 1=sand, 2=clay, 3=stone |
| `occupancy` | Uint8Array | 1 byte | Bitmask: stone blocker, house footprint |

**No separate `erosionDamage` buffer.** Erosion decreases `materialHeight` directly. When `materialHeight` reaches 0, `materialId` is cleared. This eliminates the dual-subtraction bug risk.

Grid dimensions come from the level JSON. Default for Level 1: **128×128** cells, cellSize 0.125 (16 world units total).

### Canonical accessors

All subsystems use these. Direct raw-array access only inside hot inner loops (water sim, erosion).

```
getSurfaceHeight(i)            → terrainHeight[i] + materialHeight[i]
getWaterSurfaceHeight(i)       → getSurfaceHeight(i) + waterDepth[i]
getRemainingMaterial(i)        → materialHeight[i]
isBlocked(i)                   → (occupancy[i] & STONE_BIT) !== 0
isHouse(i)                     → (occupancy[i] & HOUSE_BIT) !== 0
```

Index = `y * width + x`. Bounds-checked in dev mode (stripped in production via build flag or conditional).

## Stone Behavior

**Model A: absolute impermeable wall cell.**

- A placed stone block sets `occupancy |= STONE_BIT` and `materialId = STONE` for all cells in its footprint.
- `materialHeight` is set to a fixed block height (e.g., 0.5 world units).
- Water **cannot enter or flow through** stone cells. Water sim skips stone cells entirely (zero flux in/out).
- Water **can overtop** stone: if adjacent non-stone cells have water surface above stone surface, water flows over to the other side via those cells.
- Stone **does not erode**. Erosion skips cells with `materialId = STONE`.
- Stone **cannot be smoothed**. Smooth tool skips stone cells.
- Stone **can be removed** during construction. Removal clears occupancy, materialId, materialHeight. Refunds 1 block to budget.
- Stone is budgeted by **discrete block count**, not volume.

## Water Simulation

**Algorithm flexibility.** `WaterSim.js` is not locked to one algorithm. The initial implementation uses Virtual Pipes (pressure-driven flux between neighbors) because it produces directional flow, but the interface allows swapping to simpler height-equalization if Virtual Pipes proves too expensive.

### WaterSim interface

```
init(grid, levelConfig)   — allocate internal buffers, read sim params
step(dt)                  — advance simulation by dt seconds
reset()                   — zero all water state and internal buffers
```

### Virtual Pipes implementation

Internal buffers owned by WaterSim (not in Grid):
- `flux`: Float32Array, 4 floats per cell (N/S/E/W)
- `velocity`: Float32Array, 2 floats per cell (vx/vy) — used by Erosion

Per substep:
1. Compute pressure head per cell: `getSurfaceHeight(i) + waterDepth[i]`
2. For each non-blocked cell, compute flux to each non-blocked neighbor from pressure difference
3. Clamp total outflux so it doesn't drain more water than the cell has
4. Apply net flux to update `waterDepth` in Grid
5. Derive velocity from net flux (for erosion consumption)

**Substeps:** Start with 2 per frame. Tunable. CFL condition checked — if violated, reduce dt per substep rather than adding substeps.

**Water source:** During flood phase, add `flowRate * dt` to `waterDepth` at source cells each substep. Source injection is **capped**: if `waterDepth` at source cell exceeds a max depth (e.g., 2.0), injection stops for that cell. This prevents unrealistic spikes.

**Boundary:** Closed basin — zero flux at grid edges. This is intentional: the playable failure mode is internal defense failure, not map-edge leakage.

### Fallback: height equalization

If Virtual Pipes proves too slow at 128×128 on target hardware, the fallback is a simpler diffusion model:
- Each step, for each cell, water flows toward lower neighbors proportional to height difference
- No persistent flux state, no velocity buffer
- Erosion uses water depth gradient as a velocity proxy

This is less physically accurate but cheaper and still produces pooling + directional flow.

## Erosion

`Erosion.js` runs after each water sim step. For cells with `materialHeight > 0` and `materialId != STONE`:

1. Compute flow speed from velocity buffer magnitude (or water depth gradient if using fallback sim)
2. If speed > `erosionThreshold` (from level JSON): erode
3. Rate: `erosionRateSand` for sand, `erosionRateClay` for clay (from level JSON)
4. **Decrease `materialHeight` directly** by `rate * speed * dt`
5. When `materialHeight <= 0`: set `materialHeight = 0`, clear `materialId`
6. Emit `terrain-changed` event (for mesh update)

## Rendering

**Renderer:** Three.js `WebGLRenderer` with `antialias: true`. No post-processing.

**Camera:** `PerspectiveCamera` with `OrbitControls`. Constrained min/max distance and polar angle. Q/E snap 45°, F recenters on basin.

### Terrain mesh (mostly static)

`PlaneGeometry` matching grid resolution. Vertex Y = `getSurfaceHeight(i)`.

**Updated only on specific events**, not every frame:
- `terrain-changed` event (from erosion or material edit)
- Level load

Vertex colors are **static earth tones** based on terrain height. No per-frame wetness coloring. Water readability comes from the water mesh, not terrain color changes.

### Water mesh (dynamic, every frame)

Second `PlaneGeometry`, same dimensions. Updated every frame during flood phase only.
- Vertex Y = `getWaterSurfaceHeight(i)` where `waterDepth > threshold`
- Vertices with insufficient water depth pushed below terrain to hide
- Semi-transparent `MeshPhysicalMaterial` with blue tint and opacity

During construction and resolution phases, water mesh update is skipped (no water to render, or water is frozen).

### Houses

Simple box geometries at level-defined grid positions. Two material states:
- Dry: warm, saturated colors (most visually prominent objects in scene)
- Flooded: desaturated, darkened
- State driven by `house-flooded` / `house-dry` events from WinLoss

### Basin walls

Four vertical planes around the 16×16 world perimeter. Solid color or simple texture for diorama feel.

### Lighting

`HemisphereLight` (warm sky, cool ground) + `DirectionalLight` for definition.

## Input

**PointerInput.js:** Listens to `pointerdown/move/up` on the canvas. During construction phase only:
1. Raycast against a flat invisible plane at Y=0 (not the terrain mesh — avoids deformation instability)
2. Convert hit point to grid coordinates
3. Dispatch to active tool via EditTools.js

**CameraControls.js:** Wraps OrbitControls. RMB drag orbits, scroll zooms, Q/E rotate 45°, F recenters. Active in all phases.

No gesture conflicts: LMB = build, RMB = camera.

## Edit Tools

`EditTools.js` implements three brush operators, dispatched by active tool mode:

**Paint:** Set `materialId` and increase `materialHeight` within brush radius. Budget-checked via ResourceBudget. Sand/clay: volume units deducted. Stone: places discrete block (snapped to grid-aligned footprint).

**Smooth:** Average `materialHeight` across cells in brush radius. **Volume-conserving**: total material volume before and after smoothing is equal. Skips stone cells. No budget cost.

**Remove:** Clear `materialId` and set `materialHeight = 0` within brush radius. Refunds **full original placement cost** (construction phase only — no erosion has occurred yet). Skips stone if material-remove; stone blocks removed by clicking directly on them (refunds 1 block).

All operators emit `terrain-changed` after modifying grid cells.

## Undo System

**Sparse stroke diffs**, not bounding-box snapshots.

One pointer drag = one undo action. Before a stroke begins:
1. Start recording
2. For each cell modified during the stroke, store `{ index, prevMaterialHeight, prevMaterialId, prevOccupancy }`
3. On stroke end, push the diff (list of changed cells + net budget delta) onto the undo stack

On undo:
1. Pop most recent diff
2. Restore each cell's stored values
3. Reverse the budget delta

Stack clears on transition to Flood phase. Construction phase only — no erosion damage to worry about.

## Event Bus

`EventBus.js` — tiny synchronous pub/sub. Events:

| Event | Emitter | Consumers |
|-------|---------|-----------|
| `phase-changed` | GameLoop | PhaseControls, Toolbar, PointerInput |
| `terrain-changed` | EditTools, Erosion | TerrainMesh |
| `budget-changed` | ResourceBudget | BudgetDisplay |
| `tool-changed` | Toolbar | PointerInput, EditTools |
| `house-flooded` | WinLoss | HouseVisuals, Postmortem |
| `flood-settled` | GameLoop | WinLoss |
| `postmortem-ready` | WinLoss | Postmortem |

State ownership:
- **Active tool mode + brush size**: Toolbar owns, emits `tool-changed`
- **Game phase**: GameLoop owns, emits `phase-changed`
- **Budgets**: ResourceBudget owns, emits `budget-changed`

## Game State Machine

`GameLoop.js` manages three phases with **transition guards**:

**Construction:**
- Grid editable, water sim inactive
- Player places/removes/smooths materials, budget enforced
- Undo available (Ctrl/Cmd+Z)
- Transition to Flood: only on explicit "Start Flood" click; idempotent (ignored if already transitioning)

**Flood:**
- Grid locked, all edit input ignored
- Water source active for `durationSec`
- Water sim + erosion step each frame
- WinLoss checks house cells each frame
- After source stops + `settleTimeSec` elapses → transition to Resolution
- "Start Flood" click ignored during this phase

**Resolution:**
- Sim paused, postmortem displayed
- "Retry" click resets everything: grid from level JSON, all sim buffers (flux, velocity, water depth), budget, undo stack, input stroke state, postmortem cache, flood tracking → back to Construction
- "Retry" is idempotent

## Win/Loss & Postmortem

Simple, not clever. During flood phase, `WinLoss.js` tracks:

- **First flooded house:** First house where average `waterDepth` across footprint cells exceeds flood threshold (not a single fringe cell — averaged over footprint to avoid false positives)
- **Breach region:** When first house floods, snapshot the cluster of cells near the defense line with highest water depth. This is a **region highlight**, not a traced path.
- **Failure cause:** Simple heuristic — check `materialHeight` at breach region cells:
  - If material is still at original height → **overtopped** (water went over the top)
  - If material has been reduced → **eroded through**

Postmortem object:
```js
{
  won: bool,
  breachRegion: [{ x, y }, ...],  // cluster of high-water cells near defense
  firstFloodedHouse: id,
  failureCause: 'overtopped' | 'eroded'  // simple heuristic, not forensic
}
```

No path tracing. No "highest-depth connected path." The player sees where it breached and why — that's enough for MVP. If the heuristic is wrong sometimes, that's acceptable. Refinement is post-MVP.

## Level JSON Schema

```json
{
  "id": "string — unique level identifier",
  "name": "string — display name",

  "grid": {
    "width": "int — cell count (128 for MVP baseline)",
    "height": "int — cell count",
    "cellSize": "float — world units per cell (width * cellSize = world size)"
  },

  "terrain": {
    "type": "procedural",
    "profile": "string — terrain generator name (e.g., 'single_valley')",
    "flowDirection": "string — e.g., 'west_to_east'",
    "valleyWidth": "int — cells",
    "valleyDepth": "float — world units"
  },

  "waterSource": {
    "type": "pipe",
    "position": { "x": "int — grid col", "y": "int — grid row" },
    "radius": "int — cells",
    "flowRate": "float — water units per second per source cell",
    "maxDepth": "float — cap on water depth at source cells",
    "durationSec": "float — how long source runs",
    "startDelaySec": "float — delay after flood phase begins"
  },

  "houses": [
    {
      "id": "string",
      "position": { "x": "int — grid col", "y": "int — grid row" },
      "footprint": { "w": "int — cells", "h": "int — cells" },
      "floodThreshold": "float — average water depth over footprint to count as flooded"
    }
  ],

  "resources": {
    "sandVolume": "int — volume units",
    "clayVolume": "int — volume units",
    "stoneBlocks": "int — discrete count"
  },

  "sim": {
    "substepsPerFrame": "int — water sim substeps (start at 2)",
    "erosionThreshold": "float — min flow speed to trigger erosion",
    "erosionRateSand": "float — material height removed per unit speed per second",
    "erosionRateClay": "float — same, slower",
    "settleTimeSec": "float — wait after source stops before evaluating"
  },

  "camera": {
    "initialPosition": { "x": "float", "y": "float", "z": "float" },
    "lookAt": { "x": "float", "y": "float", "z": "float" }
  }
}
```

## Development Milestones

### Milestone 1 — Water toy + performance gate

- Project scaffold (Vite, package.json with pinned versions, index.html)
- Grid.js, Constants.js, EventBus.js
- WaterSim.js with Virtual Pipes
- SceneBuilder.js, TerrainMesh.js, WaterMesh.js
- CameraControls.js
- Level.js + level-01.json (terrain only, water source hard-triggered on load)
- main.js wiring

**Acceptance criteria:**
- 128×128 water sim + terrain render + water render sustains **60fps** on dev machine (measured, not eyeballed)
- Water flows directionally from source, pools in low areas, stops at edges
- Camera orbit/zoom/snap works
- If 60fps fails: switch to height-equalization fallback before proceeding

### Milestone 2 — Game state machine

- GameLoop.js with transition guards
- PhaseControls.js ("Start Flood" / "Retry")
- Water source injection tied to flood phase timing
- Full reset on retry (grid, sim buffers, all transient state)

**Acceptance criteria:**
- Can cycle Construction → Flood → Resolution → Construction without state leaks
- Retry returns to identical initial state (verified by comparing grid checksums)
- Double-clicking "Start Flood" or "Retry" does not cause errors

### Milestone 3 — Materials, budgets, and erosion

- Materials.js (property definitions)
- EditTools.js (paint, smooth, remove operators)
- ResourceBudget.js
- PointerInput.js (raycast painting via flat plane)
- Toolbar.js + BudgetDisplay.js
- UndoSystem.js (sparse stroke diffs)
- Stone placement as occupancy blocker
- Erosion.js (basic, using water velocity)

**Acceptance criteria:**
- Sand, clay, stone all placeable with visible budget deduction
- Smooth conserves total material volume (verified: sum before == sum after)
- Remove refunds full cost
- Undo restores grid state exactly (cell-by-cell equality check in test)
- Stone blocks water flow completely (water does not enter stone cells)
- Sand erodes visibly faster than clay under same flow
- Build stroke latency < 16ms for brush radius ≤ 5 at 128×128

**Note:** This milestone is a non-erosion sandbox for building feel. Erosion is included but material balance and building feel should be evaluated with and without erosion active.

### Milestone 4 — Houses and postmortem

- HouseVisuals.js (house meshes from level JSON)
- Flood detection (average water depth over house footprint vs threshold)
- WinLoss.js + Postmortem.js
- Breach region detection + failure cause heuristic

**Acceptance criteria:**
- Houses visually transition to flooded state when threshold exceeded
- Postmortem shows breach region and failure cause
- Win condition works: all houses dry after settle = win
- Loss condition works: any house flooded = loss with readable explanation
- The level can be both won and lost with different build strategies

### Milestone 5 — Tuning pass

- Tune: flood duration, source rate, erosion rates, level geometry
- Tune: settle time, flood threshold, brush sizes
- Playtest readability and retry cadence
- Optional: replay scrub of last 5 seconds (nice-to-have; static postmortem is sufficient)
- Optional: audio cues for flow/erosion (nice-to-have)

**Acceptance criteria:**
- Average retry-to-construction loop < 3 seconds
- In 10 manual test runs, postmortem identifies breach region plausibly in ≥ 8
- Sand and clay feel meaningfully different in practice
- A new player can identify the objective in < 10 seconds (per spec §16)

### Milestone 6 — Performance and platform polish

- Quality tier selection at level load: benchmark a short representative loop (not just one sim step) at 256, 192, 128. Pick highest sustaining 60fps. URL param override (`?quality=low|medium|high`).
- 256×256 support if performance allows
- Touch-compatible input (build/inspect mode toggle)
- Mobile UI sizing (48px touch targets)

**Acceptance criteria:**
- Quality auto-selection produces correct tier on at least 2 different devices
- Touch input works without gesture conflicts on a tablet
- No quality change mid-run

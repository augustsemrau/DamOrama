# Dam-Orama
### Game Design Specification — v0.3

---

## Concept

**Dam-Orama** is a physics-driven puzzle game about containing water.

You are given a diorama — a small, self-contained world viewed from an isometric perspective, like a snow globe you can rotate. Inside the diorama is a community of tiny houses, a water source, and a landscape of sand and earth. Your job is to build defences using a limited set of materials before the water is released.

The name is a deliberate double meaning: *dam* as in flood defence, and *diorama* as in the contained, rotatable miniature world you are building inside.

The emotional reference point is the sand-and-water basin at Experimentarium in Copenhagen — the memory of leaning over a physical tray, shaping wet sand with your hands, and watching water find every weakness you left behind.

---

## Core Experience

The game should feel like **play before it feels like a puzzle**. The sculpting of terrain and placement of materials needs to be tactile and satisfying in its own right — independent of whether your defence succeeds. Failure should feel like information, not punishment. The water is honest: it finds every gap without judgment.

There are three phases to every level:

1. **Construction** — you sculpt terrain and place materials in a paused world. The camera can be freely rotated so you can inspect your work from every angle. No time pressure.
2. **Flood** — water is released from a central source and flows outward. You can make small real-time interventions but your main structure is now fixed. You watch what you built get tested.
3. **Resolution** — either the houses are saved (victory) or water reaches one and the level ends. Either way the result is readable: you can see exactly where the defence held and where it failed.

---

## The Diorama

The world is a bounded rectangular basin, presented in isometric 3D. The walls of the basin are visible — this is not a world that pretends to go on forever. It is explicitly a stage, a contained object.

The camera is free. The player orbits around the diorama using the **WASD keys** — A/D rotate horizontally, W/S tilt the angle up and down — and scrolls to zoom. There are no locked views or snapping positions. The player finds their own vantage point at any moment, during both construction and the flood. This gives the experience a tactile, exploratory quality: you lean in to inspect a joint, pull back to read the whole basin, orbit to check the downstream face mid-flood.

---

## Materials

Each level provides a fixed budget of materials. The player cannot create more. Materials have distinct physical properties that the player learns through play, not through reading tooltips.

| Material | Character |
|---|---|
| **Sand** | Fast to place, conforms to any shape. Erodes under sustained water flow. Weak alone but useful for bulk and filling voids. |
| **Clay** | Slower to place, holds its shape better. Resists seepage well. Degrades over multiple flood seasons. |
| **Stone blocks** | Rigid, permanent, immune to erosion. Creates turbulence where water hits it, which can undermine adjacent soft material. Placed as discrete units. |
| **Timber stakes** | Fast and structural. Good for reinforcing clay banks and creating frameworks. Degrades season by season. |

The interesting decisions emerge from combining materials — stone facing with clay fill behind it; timber stakes pinning a sand embankment; a clay core inside a rough stone shell. These combinations mirror the actual construction logic of real earthen dams.

---

## Water Behaviour

Water is the teacher. Its behaviour must be physically legible — a player should be able to look at a breach and understand immediately what caused it.

Three failure modes ship in Level 1, in order of subtlety:

1. **Erosion** — sustained flow gradually removes soft material from the base. Visible as the structure slowly thinning at its foot.
2. **Undermining** — water finds a path *under* the structure, causing it to tilt and eventually topple. Punishes players who build tall but ignore foundations.
3. **Overtopping** — the obvious failure. Reserved for events that genuinely exceed the current structure's capacity, not lazy building.

The simulation should run at a resolution that makes these behaviours visible and readable at the scale of the diorama. This is the primary technical challenge of the game.

**Deferred: Seepage.** Seepage (water pushing through porous material before overtopping, visible as a dark wet patch on the downstream face) is the most satisfying failure to prevent and remains a design goal. However, it requires subsurface flow modelling (e.g. a secondary Darcy flow pass) that the SWE Virtual Pipes method does not natively support. Seepage is deferred to a future upgrade and is not modelled in Level 1. The per-cell permeability system in the water sim is designed to accommodate seepage when the subsurface layer is added.

---

## Progression

Levels escalate along two axes: **flood severity** and **resource constraint**.

Early levels are generous — plenty of materials, a simple water source, a mild flood. The player learns material behaviour through low-stakes experimentation. Later levels introduce:

- Multiple water sources or inflow directions
- Asymmetric terrain that creates natural weak points
- Scarcer or more unusual material combinations (all stone, no clay; plenty of sand, one timber stake)
- Seasonal memory — terrain deformed by the previous flood becomes this season's liability *(future scope — not in Level 1; see Seasonal Memory section)*
- Protected zones — some houses matter more than others; partial containment scores partial credit

There is no "solved" state that persists indefinitely. In future multi-round levels, the world will accumulate change across seasons. Ground that was stable last season becomes pre-eroded. A dam that held at flood level 3 might fail at level 4 even without modification. The player is always renegotiating. *(Level 1 is a single flood event with clean reset on replay.)*

---

## The Houses

The houses are small, handcrafted, diorama-scaled. They should feel precious — the kind of tiny object a child would be careful with.

They are the emotional anchor of the game. They do not need to be characters with names and backstories. Their scale and fragility is enough. When water reaches one, it matters.

Visually they should read clearly from all four cardinal camera angles. A flooded house should look flooded — waterlogged, slightly displaced, sad.

---

## Aesthetic Direction

**Tone:** Quiet, focused, slightly melancholy. The feeling of leaning over something small and caring about it.

**Visual reference:** The Experimentarium basin. Into the Breach's contained diorama stage. Old Flemish paintings of floods. The tactile warmth of wet sand and weathered wood.

**Camera:** Tight isometric. The world should feel like it fits on a table. The player is always slightly above it, looking in, like a child over a basin.

**Palette:** Warm earth tones for dry terrain. Dark olive-charcoal for wet sand. Clear cold blue for water, deepening with depth. Weathered wood for the basin walls. The houses should be the warmest, most saturated objects in the scene — small beacons worth protecting.

**Sound design** (aspirational): The sound of water on sand. The creak of timber. The difference between a trickle and a surge. Silence during construction. The game should be comfortable to play without music.

---

## Technology

### Current Prototype

The current prototype (`experimentarium3d.html`) is a self-contained HTML/JavaScript file built on **Three.js r128**. It implements:

- A `110×110` heightmap grid with real-time vertex displacement
- A height-field water flow simulation (8 steps per frame)
- PBR materials — `MeshStandardMaterial` for terrain with vertex colors encoding sand wetness, `MeshPhysicalMaterial` for the water surface with environment map reflections
- PMREM-generated environment map for IBL (image-based lighting)
- Cosine-falloff sculpting brush with raise/lower/flatten tools
- Orbit camera via pointer movement, zoom via scroll, brush resize via Shift+scroll
- Water droplet particles from the source pipe
- Animated water surface ripple via per-vertex sine displacement

The prototype confirms the core visual and interaction feel. It does not yet have rigid body physics, material types, resource budgets, house objects, or touch controls.

---

### Physics Architecture

The game uses a **two-layer hybrid physics architecture**: a GPU-accelerated shallow water simulation for fluid behaviour, and a rigid body engine for structural elements. These run independently and are coupled at the boundary where water interacts with placed blocks.

#### Layer 1 — Water simulation: Shallow Water Equations with Virtual Pipes

The Shallow Water Equations (SWE) model water as a height-column grid: each cell stores a water depth value, and flow is driven by pressure differences between adjacent cells. This is physically correct for the kind of water Dam-Orama needs — slow rising floods, seepage through gaps, channel flow, terrain-following water. It is not designed for turbulent splashing or airborne droplets; those are handled visually rather than physically.

**Implementation reference:** `lisyarus/webgpu-shallow-water` (MIT licence, GitHub). This is an open-source WebGPU compute shader implementation of the Virtual Pipes method running on a 256×256 grid in real time in the browser. The codebase is the direct starting point for the water layer.

**Key parameters:**
- Grid resolution: **512×512** cells (unified grid — terrain and water share the same resolution and coordinate space, 1:1 cell mapping)
- Time step: determined by CFL condition; ~2–6 GPU substeps per rendered frame
- Flow model: Virtual Pipes with outflow scaling (Dagenais et al.)
- Per-cell permeability coefficient: sand = high, clay = low, stone = near-zero (infrastructure for future seepage; in Level 1 permeability only affects erosion rate)
- Erosion: cells with sustained high-velocity flow above an erosion threshold incrementally lower their terrain height

**Grid unification:** The terrain heightmap and the water simulation operate on the same 512×512 grid. There is no separate terrain grid — the water sim grid *is* the terrain grid. Each cell stores: terrain height, water depth, material type, and permeability. This eliminates grid-mapping complexity and ensures pixel-perfect alignment between water behaviour and visible terrain.

**WebGPU fallback:** For browsers or devices without WebGPU (older Android, iOS < 26), fall back to the existing CPU heightfield simulation. This runs at a lower resolution (128×128) but is sufficient for level 1 and 2 difficulty. The fallback is implemented as a separate codepath with identical API surface.

**Failure modes modelled in Level 1:**
- Erosion: soft-material cells lose height under sustained flow
- Overtopping: water exceeds dam height and spills over
- Undermining: erosion at the base of a structure removes support; rigid body layer handles the resulting collapse

**Deferred failure mode:** Seepage (subsurface flow through permeable material) requires a secondary Darcy flow simulation layer. The per-cell permeability data is stored and maintained so that seepage can be added in a future update without restructuring the grid.

#### Layer 2 — Rigid body physics: Rapier.js

Placed stone blocks, timber stakes, and pre-existing obstacle objects are simulated as rigid bodies using **Rapier.js** (`@dimforge/rapier3d-compat`, MIT licence). Rapier is compiled from Rust to WebAssembly and runs at near-native speed in all modern browsers with no native dependencies.

**What Rapier handles:**
- Stone block placement with accurate collision geometry
- Block stacking, stability, and toppling when undermined
- Timber stake behaviour under load
- House objects as dynamic rigid bodies (they can be displaced by flooding)
- Pre-placed obstacle geometry (boulders, walls, ruins) as static colliders

**Coupling to the water layer:** At each simulation step, the water sim queries Rapier for the positions and orientations of all rigid bodies that intersect the water grid. Cells overlapping a rigid body are treated as blocked (non-permeable, non-erodable). If the water sim detects that a block's supporting terrain has eroded below a threshold, it fires a "support lost" event to Rapier, which removes the static constraint and lets the block fall dynamically.

**What Rapier does not handle:** fluid simulation, seepage, erosion. Those are entirely owned by the SWE layer.

#### Layer 3 — Visual effects (decoupled from physics)

A lightweight particle system runs on top of both physics layers to provide visual feedback that the underlying simulations do not produce:

- Water splash particles when flow velocity exceeds threshold
- Droplet spray at the source pipe
- Dust/debris particles when a block collapses
- Ripple rings on the water surface at high-velocity inflow points

These are purely cosmetic and are not fed back into either physics layer.

---

### Browser and Platform Requirements

| Platform | Water sim | Rigid bodies | Status |
|---|---|---|---|
| Chrome / Edge 113+ (desktop) | WebGPU SWE | Rapier WASM | ✅ Full |
| Chrome 121+ (Android 12+, ARM/Qualcomm GPU) | WebGPU SWE | Rapier WASM | ✅ Full |
| Safari 26+ (iOS 26 / iPadOS 26) | WebGPU SWE | Rapier WASM | ✅ Full |
| Firefox 141+ (Windows) | WebGPU SWE | Rapier WASM | ✅ Full |
| Older Safari / iOS < 26 | CPU fallback | Rapier WASM | ⚠️ Degraded water |
| Older Android (< Android 12) | CPU fallback | Rapier WASM | ⚠️ Degraded water |

WebGPU is now default-enabled in all major browsers as of November 2025. The CPU fallback ensures the game is playable on all devices, with degraded (but functional) water physics.

---

### Touch Input Architecture

All interactions are implemented using the **Pointer Events API** (not touch events), which handles both touch and mouse uniformly.

| Gesture | Action |
|---|---|
| 1-finger drag on terrain | Sculpt / place material at cursor position |
| 1-finger drag on empty basin | Pan camera (translate horizontally) |
| 2-finger pinch | Resize sculpt brush radius |
| 2-finger rotate | Orbit camera horizontally |
| 2-finger spread/pinch | Zoom camera |
| Tap on UI button | Select tool / trigger action |
| Long-press on terrain | Open material placement picker |

WASD keyboard controls remain available on desktop as secondary input. Keyboard camera: A/D rotate horizontally, W/S tilt, scroll wheel zooms. Brush size via Shift+scroll.

**Minimum touch target size:** 48×48 logical pixels for all interactive UI elements (Material Design / Apple HIG standard). All tool buttons, flood/drain controls, and material selectors meet this minimum.

---

### Rendering Stack

| Component | Library / Approach |
|---|---|
| 3D rendering | Three.js (latest stable, not r128) |
| WebGPU renderer | Three.js `WebGPURenderer` (experimental path, replaces WebGLRenderer) |
| Terrain mesh | `PlaneGeometry` with vertex displacement from 512×512 unified grid |
| Water surface | Separate `PlaneGeometry` with `MeshPhysicalMaterial`, `transmission`, `roughness: 0.05`, env map |
| Rigid bodies (visual) | `BoxGeometry` / `CylinderGeometry` synced from Rapier body positions each frame |
| Particles | `Points` geometry with custom `ShaderMaterial`, billboard quads |
| Lighting | Single directional light (sun) + ambient hemisphere. No real-time shadows on mobile; baked ambient occlusion only |
| Post-processing | None in Level 1. Optional: subtle vignette, slight colour grade for atmosphere |

**Upgrade note on Three.js version:** The current prototype uses r128 to avoid importing OrbitControls. The production build should use the latest Three.js (r168 or current at build time) with `WebGPURenderer` for the compute shader integration. The custom orbit camera code from the prototype is retained — no dependency on OrbitControls.

**Migration note:** Moving from r128 WebGLRenderer to latest Three.js WebGPURenderer is effectively a rewrite of the rendering layer, not a port. The shader pipeline, material system, and renderer API have changed significantly. Step 2 in the development sequence should target WebGLRenderer first (to preserve visual parity with the prototype), and Step 3 introduces WebGPURenderer alongside the GPU water sim. This avoids coupling two large changes into one step.

---

### Repository Structure (target)

```
dam-orama/
├── index.html                  # Entry point
├── src/
│   ├── main.js                 # Scene setup, game loop
│   ├── renderer/
│   │   ├── SceneBuilder.js     # Three.js scene, camera, lights
│   │   └── TerrainMesh.js      # Heightmap → geometry sync
│   ├── physics/
│   │   ├── WaterSim.js         # SWE wrapper (WebGPU or CPU fallback)
│   │   ├── WaterSimGPU.js      # WebGPU compute shader implementation
│   │   ├── WaterSimCPU.js      # CPU fallback implementation
│   │   └── RigidBodies.js      # Rapier world wrapper
│   ├── game/
│   │   ├── GameLoop.js         # Phase state machine (construction/flood/resolution)
│   │   ├── Materials.js        # Material definitions and placement logic
│   │   ├── Houses.js           # House objects, flood detection
│   │   └── Level.js            # Level data loader
│   ├── input/
│   │   └── InputHandler.js     # Pointer Events + keyboard unified input
│   ├── levels/
│   │   └── level-01.json       # Level 1 data (terrain, houses, resource budget)
│   └── shaders/
│       ├── water-sim.wgsl      # WebGPU compute: SWE virtual pipes
│       └── water-render.wgsl   # WebGPU: water surface vertex/fragment
├── assets/
│   └── (textures, models — none in Level 1)
└── package.json
```

---

### Development Sequence

These are the build steps for the agentic coding phase, in strict dependency order. Each step is independently testable.

**Step 1 — Project scaffold**
Set up Vite + Three.js (latest) project. Confirm `WebGPURenderer` renders a blank scene in Chrome. Add Rapier.js WASM dependency (`@dimforge/rapier3d-compat`). Confirm Rapier initialises and a falling box simulation runs in the console without rendering.

**Step 2 — Port existing prototype into module structure**
Move terrain mesh, camera, water simulation, and UI controls from `experimentarium3d.html` into the `src/` module structure above. Use latest Three.js with `WebGLRenderer` (not WebGPURenderer yet) to preserve visual parity with the prototype. The result should be visually identical to the current prototype but running in Vite with proper module imports. WebGPURenderer migration happens in Step 3.

**Step 3 — GPU water simulation**
Implement `WaterSimGPU.js` using WebGPU compute shaders based on the Virtual Pipes method. Switch the renderer from `WebGLRenderer` to `WebGPURenderer` in this step. Target: 512×512 unified grid, stable simulation, water flows downhill correctly, source pipe fills the basin. CPU fallback (`WaterSimCPU.js`) is the existing heightfield code extracted from the prototype, running at 128×128.

**Step 4 — Rigid body integration**
Implement `RigidBodies.js`. Place 5 stone blocks on the terrain via the UI. Confirm they sit on the terrain mesh, stack stably, and topple when their base is removed programmatically. Sync Rapier body positions to Three.js meshes every frame.

**Step 5 — Water–rigid body coupling**
Water sim checks Rapier body AABBs each step. Cells overlapping a body are blocked. Confirm water flows around placed stone blocks. Confirm a block placed mid-stream visibly deflects water flow.

**Step 6 — Material system**
Implement material placement: sand (terrain sculpt, high erosion rate), clay (terrain sculpt, low erosion rate), stone block (Rapier rigid body, immune to erosion), timber stake (Rapier rigid body, thin cylinder, degrades over time). Add per-cell material type and permeability to the water sim grid (permeability stored for future seepage support; in Level 1 it only modulates erosion rate). Confirm erosion visually: sand erodes faster than clay under identical flow.

**Step 7 — House objects and flood detection**
Add 3 house meshes as static Rapier bodies at fixed positions. Water sim fires `CELL_FLOODED` event when water depth exceeds 0.1 in any cell overlapping a house footprint for at least 60 consecutive frames (~1 second at 60fps). This hysteresis prevents flickering from frame-to-frame depth fluctuations. A house unfloods only when depth drops below 0.05 for 30 consecutive frames. On flood event: house transitions to flood visual state (darker, waterlogged shader), level resolution logic triggers.

**Step 8 — Game loop and phase state machine**
Implement construction → flood → resolution phases. Construction: sculpt and place freely, no water flowing. Flood: trigger releases water from source, player can observe and make minor edits. Resolution: evaluate win/loss, show result, offer replay.

**Step 9 — Resource budget system**
Level JSON specifies available material units per type. UI displays remaining budget. Placement is blocked when budget is exhausted.

**Step 10 — Level 1 complete**
Author `level-01.json` with: 512×512 unified grid, flat centre with gentle valley, single central water source, 3 houses on far side, budget of 20 sand units + 10 clay units + 6 stone blocks + 4 timber stakes. Playtest and tune flood rate, erosion rate, and material erosion constants.

**Step 11 — Touch input**
Implement `InputHandler.js` with Pointer Events. Map all gestures per the touch input table above. Confirm 1-finger sculpt, 2-finger orbit, 2-finger pinch-to-resize-brush all work on a mobile device or Chrome DevTools touch simulation.

**Step 12 — Polish pass**
WASD camera with acceleration/damping. Flood/drain UI buttons (min 48px targets). Material selector UI. Particle effects for splash and pipe inflow. Water surface PBR material with env map.

---

### Level 1 Data Specification

The first level is intentionally simple — it exists to teach material behaviour without puzzle complexity.

```json
{
  "id": "level-01",
  "name": "The Basin",
  "grid": { "width": 512, "height": 512, "cellSize": 0.03125 },
  "terrain": {
    "type": "procedural",
    "profile": "flat_valley",
    "valleyWidth": 128,
    "valleyDepth": 0.3,
    "valleyDirection": "east-west"
  },
  "waterSource": {
    "position": { "x": 256, "y": 256 },
    "radius": 10,
    "flowRate": 0.018,
    "startDelay": 0
  },
  "houses": [
    { "id": "house-a", "position": { "x": 384, "y": 230 }, "scale": 1.0 },
    { "id": "house-b", "position": { "x": 396, "y": 256 }, "scale": 0.85 },
    { "id": "house-c", "position": { "x": 384, "y": 282 }, "scale": 1.0 }
  ],
  "resources": {
    "sand": 20,
    "clay": 10,
    "stone": 6,
    "timber": 4
  },
  "floodParameters": {
    "maxFloodDepth": 2.5,
    "drainRate": 0.025,
    "erosionThreshold": 0.4,
    "erosionRate": 0.002
  },
  "winCondition": "all_houses_dry",
  "partialCredit": true
}
```


---

### Performance Targets

The game must maintain interactive frame rates across all supported platforms. These are the minimum targets:

| Platform | Target FPS | Water sim grid | Max Rapier bodies |
|---|---|---|---|
| Desktop (WebGPU) | 60 fps | 512×512 | 64 |
| Mobile (WebGPU) | 30 fps | 512×512 | 32 |
| Fallback (CPU) | 30 fps | 128×128 | 32 |

**Frame budget (desktop at 60fps):** 16.6ms total per frame.
- Water sim GPU compute: ≤ 4ms (2–6 substeps)
- Rapier physics step: ≤ 2ms
- Three.js render: ≤ 8ms
- JS game logic + coupling: ≤ 2ms

**Adaptive quality:** If frame time exceeds 20ms for 30 consecutive frames, reduce water sim substeps from 6 to 2. If still over budget, halve the water sim grid to 256×256 for the remainder of the session. Log the downgrade to console for debugging.

---

### Undo System

During the construction phase, the player can undo their last placement or sculpt action. This is critical for touch-first interaction where a misplaced finger drag can ruin careful work.

**Implementation:** A stack of terrain snapshots (heightmap + material type arrays). Each sculpt or placement action pushes the affected region (bounding box of changed cells) onto the stack. Undo pops the most recent snapshot and restores those cells. Maximum stack depth: 20 actions. Undo is only available during the construction phase — once the flood starts, the stack is cleared.

**UI:** A single undo button (48×48px minimum) in the construction toolbar. Keyboard shortcut: Ctrl+Z / Cmd+Z on desktop.

---

### Seasonal Memory (Future Scope)

The spec's Progression section references "seasonal memory" — terrain deformed by a previous flood persisting into the next round. This is explicitly **not in scope for Level 1**. Level 1 is a single flood event with a clean reset on replay.

Seasonal memory requires serializing the full 512×512 grid state (terrain height, material type, permeability, erosion damage) between rounds and presenting a multi-round UI. This is a future feature that will be designed when multi-round levels are introduced.

---

### Testing Strategy

Each development step includes a concrete verification criterion. Automated tests are not practical for visual/physics output, so testing is manual with specific pass/fail conditions:

| Step | Verification |
|---|---|
| 1 — Scaffold | WebGPURenderer renders a coloured background. Rapier logs a falling box position to console. |
| 2 — Port | Side-by-side visual comparison with prototype. Camera orbit, sculpt brush, and water flow all function. |
| 3 — GPU water | Water released from source fills a flat basin evenly. Water flows downhill in a sloped basin. No NaN or instability after 5 minutes. |
| 4 — Rigid bodies | 5 stacked blocks remain stable for 10 seconds. Removing the bottom block causes collapse. |
| 5 — Coupling | Water visibly deflects around a placed block. Removing the block allows water to fill the gap. |
| 6 — Materials | Sand erodes visibly faster than clay under identical flow. Stone blocks are unaffected by erosion. |
| 7 — Houses | House turns waterlogged after ~1 second of flooding. House recovers if water recedes. |
| 8 — Game loop | Construction phase allows free placement. Flood phase releases water. Resolution shows win/loss. |
| 9 — Budget | Placement is blocked when budget hits zero. UI counter decrements correctly. |
| 10 — Level 1 | Full playthrough: build a dam, survive the flood, win. Intentionally bad dam: houses flood, lose. |
| 11 — Touch | 1-finger sculpt, 2-finger orbit, pinch-to-zoom all work in Chrome DevTools touch simulation. |
| 12 — Polish | All UI buttons ≥ 48px. Particles visible at source pipe. Camera has smooth acceleration/damping. |

For physics regression: after tuning constants in any step, re-run the verification for all previous physics steps (3–7) to confirm nothing broke.

---

## Design Decisions

- **Levels are hand-crafted.** Each level is a distinct diorama with its own dimensions, terrain, pre-placed obstacles, and visual identity. Level design will be directed by the game designer.

**Level archetypes** (illustrative, not exhaustive — each level is a unique puzzle with distinct water source placement, house positions, pre-built terrain, and resource constraints):

| Archetype | Water behaviour | Terrain character | Example inspiration |
|---|---|---|---|
| **River valley** | Steady directional flow from upstream source | Narrow valley with floodplain, houses on the banks | Rhine, Nile delta, Mississippi levees |
| **Coastal shoreline** | Waves / surge from one edge of the basin | Sloped beach with houses set back from shore | Dutch sea defences, New Orleans levees |
| **Mountain basin** | Burst dam / flash flood from elevated source | Steep terrain with a narrow gorge feeding into a flat settlement | Alpine valleys, Vajont Dam |
| **Island / atoll** | Rising water from below (all edges) | Low-lying central island with houses, water encroaching from perimeter | Tuvalu, Venice, Atlantis |
| **River confluence** | Multiple water sources converging | Two or more channels meeting at a junction where houses sit | Koblenz, Pittsburgh, Chongqing |
| **Glacial melt** | Slow but relentless rising from a melting ice mass | Frozen terrain that gradually reveals water as ice recedes | Jökulsárlón, Greenland coast |

Each level varies along: water source count and placement, inflow direction and rate, pre-existing terrain features (ridges, channels, slopes), house count and placement, and available resource budget. The puzzle emerges from reading the terrain and water threat, then choosing where and how to spend limited materials. No two levels should feel like the same problem with different numbers.
- **No multiplayer.** Single-player only.
- **Touch-first interaction.** The game is designed from the ground up for touch screens. One finger sculpts terrain. Two fingers pinch to resize the brush. Two fingers rotate to orbit the camera. Two fingers spread to zoom. All UI targets are sized for fingertips. Mouse and keyboard on desktop is a supported but secondary input path.

---

*Spec v0.3 — March 2026. Ready for agentic build phase.*

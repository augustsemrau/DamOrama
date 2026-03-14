# Dam-Orama
### Game Design Specification — v0.2

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

Four key failure modes, in order of subtlety:

1. **Seepage** — water pushes through porous or poorly-packed material before overtopping. The first sign is a dark wet patch on the downstream face. This is the most satisfying failure to prevent.
2. **Erosion** — sustained flow gradually removes soft material from the base. Visible as the structure slowly thinning at its foot.
3. **Undermining** — water finds a path *under* the structure, causing it to tilt and eventually topple. Punishes players who build tall but ignore foundations.
4. **Overtopping** — the obvious failure. Reserved for events that genuinely exceed the current structure's capacity, not lazy building.

The simulation should run at a resolution that makes these behaviours visible and readable at the scale of the diorama. This is the primary technical challenge of the game.

---

## Progression

Levels escalate along two axes: **flood severity** and **resource constraint**.

Early levels are generous — plenty of materials, a simple water source, a mild flood. The player learns material behaviour through low-stakes experimentation. Later levels introduce:

- Multiple water sources or inflow directions
- Asymmetric terrain that creates natural weak points
- Scarcer or more unusual material combinations (all stone, no clay; plenty of sand, one timber stake)
- Seasonal memory — terrain deformed by the previous flood becomes this season's liability
- Protected zones — some houses matter more than others; partial containment scores partial credit

There is no "solved" state that persists indefinitely. Across seasons, the world accumulates change. Ground that was stable last season is now pre-eroded. A dam that held at flood level 3 might fail at level 4 even without modification. The player is always renegotiating.

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
- Grid resolution: **256×256** cells (maps to the diorama footprint; each cell ≈ terrain tile)
- Time step: determined by CFL condition; ~1–4 GPU substeps per rendered frame
- Flow model: Virtual Pipes with outflow scaling (Dagenais et al.)
- Seepage: modelled as a per-cell permeability coefficient — sand has high permeability, clay low, stone near-zero
- Erosion: cells with sustained high-velocity flow above an erosion threshold incrementally lower their terrain height and increase permeability

**WebGPU fallback:** For browsers or devices without WebGPU (older Android, iOS < 26), fall back to the existing CPU heightfield simulation. This runs at a lower resolution (128×128) but is sufficient for level 1 and 2 difficulty. The fallback is implemented as a separate codepath with identical API surface.

**Failure modes modelled:**
- Seepage: water infiltrates cells with non-zero permeability even when not overtopping
- Erosion: soft-material cells lose height under sustained flow
- Overtopping: water exceeds dam height and spills over
- Undermining: erosion at the base of a structure removes support; rigid body layer handles the resulting collapse

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

#### Special level physics: MLS-MPM upgrade path

For levels where spectacular fluid behaviour is central to the experience (tsunami, Atlantis rising water, glacial melt), the water layer can be swapped to **MLS-MPM** (Moving Least Squares Material Point Method) via `matsuoka-601/WebGPU-Ocean` (MIT licence). This runs 100k–300k particles in real time on WebGPU and produces volumetric splashing, wave crests, and soft-body sand that the SWE layer cannot. This upgrade path requires WebGPU and is not available on the fallback codepath. It is not used in Level 1.

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
| 1-finger drag on empty basin | No action (reserved for future pan) |
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
| Terrain mesh | `PlaneGeometry` with vertex displacement from SWE height grid |
| Water surface | Separate `PlaneGeometry` with `MeshPhysicalMaterial`, `transmission`, `roughness: 0.05`, env map |
| Rigid bodies (visual) | `BoxGeometry` / `CylinderGeometry` synced from Rapier body positions each frame |
| Particles | `Points` geometry with custom `ShaderMaterial`, billboard quads |
| Lighting | Single directional light (sun) + ambient hemisphere. No real-time shadows on mobile; baked ambient occlusion only |
| Post-processing | None in Level 1. Optional: subtle vignette, slight colour grade for atmosphere |

**Upgrade note on Three.js version:** The current prototype uses r128 to avoid importing OrbitControls. The production build should use the latest Three.js (r168 or current at build time) with `WebGPURenderer` for the compute shader integration. The custom orbit camera code from the prototype is retained — no dependency on OrbitControls.

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
Move terrain mesh, camera, water simulation, and UI controls from `experimentarium3d.html` into the `src/` module structure above. The result should be visually identical to the current prototype but running in Vite with proper module imports.

**Step 3 — GPU water simulation**
Implement `WaterSimGPU.js` using WebGPU compute shaders based on the Virtual Pipes method. Target: 256×256 grid, stable simulation, water flows downhill correctly, source pipe fills the basin. CPU fallback (`WaterSimCPU.js`) is the existing heightfield code extracted from the prototype.

**Step 4 — Rigid body integration**
Implement `RigidBodies.js`. Place 5 stone blocks on the terrain via the UI. Confirm they sit on the terrain mesh, stack stably, and topple when their base is removed programmatically. Sync Rapier body positions to Three.js meshes every frame.

**Step 5 — Water–rigid body coupling**
Water sim checks Rapier body AABBs each step. Cells overlapping a body are blocked. Confirm water flows around placed stone blocks. Confirm a block placed mid-stream visibly deflects water flow.

**Step 6 — Material system**
Implement material placement: sand (terrain sculpt, high permeability), clay (terrain sculpt, low permeability), stone block (Rapier rigid body), timber stake (Rapier rigid body, thin cylinder). Add per-cell permeability to the water sim grid. Confirm seepage visually: water darkens the downstream face of a clay dam before overtopping.

**Step 7 — House objects and flood detection**
Add 3 house meshes as static Rapier bodies at fixed positions. Water sim fires `CELL_FLOODED` event when water depth exceeds 0.1 in a cell containing a house. On event: house turns to flood visual state (darker, waterlogged shader), level resolution logic triggers.

**Step 8 — Game loop and phase state machine**
Implement construction → flood → resolution phases. Construction: sculpt and place freely, no water flowing. Flood: trigger releases water from source, player can observe and make minor edits. Resolution: evaluate win/loss, show result, offer replay.

**Step 9 — Resource budget system**
Level JSON specifies available material units per type. UI displays remaining budget. Placement is blocked when budget is exhausted.

**Step 10 — Level 1 complete**
Author `level-01.json` with: 160×160 terrain grid, flat centre with gentle valley, single central water source, 3 houses on far side, budget of 20 sand units + 10 clay units + 6 stone blocks. Playtest and tune flood rate, erosion rate, and material permeability constants.

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
  "grid": { "width": 160, "height": 160, "cellSize": 0.1 },
  "terrain": {
    "type": "procedural",
    "profile": "flat_valley",
    "valleyWidth": 40,
    "valleyDepth": 0.3,
    "valleyDirection": "east-west"
  },
  "waterSource": {
    "position": { "x": 80, "y": 80 },
    "radius": 3,
    "flowRate": 0.018,
    "startDelay": 0
  },
  "houses": [
    { "id": "house-a", "position": { "x": 120, "y": 72 }, "scale": 1.0 },
    { "id": "house-b", "position": { "x": 124, "y": 80 }, "scale": 0.85 },
    { "id": "house-c", "position": { "x": 120, "y": 88 }, "scale": 1.0 }
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

## Design Decisions

- **Levels are hand-crafted.** Each level is a distinct diorama with its own dimensions, terrain, pre-placed obstacles, and visual identity. Examples in scope: a coastal level with tsunami waves, a sunken Atlantis level with water rising from below, a mountain valley with a burst upstream dam, a frozen level with melting ice as the water source. Level design will be directed by the game designer.
- **No multiplayer.** Single-player only.
- **Touch-first interaction.** The game is designed from the ground up for touch screens. One finger sculpts terrain. Two fingers pinch to resize the brush. Two fingers rotate to orbit the camera. Two fingers spread to zoom. All UI targets are sized for fingertips. Mouse and keyboard on desktop is a supported but secondary input path.

---

*Spec v0.2 — March 2026. Ready for agentic build phase.*

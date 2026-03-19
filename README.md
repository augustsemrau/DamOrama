# Dam-Orama

A browser-based physics puzzle game where you build flood defences in a rotatable 3D diorama to protect tiny houses from rising water. Each level has three phases: **Construction** (build defences), **Flood** (water released), and **Resolution** (win/loss evaluation).

## Tech Stack

- **Vite** — build tooling and dev server
- **Three.js** — 3D rendering (`WebGPURenderer` with `WebGLRenderer` fallback)
- **Rapier.js** (`@dimforge/rapier3d-compat`) — rigid body physics (WASM)
- **WebGPU Compute Shaders** (WGSL) — GPU-accelerated shallow water simulation (512×512 grid)
- **CPU Fallback** — JavaScript water simulation (128×128 grid) for browsers without WebGPU
- **Vitest** — test framework

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in a WebGPU-capable browser (Chrome 113+, Edge 113+). Falls back to CPU water simulation on older browsers.

## Build

```bash
npm run build
npm run preview   # preview the production build
```

## Test

```bash
npx vitest --run
```

375 tests across 26 test files covering all subsystems.

## Game Controls

### Touch (Mobile)

| Gesture | Action |
|---|---|
| 1-finger drag on terrain | Sculpt / place material |
| 1-finger drag on empty area | Pan camera |
| 2-finger pinch | Resize sculpt brush |
| 2-finger rotate | Orbit camera |
| 2-finger spread/pinch | Zoom in/out |
| Long-press on terrain | Open material picker |

### Keyboard & Mouse (Desktop)

| Input | Action |
|---|---|
| Left-click drag on terrain | Sculpt / place selected material |
| Right-click drag | Orbit camera |
| Middle-click drag | Zoom (dolly) |
| A / D | Rotate camera horizontally |
| W / S | Tilt camera up / down |
| Scroll wheel | Zoom in / out |
| Shift + scroll | Resize sculpt brush |
| Ctrl+Z / Cmd+Z | Undo last action |

### UI Toolbar

- **Material selector** — Sand, Clay, Stone, Timber
- **Flood button** — trigger the flood phase
- **Drain button** — debug drain
- **Undo button** — revert last construction action

All interactive UI elements are ≥ 48×48px for touch accessibility.

## Architecture Overview

The system is organised into five layers:

```
Input → Game Logic → Physics → Rendering
                  ↘ Level Data ↗
```

### Physics Layer
Owns all simulation state. The UnifiedGrid (512×512) is the single source of truth for terrain and water. WaterSim delegates to GPU or CPU backend. Rapier.js handles rigid bodies. The two physics systems communicate through cell blocking and "support lost" events.

### Game Logic Layer
Owns game rules. GameLoop manages the three-phase state machine. MaterialSystem handles placement. ResourceBudget tracks per-material unit counts. UndoSystem captures/restores grid snapshots. Level loader parses JSON and initialises all subsystems.

### Input Layer
Translates Pointer Events and keyboard events into game actions. Distinguishes touch gestures from mouse/keyboard input.

### Rendering Layer
SceneBuilder manages the Three.js scene, camera, and lighting. TerrainMesh and WaterRenderer sync vertex positions from the grid. ParticleSystem emits cosmetic splash/spray/debris effects. UI modules render the HUD.

## Project Structure

```
src/
├── main.js                          # Application entry point
│
├── game/                            # Game logic
│   ├── AdaptiveQuality.js           # Runtime quality downgrade (substeps, grid)
│   ├── GameLoop.js                  # Three-phase state machine
│   ├── Houses.js                    # House registry and flood state
│   ├── Level.js                     # JSON level loader
│   ├── Materials.js                 # Material properties + placement logic
│   ├── ResourceBudget.js            # Per-material unit tracking
│   ├── UndoSystem.js                # Construction-phase undo stack
│   ├── UnifiedGrid.js               # 512×512 cell data (terrain, water, material)
│   └── WinLoss.js                   # Win/loss evaluation
│
├── physics/                         # Simulation
│   ├── Erosion.js                   # Per-cell terrain erosion by water flow
│   ├── FloodDetection.js            # Hysteresis-based house flood detection
│   ├── RigidBodies.js               # Rapier.js WASM physics wrapper
│   ├── SupportCheck.js              # Terrain undermining detection
│   ├── TimberDegradation.js         # Timber stake integrity decay
│   ├── WaterSim.js                  # Facade (auto-selects GPU or CPU)
│   ├── WaterSimCPU.js               # CPU fallback (128×128, Virtual Pipes)
│   └── WaterSimGPU.js               # WebGPU compute (512×512)
│
├── renderer/                        # Three.js rendering
│   ├── BodyMeshSync.js              # Rapier → Three.js mesh sync
│   ├── HouseVisuals.js              # House flood visual state
│   ├── ParticleSystem.js            # Splash, spray, debris particles
│   ├── SceneBuilder.js              # Scene, camera, lights, WebGPURenderer
│   ├── TerrainMesh.js               # Terrain vertex displacement + colours
│   └── WaterRenderer.js             # Water surface mesh
│
├── shaders/                         # WGSL shaders
│   ├── water-sim.wgsl               # SWE compute shader (512×512)
│   └── water-render.wgsl            # Water surface vertex/fragment shader
│
├── input/                           # Input handling
│   ├── InputHandler.js              # Unified Pointer Events (touch + mouse)
│   └── KeyboardInput.js             # WASD camera + scroll zoom + brush resize
│
├── ui/                              # UI overlays
│   ├── BudgetDisplay.js             # Material budget counters
│   ├── GameControls.js              # Material selector + flood/drain buttons
│   └── UndoButton.js                # Undo button (48×48px)
│
└── levels/
    └── level-01.json                # Level 1 "The Basin"
```

## Level 1 — "The Basin"

- Flat centre with gentle east-west valley
- Single central water source
- 3 houses to protect
- Budget: 20 Sand, 10 Clay, 6 Stone, 4 Timber
- Win: all 3 houses survive the flood
- Partial credit: awarded per surviving house

## License

Private project.

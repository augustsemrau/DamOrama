# Implementation Plan: Dam-Orama

## Overview

Implementation follows the 12-step development sequence from the game design spec. Each step is independently testable and builds on the previous. The stack is Vite + Three.js (latest) + Rapier.js + WebGPU compute shaders (WGSL). All code is JavaScript ES modules.

## Tasks

- [ ] 1. Project scaffold (Vite + Three.js + Rapier.js)
  - [ ] 1.1 Initialise Vite project with `index.html`, `package.json`, and `src/main.js`
    - Add Three.js (latest stable) and `@dimforge/rapier3d-compat` as dependencies
    - Configure Vite for ES module development
    - _Requirements: 1.1, 1.3_

  - [ ] 1.2 Create `src/renderer/SceneBuilder.js` with WebGPURenderer initialisation
    - Set up Three.js scene, camera (isometric perspective above basin), hemisphere + directional light
    - Render a coloured background to confirm WebGPURenderer works
    - _Requirements: 1.1, 15.1, 18.5_

  - [ ] 1.3 Create Rapier.js initialisation in `src/physics/RigidBodies.js`
    - Import and initialise Rapier WASM module
    - Create a Rapier world with gravity, spawn a test falling box, log positions to console
    - _Requirements: 1.2_

  - [ ] 1.4 Wire `src/main.js` entry point
    - Import SceneBuilder and RigidBodies, run both on startup
    - Confirm WebGPURenderer renders and Rapier logs falling box positions
    - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Port prototype into module structure (WebGLRenderer first)
  - [ ] 2.1 Create `src/physics/WaterSimCPU.js` — extract CPU water simulation from prototype
    - Implement heightfield water flow on a 128×128 grid (Virtual Pipes method in JS)
    - Expose API: `init(grid)`, `step(dt)`, `getWaterDepth(x, y)`, `addSource(pos, rate)`
    - _Requirements: 4.1, 4.2_

  - [ ] 2.2 Create `src/renderer/TerrainMesh.js` — terrain PlaneGeometry with vertex displacement
    - Generate PlaneGeometry matching grid dimensions
    - Sync vertex Y positions from grid terrain height data each frame
    - Apply warm earth tone vertex colours (dry) and dark olive-charcoal (wet)
    - _Requirements: 2.2, 2.3, 18.1_

  - [ ] 2.3 Create `src/physics/WaterSim.js` — facade that delegates to GPU or CPU implementation
    - Detect WebGPU availability; select WaterSimGPU or WaterSimCPU
    - Expose unified API surface for all consumers
    - _Requirements: 4.2_

  - [ ] 2.4 Create the UnifiedGrid data structure
    - Implement `src/game/UnifiedGrid.js` storing per-cell: terrain height, water depth, material type, permeability
    - 512×512 cells, cell size 0.03125 world units (16×16 world-unit basin)
    - _Requirements: 2.1, 2.4_

  - [ ] 2.5 Add water surface rendering
    - Create a separate PlaneGeometry for the water surface in SceneBuilder
    - Use MeshPhysicalMaterial with transmission, roughness 0.05, environment map reflections
    - Sync water surface vertex heights from UnifiedGrid water depth each frame
    - _Requirements: 18.2, 18.3_

  - [ ] 2.6 Integrate terrain mesh, water sim (CPU), and camera orbit into main.js
    - Wire UnifiedGrid → WaterSimCPU → TerrainMesh → water surface rendering
    - Add basic pointer-drag camera orbit (temporary, refined in Step 11)
    - Confirm visual parity with prototype: terrain sculpting, water flow, camera orbit all work
    - _Requirements: 2.2, 2.3, 15.1, 15.2_

- [ ] 3. Checkpoint — Confirm prototype port
  - Ensure terrain renders, water flows downhill on CPU sim, camera orbits freely. Ask the user if questions arise.

- [ ] 4. GPU water simulation (WebGPU compute shaders)
  - [ ] 4.1 Create `src/shaders/water-sim.wgsl` — SWE Virtual Pipes compute shader
    - Implement pressure-driven flow between adjacent cells
    - CFL-conditioned time step, 2–6 substeps per frame
    - Per-cell terrain height, water depth, material type, permeability as storage buffers
    - _Requirements: 3.1, 3.2_

  - [ ] 4.2 Create `src/physics/WaterSimGPU.js` — WebGPU compute pipeline wrapper
    - Create GPU buffers for the 512×512 grid data
    - Dispatch compute shader, read back water depth for rendering
    - Expose same API as WaterSimCPU: `init(grid)`, `step(dt)`, `getWaterDepth(x, y)`, `addSource(pos, rate)`
    - _Requirements: 3.1, 3.2, 3.6_

  - [ ] 4.3 Switch renderer from WebGLRenderer to WebGPURenderer in SceneBuilder
    - Update SceneBuilder to use Three.js WebGPURenderer
    - Ensure terrain mesh and water surface still render correctly
    - _Requirements: 1.1_

  - [ ] 4.4 Create `src/shaders/water-render.wgsl` — water surface vertex/fragment shader
    - Vertex shader displaces water plane from depth buffer
    - Fragment shader applies depth-based blue colouring
    - _Requirements: 18.2, 18.3_

  - [ ] 4.5 Wire WaterSimGPU into the main loop via WaterSim facade
    - WaterSim detects WebGPU and delegates to WaterSimGPU
    - Confirm: water from source spreads radially on flat terrain, flows downhill on slopes
    - Run for 5+ minutes without NaN or instability
    - _Requirements: 3.3, 3.4, 3.5_

  - [ ]* 4.6 Write property test for water simulation stability
    - **Property 1: Water conservation** — total water volume (sum of all cell depths × cell area) plus outflow equals cumulative inflow from sources, within floating-point tolerance
    - **Validates: Requirements 3.3, 3.5**

- [ ] 5. Checkpoint — GPU water simulation verified
  - Ensure water spreads radially on flat terrain, flows downhill on slopes, no NaN after 5 minutes. CPU fallback still works. Ask the user if questions arise.

- [ ] 6. Rigid body integration (Rapier.js)
  - [ ] 6.1 Implement full RigidBodies module in `src/physics/RigidBodies.js`
    - Create Rapier world with gravity
    - API: `addBlock(pos, size)`, `addStake(pos, height, radius)`, `addHouse(pos, scale)`, `step(dt)`, `getBodies()`, `removeBody(id)`
    - Support up to 64 bodies on desktop, 32 on mobile
    - _Requirements: 5.1, 5.6_

  - [ ] 6.2 Sync Rapier body transforms to Three.js meshes each frame
    - For each rigid body, update corresponding Three.js mesh position and quaternion from Rapier state
    - Use BoxGeometry for stone blocks, CylinderGeometry for timber stakes
    - _Requirements: 5.4_

  - [ ] 6.3 Implement block stacking and toppling
    - Place 5 stone blocks stacked on terrain, confirm stable for 10 seconds
    - Programmatically remove bottom block, confirm collapse
    - _Requirements: 5.2, 5.3_

  - [ ]* 6.4 Write property test for rigid body stability
    - **Property 2: Stack stability** — a stack of N blocks on flat terrain with no external forces maintains all block positions within epsilon of initial positions for 10 simulated seconds
    - **Validates: Requirements 5.2**

- [ ] 7. Water–rigid body coupling
  - [ ] 7.1 Implement cell blocking from rigid body AABBs
    - Each WaterSim step, query RigidBodies for all body AABBs
    - Mark overlapping UnifiedGrid cells as blocked (non-permeable, non-erodable)
    - _Requirements: 6.1_

  - [ ] 7.2 Implement water deflection around rigid bodies
    - Confirm water visibly flows around a placed stone block
    - Confirm removing a block allows water to fill the gap
    - _Requirements: 6.2, 6.3_

  - [ ] 7.3 Implement "support lost" event from erosion to rigid bodies
    - When erosion reduces terrain below a body's base beyond a threshold, fire event to RigidBodies
    - RigidBodies removes static constraint, body falls dynamically
    - _Requirements: 6.4, 6.5_

  - [ ]* 7.4 Write property test for water–rigid body coupling
    - **Property 3: Cell blocking conservation** — when a rigid body is placed, the set of blocked cells exactly matches the body's AABB footprint on the grid, and water depth in blocked cells remains zero
    - **Validates: Requirements 6.1, 6.2**

- [ ] 8. Checkpoint — Physics layers coupled
  - Ensure water deflects around blocks, removing blocks lets water fill gap, undermined blocks collapse. Ask the user if questions arise.

- [ ] 9. Material system
  - [ ] 9.1 Create `src/game/Materials.js` — material definitions and placement logic
    - Define four materials: Sand (high erosion, high permeability), Clay (low erosion, low permeability), Stone (zero erosion, near-zero permeability), Timber (degradation over time)
    - Sand/Clay placement modifies terrain height cells in UnifiedGrid
    - Stone placement creates rigid body via RigidBodies
    - Timber placement creates thin cylindrical rigid body via RigidBodies
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [ ] 9.2 Implement erosion in `src/physics/Erosion.js`
    - Per-cell erosion pass: if flow velocity > threshold (0.4), reduce terrain height at erosion rate modulated by material type
    - Sand erodes visibly faster than Clay under identical flow
    - Stone cells: zero erosion
    - Store per-cell permeability in UnifiedGrid for future seepage
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ] 9.3 Implement timber degradation during Flood_Phase
    - Timber stakes lose structural integrity over time during flooding
    - Degradation reduces effective collision or triggers removal after threshold
    - _Requirements: 7.5_

  - [ ]* 9.4 Write property test for erosion rates
    - **Property 4: Material erosion ordering** — given identical flow velocity and duration, Sand cells lose more terrain height than Clay cells, and Stone cells lose zero height
    - **Validates: Requirements 8.1, 8.2, 8.3**

- [ ] 10. House objects and flood detection
  - [ ] 10.1 Create `src/game/Houses.js` — house mesh creation and flood detection
    - Place house meshes as static Rapier rigid bodies at positions from level JSON
    - Houses are warmest, most saturated objects in scene (visually distinct)
    - Readable from all four cardinal camera angles
    - _Requirements: 9.1, 18.4, 18.6_

  - [ ] 10.2 Implement flood detection with hysteresis in `src/physics/FloodDetection.js`
    - Track per-house flood frame counter
    - Flood threshold: water depth > 0.1 for 60 consecutive frames → mark flooded
    - Unflood threshold: water depth < 0.05 for 30 consecutive frames → mark dry
    - _Requirements: 9.2, 9.4, 9.6_

  - [ ] 10.3 Implement house visual state transitions
    - Flooded house: darker, waterlogged shader
    - Dry house: normal visual state restored
    - _Requirements: 9.3, 9.5_

  - [ ]* 10.4 Write property test for flood detection hysteresis
    - **Property 5: Hysteresis prevents flickering** — a house whose overlapping cells oscillate between depth 0.08 and 0.12 every frame never transitions between flooded and dry states more than once per 60-frame window
    - **Validates: Requirements 9.2, 9.4, 9.6**

- [ ] 11. Checkpoint — Materials, erosion, houses, flood detection working
  - Ensure sand erodes faster than clay, stone is immune, houses detect flooding with hysteresis, visual states transition correctly. Ask the user if questions arise.

- [ ] 12. Game loop and phase state machine
  - [ ] 12.1 Create `src/game/GameLoop.js` — three-phase state machine
    - Construction_Phase: player sculpts and places freely, no water flowing
    - Flood_Phase: water released from source, player can observe and make minor edits
    - Resolution_Phase: evaluate win/loss, display result, offer replay
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ] 12.2 Implement win/loss evaluation
    - Win condition "all_houses_dry": all houses remain dry through flood → victory
    - Partial credit: if enabled and at least one house survives → partial credit
    - _Requirements: 10.7, 10.8_

  - [ ] 12.3 Wire GameLoop into main.js
    - GameLoop controls WaterSim start/stop, phase UI, and resolution display
    - _Requirements: 10.1_

- [ ] 13. Resource budget system
  - [ ] 13.1 Create `src/game/ResourceBudget.js` — per-material unit tracking
    - Read initial budget from level JSON
    - Track remaining units per material type
    - Decrement on placement, block placement when budget exhausted
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [ ] 13.2 Create budget display UI
    - Show remaining units per material type in construction toolbar
    - _Requirements: 11.5_

- [ ] 14. Undo system
  - [ ] 14.1 Create `src/game/UndoSystem.js` — snapshot stack for construction phase
    - Push bounding-box snapshot of affected grid cells on each sculpt/placement action
    - Pop and restore on undo
    - Max stack depth: 20 (discard oldest when full)
    - Clear stack on transition to Flood_Phase
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [ ] 14.2 Add undo UI button and keyboard shortcut
    - Undo button: 48×48px minimum in construction toolbar
    - Ctrl+Z / Cmd+Z keyboard shortcut
    - _Requirements: 12.6, 12.7_

- [ ] 15. Level data loading
  - [ ] 15.1 Create `src/game/Level.js` — JSON level loader
    - Parse level JSON: grid dimensions, terrain profile, water sources, house positions, resource budget, flood parameters
    - Initialise UnifiedGrid terrain from profile
    - Place water sources, houses, and set resource budget
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

  - [ ] 15.2 Author `src/levels/level-01.json` — Level 1 "The Basin"
    - 512×512 grid, flat centre with gentle east-west valley (128 wide, 0.3 depth)
    - Single central water source at (256, 256), radius 10, flow rate 0.018
    - 3 houses on far side at specified positions
    - Budget: 20 Sand, 10 Clay, 6 Stone, 4 Timber
    - _Requirements: 20.1, 20.2, 20.3, 20.4_

  - [ ] 15.3 Wire Level loader into GameLoop startup
    - On game start, load level-01.json, initialise all subsystems from level data
    - _Requirements: 16.1, 20.5, 20.6_

- [ ] 16. Checkpoint — Full game loop with Level 1
  - Ensure full playthrough works: build a dam, survive the flood, win. Intentionally bad dam: houses flood, lose. Partial credit works. Ask the user if questions arise.

- [ ] 17. Touch input
  - [ ] 17.1 Create `src/input/InputHandler.js` — Pointer Events unified input
    - 1-finger drag on terrain: sculpt/place material
    - 1-finger drag on empty basin: pan camera
    - 2-finger pinch: resize sculpt brush radius
    - 2-finger rotate: orbit camera horizontally
    - 2-finger spread/pinch: zoom camera
    - Long-press on terrain: open material placement picker
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

  - [ ] 17.2 Ensure all UI elements meet 48×48px minimum touch target
    - Audit all buttons: flood/drain, material selector, undo
    - _Requirements: 13.8_

- [ ] 18. Desktop keyboard and mouse input
  - [ ] 18.1 Add WASD camera controls with acceleration and damping
    - A/D: rotate horizontally, W/S: tilt up/down
    - Scroll wheel: zoom
    - Shift+scroll: resize brush
    - Smooth acceleration/damping on all camera movement
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [ ] 19. Checkpoint — Input systems complete
  - Ensure touch gestures work (1-finger sculpt, 2-finger orbit, pinch-to-zoom) in Chrome DevTools touch simulation. WASD camera smooth. All UI targets ≥ 48px. Ask the user if questions arise.

- [ ] 20. Visual polish and particle effects
  - [ ] 20.1 Implement particle system in `src/renderer/ParticleSystem.js`
    - Splash particles when flow velocity exceeds threshold
    - Droplet spray at source pipe
    - Dust/debris on rigid body collapse
    - Points geometry with billboard quad ShaderMaterial
    - Purely cosmetic, no physics feedback
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

  - [ ] 20.2 Add camera constraints and basin wall rendering
    - Constrain zoom range (full diorama at max zoom-out, close inspection at max zoom-in)
    - Render visible basin walls
    - _Requirements: 15.3, 15.4_

  - [ ] 20.3 Create material selector UI and flood/drain buttons
    - Material selector for choosing Sand/Clay/Stone/Timber
    - Flood trigger button, drain button
    - All buttons ≥ 48px touch targets
    - _Requirements: 13.8_

  - [ ] 20.4 Implement adaptive quality system
    - Monitor frame time; if > 20ms for 30 consecutive frames, reduce substeps from 6 to 2
    - If still over budget, halve water grid to 256×256 for session
    - Log downgrades to console
    - _Requirements: 17.4, 17.5, 17.6_

- [ ] 21. Final checkpoint — Level 1 complete and polished
  - Ensure full playthrough on desktop and simulated mobile. All UI ≥ 48px. Particles visible. Camera smooth. Adaptive quality triggers on throttled CPU. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each major integration point
- The 12-step development sequence from the spec is preserved in task ordering
- JavaScript ES modules throughout; WGSL for WebGPU compute and render shaders

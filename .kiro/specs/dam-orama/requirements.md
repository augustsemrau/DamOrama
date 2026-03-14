# Requirements Document

## Introduction

Dam-Orama is a physics-driven puzzle game about containing water, implemented as a browser-based game using Three.js, WebGPU, and Rapier.js. The player builds flood defences in a rotatable diorama to protect tiny houses from rising water. Each level has three phases: Construction (build defences), Flood (water released), and Resolution (win/loss evaluation). The game targets touch-first interaction with desktop keyboard/mouse as secondary input.

## Glossary

- **Diorama**: The bounded rectangular basin containing the game world, presented in isometric 3D
- **Water_Sim**: The shallow water equation simulation layer running on a unified grid (WebGPU or CPU fallback)
- **Rigid_Body_Engine**: The Rapier.js physics engine handling stone blocks, timber stakes, houses, and obstacles
- **Renderer**: The Three.js WebGPURenderer (or WebGLRenderer fallback) responsible for all visual output
- **Input_Handler**: The unified Pointer Events API input system handling touch and mouse interactions
- **Game_Loop**: The phase state machine managing Construction, Flood, and Resolution phases
- **Unified_Grid**: The shared 512×512 cell grid used by both terrain heightmap and water simulation
- **Material_System**: The subsystem managing placement, properties, and erosion behaviour of Sand, Clay, Stone, and Timber
- **Undo_System**: The construction-phase action history stack supporting terrain and placement rollback
- **House**: A small static rigid body representing a structure the player must protect from flooding
- **Flood_Detection**: The hysteresis-based system determining whether a house is flooded or dry
- **Adaptive_Quality**: The runtime system that downgrades simulation fidelity when frame budget is exceeded
- **Resource_Budget**: The per-level allocation of material units available to the player
- **Level_Loader**: The subsystem that reads level JSON data and initialises terrain, houses, water sources, and budgets
- **Construction_Phase**: The game phase where the player sculpts terrain and places materials with no water flowing
- **Flood_Phase**: The game phase where water is released and the player observes their defences being tested
- **Resolution_Phase**: The game phase where win/loss is evaluated and results are displayed
- **Erosion**: The gradual removal of soft terrain material by sustained water flow
- **Undermining**: The removal of terrain beneath a rigid body's base, causing structural collapse
- **Overtopping**: Water exceeding the height of a defence and spilling over
- **CPU_Fallback**: The 128×128 grid JavaScript water simulation for browsers without WebGPU support

## Requirements

### Requirement 1: Project Scaffold and Build System

**User Story:** As a developer, I want a working Vite + Three.js + Rapier.js project scaffold, so that I can build and run the game in a modern browser.

#### Acceptance Criteria

1. THE Renderer SHALL render a scene using Three.js WebGPURenderer in browsers that support WebGPU
2. THE Rigid_Body_Engine SHALL initialise the Rapier.js WASM module and confirm physics simulation capability on application startup
3. WHEN the application is built using Vite, THE build system SHALL produce a deployable bundle with all dependencies resolved

### Requirement 2: Terrain Mesh and Unified Grid

**User Story:** As a developer, I want a unified 512×512 grid that serves as both terrain heightmap and water simulation domain, so that terrain and water are perfectly aligned.

#### Acceptance Criteria

1. THE Unified_Grid SHALL store terrain height, water depth, material type, and permeability coefficient for each of the 512×512 cells
2. THE Renderer SHALL generate a terrain mesh from the Unified_Grid using vertex displacement on a PlaneGeometry
3. WHEN a cell's terrain height changes, THE Renderer SHALL update the corresponding vertex position in the terrain mesh within the same frame
4. THE Unified_Grid SHALL use a cell size of 0.03125 world units, mapping the 512×512 grid to a 16×16 world-unit basin

### Requirement 3: Water Simulation (WebGPU)

**User Story:** As a player, I want realistic water behaviour driven by shallow water equations, so that water flows naturally and tests my defences believably.

#### Acceptance Criteria

1. THE Water_Sim SHALL implement the Virtual Pipes method for shallow water equations using WebGPU compute shaders on the 512×512 Unified_Grid
2. THE Water_Sim SHALL determine the simulation time step using the CFL stability condition, executing 2 to 6 GPU substeps per rendered frame
3. WHEN water is released from a source on flat terrain, THE Water_Sim SHALL spread the water radially and evenly across the basin
4. WHEN terrain is sloped, THE Water_Sim SHALL flow water downhill following the terrain gradient
5. THE Water_Sim SHALL run without producing NaN values or numerical instability for at least 5 continuous minutes of simulation
6. THE Water_Sim SHALL complete all GPU compute substeps within 4 milliseconds per rendered frame on desktop hardware

### Requirement 4: Water Simulation (CPU Fallback)

**User Story:** As a player on an older device without WebGPU, I want a functional water simulation, so that I can still play the game.

#### Acceptance Criteria

1. IF WebGPU is not available in the browser, THEN THE Water_Sim SHALL fall back to a CPU-based JavaScript implementation running on a 128×128 grid
2. THE CPU_Fallback SHALL expose the same API surface as the WebGPU water simulation
3. THE CPU_Fallback SHALL maintain at least 30 frames per second on mobile devices

### Requirement 5: Rigid Body Physics

**User Story:** As a player, I want placed stone blocks and timber stakes to behave physically, so that stacking, toppling, and structural interactions feel realistic.

#### Acceptance Criteria

1. THE Rigid_Body_Engine SHALL simulate stone blocks and timber stakes as rigid bodies with accurate collision geometry
2. WHEN stone blocks are stacked, THE Rigid_Body_Engine SHALL maintain stable stacking for at least 10 seconds without drift or jitter
3. WHEN the terrain beneath a rigid body is removed, THE Rigid_Body_Engine SHALL allow the body to fall and topple dynamically
4. THE Renderer SHALL synchronise each rigid body's visual mesh position and orientation with the Rapier.js body state every frame
5. THE Rigid_Body_Engine SHALL simulate house objects as dynamic rigid bodies that can be displaced by flooding forces
6. THE Rigid_Body_Engine SHALL support up to 64 simultaneous rigid bodies on desktop and 32 on mobile without exceeding a 2 millisecond physics step budget

### Requirement 6: Water–Rigid Body Coupling

**User Story:** As a player, I want water to flow around my placed blocks and undermine poorly-founded structures, so that my building choices have realistic physical consequences.

#### Acceptance Criteria

1. WHEN a rigid body overlaps cells in the Unified_Grid, THE Water_Sim SHALL treat those cells as blocked (non-permeable, non-erodable)
2. WHEN a rigid body is placed in the path of flowing water, THE Water_Sim SHALL deflect water flow around the body
3. WHEN a rigid body is removed from the water path, THE Water_Sim SHALL allow water to fill the previously blocked cells
4. WHEN erosion removes terrain below a rigid body's base beyond a support threshold, THE Water_Sim SHALL fire a "support lost" event to the Rigid_Body_Engine
5. WHEN the Rigid_Body_Engine receives a "support lost" event, THE Rigid_Body_Engine SHALL remove the static constraint on the affected body and simulate dynamic collapse

### Requirement 7: Material System

**User Story:** As a player, I want four distinct materials with different physical properties, so that I can make interesting strategic decisions about dam construction.

#### Acceptance Criteria

1. THE Material_System SHALL support four material types: Sand, Clay, Stone blocks, and Timber stakes
2. THE Material_System SHALL assign Sand a high erosion rate and high permeability coefficient
3. THE Material_System SHALL assign Clay a low erosion rate and low permeability coefficient
4. THE Material_System SHALL assign Stone blocks zero erosion rate and near-zero permeability coefficient
5. THE Material_System SHALL assign Timber stakes a degradation rate that reduces structural integrity over time during the Flood_Phase
6. WHEN the player places Sand or Clay, THE Material_System SHALL modify terrain height cells in the Unified_Grid
7. WHEN the player places a Stone block, THE Material_System SHALL create a rigid body in the Rigid_Body_Engine
8. WHEN the player places a Timber stake, THE Material_System SHALL create a thin cylindrical rigid body in the Rigid_Body_Engine

### Requirement 8: Erosion Simulation

**User Story:** As a player, I want to see water eroding soft materials visibly, so that I can understand why my defences are failing and learn to build better ones.

#### Acceptance Criteria

1. WHEN water flow velocity in a cell exceeds the erosion threshold (0.4), THE Water_Sim SHALL incrementally reduce the terrain height of that cell at the configured erosion rate
2. WHILE water flows over Sand cells, THE Water_Sim SHALL erode Sand at a visibly faster rate than Clay under identical flow conditions
3. WHILE water flows over Stone block cells, THE Water_Sim SHALL apply zero erosion to those cells
4. THE Water_Sim SHALL store per-cell permeability data in the Unified_Grid to support future seepage modelling

### Requirement 9: House Objects and Flood Detection

**User Story:** As a player, I want to clearly see when a house is being flooded and when it recovers, so that I understand the stakes and can read the game state.

#### Acceptance Criteria

1. THE Level_Loader SHALL place house meshes at positions specified in the level JSON as static Rapier rigid bodies
2. WHEN water depth exceeds 0.1 in any cell overlapping a house footprint for 60 consecutive frames, THE Flood_Detection SHALL mark that house as flooded
3. WHEN a house is marked as flooded, THE Renderer SHALL transition the house to a waterlogged visual state (darker, waterlogged shader)
4. WHEN water depth drops below 0.05 in all cells overlapping a flooded house footprint for 30 consecutive frames, THE Flood_Detection SHALL mark that house as dry
5. WHEN a house transitions from flooded to dry, THE Renderer SHALL restore the house to its normal visual state
6. THE Flood_Detection SHALL use hysteresis thresholds (0.1 to flood, 0.05 to unflood) to prevent visual flickering from frame-to-frame depth fluctuations

### Requirement 10: Game Loop and Phase State Machine

**User Story:** As a player, I want clear Construction, Flood, and Resolution phases, so that I have time to build without pressure and can then watch my defences tested.

#### Acceptance Criteria

1. THE Game_Loop SHALL implement three sequential phases: Construction_Phase, Flood_Phase, and Resolution_Phase
2. WHILE in Construction_Phase, THE Game_Loop SHALL allow the player to sculpt terrain and place materials freely with no water flowing
3. WHEN the player triggers the flood, THE Game_Loop SHALL transition from Construction_Phase to Flood_Phase and release water from the configured source
4. WHILE in Flood_Phase, THE Game_Loop SHALL allow the player to observe the simulation and make minor terrain edits
5. WHEN all houses are flooded or the flood event completes, THE Game_Loop SHALL transition to Resolution_Phase
6. WHILE in Resolution_Phase, THE Game_Loop SHALL display the win or loss result and offer a replay option
7. WHEN the win condition is "all_houses_dry" and all houses remain dry through the flood, THE Game_Loop SHALL declare victory
8. WHEN partial credit is enabled and at least one house remains dry, THE Game_Loop SHALL award partial credit

### Requirement 11: Resource Budget System

**User Story:** As a player, I want a limited material budget per level, so that I must make strategic choices about where and how to spend resources.

#### Acceptance Criteria

1. THE Level_Loader SHALL read available material units per type from the level JSON
2. THE Resource_Budget SHALL track remaining units for each material type during Construction_Phase
3. WHEN the player places a material unit, THE Resource_Budget SHALL decrement the count for that material type by one
4. WHEN the remaining count for a material type reaches zero, THE Material_System SHALL prevent further placement of that material type
5. THE Renderer SHALL display the remaining budget for each material type in the construction UI

### Requirement 12: Undo System

**User Story:** As a player, I want to undo my last placement or sculpt action during construction, so that accidental touches do not ruin my careful work.

#### Acceptance Criteria

1. WHEN the player performs a sculpt or placement action during Construction_Phase, THE Undo_System SHALL push a snapshot of the affected grid region (bounding box of changed cells) onto the undo stack
2. WHEN the player triggers undo, THE Undo_System SHALL restore the most recent snapshot from the stack to the Unified_Grid
3. THE Undo_System SHALL maintain a maximum stack depth of 20 actions
4. WHEN the stack contains 20 actions and a new action is performed, THE Undo_System SHALL discard the oldest action
5. WHEN the Game_Loop transitions from Construction_Phase to Flood_Phase, THE Undo_System SHALL clear the undo stack
6. THE Renderer SHALL display an undo button with a minimum size of 48×48 logical pixels in the construction toolbar
7. WHEN the player presses Ctrl+Z (or Cmd+Z on macOS) during Construction_Phase, THE Undo_System SHALL trigger an undo action

### Requirement 13: Touch Input

**User Story:** As a mobile player, I want intuitive touch gestures for sculpting, camera control, and UI interaction, so that the game feels natural on a touchscreen.

#### Acceptance Criteria

1. THE Input_Handler SHALL implement all interactions using the Pointer Events API to handle both touch and mouse input uniformly
2. WHEN the player performs a 1-finger drag on terrain, THE Input_Handler SHALL activate the sculpt or material placement tool at the cursor position
3. WHEN the player performs a 1-finger drag on empty basin area, THE Input_Handler SHALL pan the camera horizontally
4. WHEN the player performs a 2-finger pinch gesture, THE Input_Handler SHALL resize the sculpt brush radius
5. WHEN the player performs a 2-finger rotate gesture, THE Input_Handler SHALL orbit the camera horizontally
6. WHEN the player performs a 2-finger spread or pinch gesture, THE Input_Handler SHALL zoom the camera in or out
7. WHEN the player long-presses on terrain, THE Input_Handler SHALL open the material placement picker
8. THE Renderer SHALL size all interactive UI elements to a minimum of 48×48 logical pixels

### Requirement 14: Desktop Keyboard and Mouse Input

**User Story:** As a desktop player, I want WASD camera controls and mouse sculpting, so that I can play comfortably with keyboard and mouse.

#### Acceptance Criteria

1. WHEN the player presses A or D, THE Input_Handler SHALL rotate the camera horizontally around the diorama
2. WHEN the player presses W or S, THE Input_Handler SHALL tilt the camera angle up or down
3. WHEN the player scrolls the mouse wheel, THE Input_Handler SHALL zoom the camera in or out
4. WHEN the player holds Shift and scrolls the mouse wheel, THE Input_Handler SHALL resize the sculpt brush radius
5. THE Input_Handler SHALL apply acceleration and damping to WASD camera movement for smooth motion

### Requirement 15: Camera System

**User Story:** As a player, I want a free-orbiting isometric camera, so that I can inspect my defences from any angle during both construction and flooding.

#### Acceptance Criteria

1. THE Renderer SHALL present the diorama in an isometric 3D perspective with the camera positioned above and looking down at the basin
2. THE Renderer SHALL allow the camera to orbit freely around the diorama with no locked views or snapping positions
3. THE Renderer SHALL constrain the camera zoom to keep the full diorama visible at maximum zoom-out and allow close inspection at maximum zoom-in
4. THE Renderer SHALL render the visible basin walls to communicate that the world is a bounded, contained object

### Requirement 16: Level Data Loading

**User Story:** As a developer, I want levels defined as JSON files, so that level design is data-driven and hand-crafted levels can be authored independently.

#### Acceptance Criteria

1. THE Level_Loader SHALL read level data from a JSON file specifying grid dimensions, terrain profile, water source configuration, house positions, resource budget, and flood parameters
2. WHEN a level JSON is loaded, THE Level_Loader SHALL initialise the Unified_Grid terrain according to the specified terrain profile
3. WHEN a level JSON is loaded, THE Level_Loader SHALL place water sources at the specified positions with the configured flow rate and radius
4. WHEN a level JSON is loaded, THE Level_Loader SHALL place house objects at the specified positions with the configured scale
5. WHEN a level JSON is loaded, THE Level_Loader SHALL initialise the Resource_Budget with the specified material allocations

### Requirement 17: Performance and Adaptive Quality

**User Story:** As a player, I want the game to run smoothly on my device, so that the experience is not ruined by low frame rates.

#### Acceptance Criteria

1. THE Renderer SHALL maintain at least 60 frames per second on desktop with WebGPU
2. THE Renderer SHALL maintain at least 30 frames per second on mobile with WebGPU
3. THE CPU_Fallback SHALL maintain at least 30 frames per second on supported devices
4. WHEN frame time exceeds 20 milliseconds for 30 consecutive frames, THE Adaptive_Quality SHALL reduce water simulation substeps from 6 to 2
5. WHEN frame time still exceeds 20 milliseconds after reducing substeps, THE Adaptive_Quality SHALL halve the water simulation grid to 256×256 for the remainder of the session
6. WHEN the Adaptive_Quality downgrades simulation fidelity, THE Adaptive_Quality SHALL log the downgrade event to the browser console

### Requirement 18: Visual Rendering

**User Story:** As a player, I want the diorama to look warm, tactile, and readable, so that I can clearly see terrain, water, materials, and houses from any angle.

#### Acceptance Criteria

1. THE Renderer SHALL render terrain using warm earth tones for dry areas and dark olive-charcoal for wet areas
2. THE Renderer SHALL render water using clear cold blue colour that deepens with water depth
3. THE Renderer SHALL render water surfaces using MeshPhysicalMaterial with transmission, low roughness (0.05), and environment map reflections
4. THE Renderer SHALL render houses as the warmest, most saturated objects in the scene to visually distinguish them as protection targets
5. THE Renderer SHALL light the scene with a single directional light and ambient hemisphere lighting
6. THE Renderer SHALL render all house objects readably from all four cardinal camera angles

### Requirement 19: Visual Particle Effects

**User Story:** As a player, I want splash and debris particles, so that water impacts and structural collapses feel dynamic and readable.

#### Acceptance Criteria

1. WHEN water flow velocity exceeds a visual threshold, THE Renderer SHALL emit splash particles at the high-velocity cells
2. WHEN the water source pipe is active, THE Renderer SHALL emit droplet spray particles at the source position
3. WHEN a rigid body collapses, THE Renderer SHALL emit dust and debris particles at the collapse location
4. THE Renderer SHALL render all particles using Points geometry with billboard quad ShaderMaterial
5. THE Renderer SHALL treat all particle effects as purely cosmetic with no feedback into the physics layers

### Requirement 20: Level 1 — "The Basin"

**User Story:** As a player, I want a simple introductory level that teaches material behaviour through low-stakes experimentation.

#### Acceptance Criteria

1. THE Level_Loader SHALL load Level 1 with a 512×512 grid, flat centre with gentle east-west valley (128 cells wide, 0.3 depth)
2. THE Level_Loader SHALL place a single central water source at grid position (256, 256) with radius 10 and flow rate 0.018
3. THE Level_Loader SHALL place 3 houses on the far side of the valley at the positions specified in the level JSON
4. THE Level_Loader SHALL provide a resource budget of 20 Sand, 10 Clay, 6 Stone, and 4 Timber units
5. WHEN the player successfully protects all 3 houses from flooding, THE Game_Loop SHALL declare victory
6. WHEN the player fails to protect at least one house, THE Game_Loop SHALL award partial credit for each surviving house

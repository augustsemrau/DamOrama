/**
 * Dam-Orama entry point — Task 12.3
 *
 * Integrates all existing modules into a working game loop:
 *   GameLoop phase machine → WaterSim (CPU fallback) → TerrainMesh + WaterRenderer
 *   OrbitControls for camera orbit
 *   RigidBodies for physics
 *
 * Requirements: 2.2, 2.3, 10.1, 15.1, 15.2
 */

import { init as initScene, CAMERA_MIN_DISTANCE, CAMERA_MAX_DISTANCE, CAMERA_MIN_POLAR_ANGLE, CAMERA_MAX_POLAR_ANGLE } from './renderer/SceneBuilder.js';
import { init as initPhysics, getBodyAABBs, getBodies, getBodyBaseY, makeBodyDynamic } from './physics/RigidBodies.js';
import { checkSupport } from './physics/SupportCheck.js';
import { init as initGrid, worldToGrid, getTerrainHeight, getMaterialTypeArray, GRID_SIZE as UG_GRID_SIZE, setPermeability, getMaterialType } from './game/UnifiedGrid.js';
import { getMaterialProperties, placeSand, placeClay, placeStone, placeTimber } from './game/Materials.js';
import * as WaterSim from './physics/WaterSim.js';
import { applyErosion } from './physics/Erosion.js';
import * as TerrainMesh from './renderer/TerrainMesh.js';
import * as WaterRenderer from './renderer/WaterRenderer.js';
import * as BodyMeshSync from './renderer/BodyMeshSync.js';
import { stepDegradation } from './physics/TimberDegradation.js';
import { updateFloodDetection } from './physics/FloodDetection.js';
import { updateHouseVisuals } from './renderer/HouseVisuals.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MOUSE } from 'three';
import * as GameLoop from './game/GameLoop.js';
import { evaluateResult } from './game/WinLoss.js';
import { getHouses } from './game/Houses.js';
import * as ResourceBudget from './game/ResourceBudget.js';
import * as BudgetDisplay from './ui/BudgetDisplay.js';
import * as UndoButton from './ui/UndoButton.js';
import * as UndoSystem from './game/UndoSystem.js';
import { loadLevel, getWaterSources, isPartialCreditEnabled } from './game/Level.js';
import * as InputHandler from './input/InputHandler.js';
import * as KeyboardInput from './input/KeyboardInput.js';
import * as ParticleSystem from './renderer/ParticleSystem.js';
import * as GameControls from './ui/GameControls.js';
import * as AdaptiveQuality from './game/AdaptiveQuality.js';
import levelData from './levels/level-01.json';

// Debug overlay to show init progress in-browser
const _dbg = document.createElement('pre');
_dbg.style.cssText = 'position:fixed;top:0;left:0;z-index:9999;color:lime;background:rgba(0,0,0,0.85);padding:12px;font-size:12px;max-height:50vh;overflow:auto;pointer-events:none;';
document.body.appendChild(_dbg);
function dbg(msg) { console.log(msg); _dbg.textContent += msg + '\n'; }

async function main() {
  dbg('[Dam-Orama] Initialising...');

  // 1. Load level data — initialises UnifiedGrid, terrain, houses, budget, flood params
  loadLevel(levelData);
  dbg('[Dam-Orama] Level loaded: ' + levelData.name);

  // 2. Initialise water simulation (CPU fallback at 128×128)
  await WaterSim.init();
  dbg('[Dam-Orama] WaterSim ready — ' + (WaterSim.isGPU() ? 'GPU 512×512' : 'CPU 128×128'));

  // 3. Set up Three.js scene, camera, and WebGPURenderer
  const { scene, camera, renderer } = await initScene();
  dbg('[Dam-Orama] SceneBuilder ready');

  // 4. Initialise Rapier.js physics world
  const { world } = await initPhysics();
  dbg('[Dam-Orama] RigidBodies ready');

  // 4b. Initialise body-mesh sync (needs scene reference)
  BodyMeshSync.init(scene);
  console.log('[Dam-Orama] BodyMeshSync ready');

  // 5. Create terrain mesh and water surface, add to scene
  const simGridSize = WaterSim.getGridSize();
  const terrainMesh = TerrainMesh.create(simGridSize);
  scene.add(terrainMesh);

  const waterMesh = WaterRenderer.create(simGridSize);
  scene.add(waterMesh);
  console.log('[Dam-Orama] TerrainMesh + WaterRenderer created (' + simGridSize + '×' + simGridSize + ')');

  // 6. Set up OrbitControls for camera orbit (Req 15.2, 15.3)
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.minDistance = CAMERA_MIN_DISTANCE;
  controls.maxDistance = CAMERA_MAX_DISTANCE;
  controls.minPolarAngle = CAMERA_MIN_POLAR_ANGLE;
  controls.maxPolarAngle = CAMERA_MAX_POLAR_ANGLE;
  // Left-click is for sculpting — use right-click to orbit, middle-click to zoom
  controls.mouseButtons = { LEFT: null, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE };
  controls.update();
  dbg('[Dam-Orama] OrbitControls attached');

  // Auto-flood fallback: if no UI interaction after 30s, auto-trigger flood
  let autoFloodElapsed = 0;
  const AUTO_FLOOD_DELAY = 30; // seconds — fallback only

  // 6a-kb. Initialise WASD keyboard camera controls (Req 14.1–14.5)
  KeyboardInput.init(controls);
  KeyboardInput.onBrushResize((e) => console.log('[KeyboardInput] brushResize', e.delta));
  console.log('[Dam-Orama] KeyboardInput attached');

  // 6a. Initialise unified input handler (Req 13.1–13.7)
  InputHandler.init(renderer.domElement, camera, terrainMesh);

  // Sculpt: place selected material on terrain (1-finger drag on terrain hit)
  InputHandler.onSculpt((e) => {
    if (GameLoop.getPhase() !== GameLoop.Phase.CONSTRUCTION) return;
    const mat = GameControls.getSelectedMaterial();
    if (!ResourceBudget.canPlace(mat)) return;

    const wx = e.position.x;
    const wz = e.position.z;
    const { x: gx, y: gy } = worldToGrid(wx, wz);
    const BRUSH = 1; // 3×3 brush radius

    // Push undo snapshot before modifying terrain
    UndoSystem.pushSnapshot(gx - BRUSH, gy - BRUSH, gx + BRUSH, gy + BRUSH);

    const SCULPT_AMOUNT = 0.15;
    switch (mat) {
      case 'sand':  placeSand(wx, wz, SCULPT_AMOUNT); break;
      case 'clay':  placeClay(wx, wz, SCULPT_AMOUNT); break;
      case 'stone': placeStone(wx, wz); break;
      case 'timber': placeTimber(wx, wz); break;
    }
    ResourceBudget.spend(mat);

    // Reset auto-flood timer on player interaction
    autoFloodElapsed = 0;
  });

  // Pan: let OrbitControls handle camera panning natively (mouse drag)
  InputHandler.onPan(() => {});

  // 2-finger gestures: let OrbitControls handle zoom/orbit natively on desktop.
  // On touch, apply to OrbitControls manually.
  InputHandler.onZoom((e) => {
    const offset = controls.object.position.clone().sub(controls.target);
    const newLen = Math.max(controls.minDistance, Math.min(controls.maxDistance, offset.length() / e.scaleFactor));
    offset.setLength(newLen);
    controls.object.position.copy(controls.target).add(offset);
    controls.update();
  });

  InputHandler.onOrbitCamera((e) => {
    if (typeof controls.rotateLeft === 'function') {
      controls.rotateLeft(e.angleDelta);
      controls.update();
    }
  });

  InputHandler.onBrushResize(() => {});

  // Long-press material picker: cycle to next material
  InputHandler.onMaterialPicker(() => {
    const order = ['sand', 'clay', 'stone', 'timber'];
    const cur = GameControls.getSelectedMaterial();
    const next = order[(order.indexOf(cur) + 1) % order.length];
    GameControls.setSelectedMaterial(next);
  });

  dbg('[Dam-Orama] InputHandler attached');

  // 6b. Create budget display overlay (Req 11.5)
  BudgetDisplay.create();
  console.log('[Dam-Orama] BudgetDisplay created');

  // 6c. Create undo button + keyboard shortcut (Req 12.6, 12.7)
  UndoButton.create(() => UndoSystem.undo());
  console.log('[Dam-Orama] UndoButton created');

  // 6d. Initialise particle system (Req 19.1–19.5)
  ParticleSystem.init(scene);
  console.log('[Dam-Orama] ParticleSystem ready');

  // 7. GameLoop starts in Construction phase — no water source yet.
  // Water source will be added when flood is triggered (by UI or auto-timer).
  console.log('[Dam-Orama] GameLoop phase:', GameLoop.getPhase(), '(no water until flood triggered)');

  // 7b. Build material type array at sim resolution for erosion.
  // The sim grid (128×128) maps 1:4 to the UnifiedGrid (512×512).
  const simScale = Math.floor(UG_GRID_SIZE / simGridSize);
  const simMaterialType = new Uint8Array(simGridSize * simGridSize);
  const simCellSize = 16 / simGridSize;

  /**
   * Sync material types from UnifiedGrid (512×512) to sim resolution.
   * Samples the UnifiedGrid cell corresponding to each sim cell.
   * Also syncs permeability from material properties into UnifiedGrid (Req 8.4).
   */
  function syncMaterialTypes() {
    for (let sy = 0; sy < simGridSize; sy++) {
      for (let sx = 0; sx < simGridSize; sx++) {
        const ugx = sx * simScale;
        const ugy = sy * simScale;
        const mat = getMaterialType(ugx, ugy);
        simMaterialType[sy * simGridSize + sx] = mat;

        // Store permeability in UnifiedGrid for future seepage (Req 8.4)
        const props = getMaterialProperties(mat);
        if (props) {
          setPermeability(ugx, ugy, props.permeability);
        }
      }
    }
  }

  // 8. Game controls toolbar — material selector + flood/drain buttons (Req 13.8)
  const triggerFloodAction = () => {
    const sources = getWaterSources();
    for (const src of sources) {
      WaterSim.addSource({ x: src.x, y: src.y }, src.rate);
    }
    GameLoop.triggerFlood();
    console.log('[Dam-Orama] Flood triggered via UI, water sources added (' + sources.length + ' sources)');
  };
  const triggerDrainAction = () => {
    console.log('[Dam-Orama] Drain triggered via UI (debug)');
  };
  GameControls.create(triggerFloodAction, triggerDrainAction);
  dbg('[Dam-Orama] GameControls created');

  // 8b. Initialise adaptive quality system (Req 17.4–17.6)
  AdaptiveQuality.init();
  console.log('[Dam-Orama] AdaptiveQuality ready');

  // Auto-flood fallback continued
  let resolutionHandled = false;

  // Log phase transitions, update controls, clear undo stack on flood (Req 12.5)
  GameLoop.setOnPhaseChange((phase) => {
    console.log('[Dam-Orama] Phase changed to:', phase);
    GameControls.setPhase(phase);
    if (phase === GameLoop.Phase.FLOOD) {
      UndoSystem.clear();
    }
  });

  // 9. Animation loop (async step with overlap guard for GPU readback)
  let stepping = false;
  let lastFrameTime = performance.now();
  renderer.setAnimationLoop(async () => {
    const dt = 1 / 60;

    // Track frame time and feed to adaptive quality (Req 17.4–17.6)
    const now = performance.now();
    const frameTimeMs = now - lastFrameTime;
    lastFrameTime = now;
    AdaptiveQuality.update(frameTimeMs);

    // Apply adaptive substep count to water sim
    WaterSim.setSubsteps(AdaptiveQuality.getSubsteps());

    // Auto-trigger flood fallback — only if no UI interaction after 30s
    if (GameLoop.getPhase() === GameLoop.Phase.CONSTRUCTION) {
      autoFloodElapsed += dt;
      if (autoFloodElapsed >= AUTO_FLOOD_DELAY) {
        triggerFloodAction();
        console.log('[Dam-Orama] Auto-flood fallback triggered after ' + AUTO_FLOOD_DELAY + 's');
      }
    }

    // Sync rigid body positions to water sim as blocked cells
    WaterSim.setBlockedCells(getBodyAABBs());

    // Only run water sim and erosion when water is active (Flood phase)
    if (GameLoop.isWaterActive()) {
      // Step water simulation (async for GPU, guard against overlapping steps)
      if (!stepping) {
        stepping = true;
        await WaterSim.step(dt);
        stepping = false;
      }

      // Apply erosion pass after water sim step (Req 8.1–8.4)
      syncMaterialTypes();
      applyErosion({
        terrainHeight: WaterSim.getTerrainHeightArray(),
        waterDepth: WaterSim.getWaterDepthArray(),
        materialType: simMaterialType,
        gridSize: simGridSize,
        cellSize: simCellSize,
        dt,
      });
    }

    // Step timber degradation — gated by actual flood phase status
    stepDegradation(dt, GameLoop.isFloodPhase());

    // Update flood detection for all houses (Req 9.2, 9.4, 9.6)
    const waterDepthQuery = (wx, wz) => {
      const { x, y } = worldToGrid(wx, wz);
      const gx = Math.max(0, Math.min(x, UG_GRID_SIZE - 1));
      const gy = Math.max(0, Math.min(y, UG_GRID_SIZE - 1));
      return WaterSim.getWaterDepth(gx, gy);
    };
    updateFloodDetection(waterDepthQuery);

    // Update house visuals based on flood state (Req 9.3, 9.5)
    updateHouseVisuals();

    // Determine if all houses are flooded for GameLoop status
    const houses = getHouses();
    const allHousesFlooded = houses.length > 0 && houses.every(h => h.flooded);

    // Update GameLoop phase state machine
    GameLoop.update(dt, { allHousesFlooded });

    // Update budget display — visible only during Construction phase (Req 11.5)
    BudgetDisplay.setVisible(GameLoop.getPhase() === GameLoop.Phase.CONSTRUCTION);
    BudgetDisplay.update(ResourceBudget.getBudget());

    // Update undo button — visible only during Construction phase (Req 12.6)
    UndoButton.setVisible(GameLoop.getPhase() === GameLoop.Phase.CONSTRUCTION);

    // Handle resolution phase transition
    if (GameLoop.getPhase() === GameLoop.Phase.RESOLUTION && !resolutionHandled) {
      resolutionHandled = true;
      const result = evaluateResult(isPartialCreditEnabled());
      console.log('[Dam-Orama] Resolution:', result.result,
        '— houses survived:', result.housesSurvived + '/' + result.housesTotal);
    }

    // Check for bodies that lost terrain support (erosion undermining)
    const terrainHeightQuery = (wx, wz) => {
      const { x, y } = worldToGrid(wx, wz);
      return getTerrainHeight(x, y);
    };
    const unsupported = checkSupport(getBodies(), getBodyBaseY, terrainHeightQuery);
    for (const id of unsupported) {
      makeBodyDynamic(id);
    }

    // Get simulation arrays for rendering
    const terrainHeightArray = WaterSim.getTerrainHeightArray();
    const waterDepthArray = WaterSim.getWaterDepthArray();

    // Update terrain mesh from simulation data
    TerrainMesh.update(terrainHeightArray, waterDepthArray);

    // Update water surface from simulation data
    WaterRenderer.update(terrainHeightArray, waterDepthArray);

    // Sync rigid body meshes from Rapier state
    BodyMeshSync.syncAll();

    // Update WASD keyboard camera controls (acceleration/damping) (Req 14.1–14.5)
    KeyboardInput.update(dt);

    // Update particle system (Req 19.1–19.5)
    ParticleSystem.update(dt);

    // Emit spray particles at water source positions during flood phase (Req 19.2)
    if (GameLoop.isFloodPhase()) {
      const sources = getWaterSources();
      for (const src of sources) {
        // Convert grid position to world position for particle emission
        const wx = (src.x / simGridSize) * 16 - 8;
        const wz = (src.y / simGridSize) * 16 - 8;
        const wy = WaterSim.getWaterDepth(src.x, src.y) + (terrainHeightArray ? terrainHeightArray[src.y * simGridSize + src.x] || 0 : 0);
        ParticleSystem.emitSpray({ x: wx, y: wy, z: wz });
      }
    }

    // Update orbit controls (damping)
    controls.update();

    // Render
    renderer.render(scene, camera);
  });

  dbg('[Dam-Orama] Render loop started ✓');
}

main().catch((err) => {
  console.error('[Dam-Orama] Fatal error during initialisation:', err);
  dbg('[FATAL] ' + err.message + '\n' + err.stack);
});

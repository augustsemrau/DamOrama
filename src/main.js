import { EventBus } from './core/EventBus.js';
import { Level } from './game/Level.js';
import { GameLoop } from './game/GameLoop.js';
import { ResourceBudget } from './game/ResourceBudget.js';
import { EditTools } from './game/EditTools.js';
import { UndoSystem } from './game/UndoSystem.js';
import { WaterSim } from './sim/WaterSim.js';
import { Erosion } from './sim/Erosion.js';
import { SceneBuilder } from './renderer/SceneBuilder.js';
import { TerrainMesh } from './renderer/TerrainMesh.js';
import { WaterMesh } from './renderer/WaterMesh.js';
import { CameraControls } from './input/CameraControls.js';
import { PointerInput } from './input/PointerInput.js';
import { createBasinWalls } from './renderer/BasinWalls.js';
import { HouseVisuals } from './renderer/HouseVisuals.js';
import { WinLoss } from './game/WinLoss.js';
import { PhaseControls } from './ui/PhaseControls.js';
import { Toolbar } from './ui/Toolbar.js';
import { BudgetDisplay } from './ui/BudgetDisplay.js';
import { Postmortem } from './ui/Postmortem.js';
import levelData from './levels/level-01.json';

let initialTerrainHeight = null;

function saveInitialTerrain(grid) {
  initialTerrainHeight = new Float32Array(grid.terrainHeight);
}

function resetAll(grid, waterSim, budget, undoSystem, winLoss, waterMesh, eventBus) {
  grid.terrainHeight.set(initialTerrainHeight);
  grid.reset();
  waterSim.reset();
  budget.reset();
  undoSystem.clear();
  winLoss.reset();
  waterMesh.update();
  eventBus.emit('terrain-changed');
}

async function main() {
  const eventBus = new EventBus();

  // Load level
  const { grid, config } = Level.load(levelData);
  const cellSize = config.grid.cellSize;
  const worldSize = grid.width * cellSize;
  saveInitialTerrain(grid);

  // Water simulation — source disabled until flood phase
  const waterSim = new WaterSim();
  waterSim.init(grid, config);
  waterSim.setSource(null);

  // Erosion
  const erosion = new Erosion(grid, eventBus, config.sim);

  // Game systems
  const gameLoop = new GameLoop(eventBus, config);
  const budget = new ResourceBudget(eventBus, config.resources);
  const editTools = new EditTools(grid, eventBus);
  const undoSystem = new UndoSystem();

  // Renderer
  const container = document.getElementById('app');
  const scene = new SceneBuilder(container);

  // Terrain
  const terrain = new TerrainMesh(grid, cellSize, eventBus);
  scene.scene.add(terrain.mesh);

  // Water source indicator (blue ring showing where water emerges)
  const srcX = (config.waterSource.position.x) * cellSize;
  const srcZ = (config.waterSource.position.y) * cellSize;
  const srcR = config.waterSource.radius * cellSize;
  const srcGeo = new (await import('three')).RingGeometry(srcR * 0.6, srcR * 1.2, 24);
  srcGeo.rotateX(-Math.PI / 2);
  const srcMat = new (await import('three')).MeshBasicMaterial({
    color: 0x4488ff, transparent: true, opacity: 0.4, side: 2
  });
  const srcMarker = new (await import('three')).Mesh(srcGeo, srcMat);
  srcMarker.position.set(srcX, 0.62, srcZ);
  scene.scene.add(srcMarker);

  // Hide source marker during flood (water is visible enough)
  eventBus.on('phase-changed', (d) => {
    srcMarker.visible = d.phase === 'construction';
  });

  // Water
  const water = new WaterMesh(grid, cellSize);
  scene.scene.add(water.mesh);

  // Basin walls
  createBasinWalls(scene.scene, worldSize);

  // Houses
  new HouseVisuals(scene.scene, grid, cellSize, config.houses, eventBus);
  const winLoss = new WinLoss(grid, eventBus, config.houses);

  // Camera
  const camControls = new CameraControls(
    scene.camera, scene.canvas, config.camera
  );

  // Input
  new PointerInput(
    scene.canvas, scene.camera, grid, cellSize,
    editTools, budget, undoSystem, eventBus
  );

  // UI
  new Toolbar(container, eventBus);
  new BudgetDisplay(container, eventBus, budget.snapshot());
  new Postmortem(container, eventBus);

  const phaseControls = new PhaseControls(container, eventBus, {
    onStartFlood: () => {
      waterSim.setSource(config.waterSource);
      gameLoop.startFlood();
    },
    onRetry: () => {
      gameLoop.retry(() => {
        waterSim.setSource(null);
        resetAll(grid, waterSim, budget, undoSystem, winLoss, water, eventBus);
      });
    }
  });

  // FPS display
  let frameCount = 0;
  let fpsAccum = 0;
  const fpsDisplay = document.createElement('div');
  fpsDisplay.style.cssText =
    'position:absolute;top:8px;left:8px;color:#0f0;font:14px monospace;z-index:10;';
  container.appendChild(fpsDisplay);

  // Render loop
  let postmortemShown = false;
  let lastTime = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    gameLoop.update(dt);

    if (gameLoop.phase === 'flood') {
      if (!gameLoop.isSourceActive()) {
        waterSim.setSource(null);
      }
      waterSim.step(dt);
      erosion.step(waterSim.velocity, dt);
      winLoss.checkFlooding();
      water.update();

      // Update flood progress bar
      const totalFloodTime = config.waterSource.durationSec + config.sim.settleTimeSec;
      phaseControls.updateFloodProgress(gameLoop._floodElapsed, totalFloodTime);
    }

    // Evaluate win/loss on transition to resolution
    if (gameLoop.phase === 'resolution' && !postmortemShown) {
      const result = winLoss.evaluate();
      eventBus.emit('postmortem-ready', result);
      postmortemShown = true;
    }
    if (gameLoop.phase !== 'resolution') {
      postmortemShown = false;
    }

    camControls.update();
    scene.render();

    frameCount++;
    fpsAccum += dt;
    if (fpsAccum >= 1.0) {
      fpsDisplay.textContent = `FPS: ${Math.round(frameCount / fpsAccum)}`;
      frameCount = 0;
      fpsAccum = 0;
    }
  }

  requestAnimationFrame(loop);
}

main();

import { EventBus } from './core/EventBus.js';
import { Level } from './game/Level.js';
import { GameLoop } from './game/GameLoop.js';
import { WaterSim } from './sim/WaterSim.js';
import { SceneBuilder } from './renderer/SceneBuilder.js';
import { TerrainMesh } from './renderer/TerrainMesh.js';
import { WaterMesh } from './renderer/WaterMesh.js';
import { CameraControls } from './input/CameraControls.js';
import { createBasinWalls } from './renderer/BasinWalls.js';
import { PhaseControls } from './ui/PhaseControls.js';
import levelData from './levels/level-01.json';

// Keep initial terrain for reset
let initialTerrainHeight = null;

function saveInitialTerrain(grid) {
  initialTerrainHeight = new Float32Array(grid.terrainHeight);
}

function resetAll(grid, waterSim, waterMesh, terrainMesh, eventBus) {
  // Restore terrain to initial state
  grid.terrainHeight.set(initialTerrainHeight);
  grid.reset(); // zeros materialHeight, waterDepth, materialId, occupancy
  waterSim.reset();
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
  waterSim.setSource(null); // disabled in construction

  // Game loop
  const gameLoop = new GameLoop(eventBus, config);

  // Renderer
  const container = document.getElementById('app');
  const scene = new SceneBuilder(container);

  // Terrain
  const terrain = new TerrainMesh(grid, cellSize, eventBus);
  scene.scene.add(terrain.mesh);

  // Water
  const water = new WaterMesh(grid, cellSize);
  scene.scene.add(water.mesh);

  // Basin walls
  createBasinWalls(scene.scene, worldSize);

  // Camera
  const camControls = new CameraControls(
    scene.camera, scene.canvas, config.camera
  );

  // Phase controls UI
  new PhaseControls(container, eventBus, {
    onStartFlood: () => {
      waterSim.setSource(config.waterSource); // enable source
      gameLoop.startFlood();
    },
    onRetry: () => {
      gameLoop.retry(() => {
        waterSim.setSource(null); // disable source
        resetAll(grid, waterSim, water, terrain, eventBus);
      });
    }
  });

  // --- FPS measurement ---
  let frameCount = 0;
  let fpsAccum = 0;
  const fpsDisplay = document.createElement('div');
  fpsDisplay.style.cssText =
    'position:absolute;top:8px;left:8px;color:#0f0;font:14px monospace;z-index:10;';
  container.appendChild(fpsDisplay);

  // Render loop
  let lastTime = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    // Game phase update
    gameLoop.update(dt);

    // Water sim runs only during flood phase
    if (gameLoop.phase === 'flood') {
      // Disable source injection once duration expires
      if (!gameLoop.isSourceActive()) {
        waterSim.setSource(null);
      }
      waterSim.step(dt);
      water.update();
    }

    camControls.update();
    scene.render();

    // FPS counter
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

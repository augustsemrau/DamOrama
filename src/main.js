import { EventBus } from './core/EventBus.js';
import { Level } from './game/Level.js';
import { WaterSim } from './sim/WaterSim.js';
import { SceneBuilder } from './renderer/SceneBuilder.js';
import { TerrainMesh } from './renderer/TerrainMesh.js';
import { WaterMesh } from './renderer/WaterMesh.js';
import { CameraControls } from './input/CameraControls.js';
import { createBasinWalls } from './renderer/BasinWalls.js';
import levelData from './levels/level-01.json';

async function main() {
  const eventBus = new EventBus();

  // Load level
  const { grid, config } = Level.load(levelData);
  const cellSize = config.grid.cellSize;
  const worldSize = grid.width * cellSize;

  // Water simulation
  const waterSim = new WaterSim();
  waterSim.init(grid, config);

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

  // --- FPS measurement ---
  let frameCount = 0;
  let fpsAccum = 0;
  const fpsDisplay = document.createElement('div');
  fpsDisplay.style.cssText =
    'position:absolute;top:8px;left:8px;color:#0f0;font:14px monospace;z-index:10;';
  container.appendChild(fpsDisplay);

  // Auto-start water for milestone 1 (no game loop yet)
  // Source is already set via init(); step() handles per-substep injection
  let simActive = true;

  // Render loop
  let lastTime = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min((now - lastTime) / 1000, 0.05); // cap at 50ms
    lastTime = now;

    if (simActive) {
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

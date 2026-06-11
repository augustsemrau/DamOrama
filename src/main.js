import { GRID_SIZE, OCC_HOUSE } from './core/Constants.js';
import { Grid } from './core/Grid.js';
import { EventBus } from './core/EventBus.js';
import { WaterSim } from './sim/WaterSim.js';
import { Erosion } from './sim/Erosion.js';
import { WinLoss } from './game/WinLoss.js';
import { Budget } from './game/Budget.js';
import { UndoSystem } from './game/UndoSystem.js';
import { EditTools } from './game/EditTools.js';
import { GameLoop } from './game/GameLoop.js';
import { Progress } from './game/Progress.js';
import { levels } from './levels/index.js';
import { SceneBuilder } from './render/SceneBuilder.js';
import { TerrainMesh } from './render/TerrainMesh.js';
import { WaterMesh } from './render/WaterMesh.js';
import { Houses, StoneBlocks, Beacon, SourceMarker } from './render/Houses.js';
import { CameraControls } from './input/CameraControls.js';
import { PointerInput } from './input/PointerInput.js';
import { SoundScape } from './audio/SoundScape.js';
import {
  Toolbar, BudgetPanel, PhaseControls, Timeline, VerdictModal, LevelSelect, HintToast,
} from './ui/components.js';

const app = document.getElementById('app');
const sceneBuilder = new SceneBuilder(app);
const sound = new SoundScape();
const progress = new Progress();

const uiRoot = document.createElement('div');
app.appendChild(uiRoot);

const levelSelect = new LevelSelect(app, levels, progress, (level) => startLevel(level));

let world = null; // everything owned by the current level

function disposeWorld() {
  if (!world) return;
  uiRoot.innerHTML = '';
  // Drop all level objects from the scene; keep lights and basin skirt.
  for (const obj of world.sceneObjects) sceneBuilder.scene.remove(obj);
  world = null;
}

function startLevel(level) {
  disposeWorld();

  const bus = new EventBus();
  const grid = new Grid(GRID_SIZE, GRID_SIZE);
  grid.terrainHeight.set(level.buildTerrain().h);
  for (const h of level.houses) {
    for (let y = h.y; y < h.y + h.h; y++) {
      for (let x = h.x; x < h.x + h.w; x++) {
        grid.occupancy[grid.index(x, y)] |= OCC_HOUSE;
      }
    }
  }

  const sim = new WaterSim(grid);
  const erosion = new Erosion(grid, sim);
  const winLoss = new WinLoss(grid, level.houses, bus);
  const budget = new Budget(level.budgets, bus);
  const undo = new UndoSystem(grid, budget, bus);
  const tools = new EditTools(grid, budget, undo, bus);
  const gameLoop = new GameLoop({ level, grid, sim, erosion, winLoss, budget, bus });

  const terrainMesh = new TerrainMesh(grid, bus, sceneBuilder.scene);
  const waterMesh = new WaterMesh(grid, sim, sceneBuilder.scene);
  const houses = new Houses(level, grid, bus, sceneBuilder.scene);
  const stones = new StoneBlocks(grid, bus, sceneBuilder.scene);
  const beacon = new Beacon(grid, sceneBuilder.scene);
  const marker = new SourceMarker(level, grid, sceneBuilder.scene);

  const camera = new CameraControls(sceneBuilder.camera, sceneBuilder.renderer.domElement);
  const pointer = new PointerInput({
    camera: sceneBuilder.camera,
    domElement: sceneBuilder.renderer.domElement,
    tools, undo,
    scene: sceneBuilder.scene,
  });

  new Toolbar(uiRoot, pointer, undo, tools, bus);
  new BudgetPanel(uiRoot, budget, bus);
  new PhaseControls(uiRoot, gameLoop, bus, sound);
  new Timeline(uiRoot, level, bus);
  new VerdictModal(uiRoot, {
    gameLoop, level, progress, bus, sound,
    onNext: () => {
      const idx = levels.findIndex((l) => l.id === level.id);
      const next = levels[idx + 1];
      if (next) startLevel(next);
      else levelSelect.show();
    },
    onLevels: () => levelSelect.show(),
  });
  new HintToast(uiRoot, level, bus);

  bus.on('phase-changed', ({ phase, verdict }) => {
    pointer.setEnabled(phase === 'build');
    waterMesh.setVisible(phase !== 'build' || true);
    if (phase === 'flood') {
      beacon.hide();
      waterMesh.setVisible(true);
    }
    if (phase === 'verdict' && verdict && !verdict.won) beacon.showAtCell(verdict.cell);
    if (phase === 'build') sound.silence();
  });

  window.__damorama = { gameLoop, grid, sim, budget, level }; // debug/test handle

  world = {
    bus, grid, sim, erosion, winLoss, budget, undo, tools, gameLoop,
    terrainMesh, waterMesh, houses, stones, beacon, camera, pointer,
    wetTimer: 0,
    sceneObjects: [
      terrainMesh.mesh, waterMesh.mesh, beacon.group, stones.group,
      ...houses.items.map((i) => i.group),
      pointer._ring, marker ? sceneBuilder.scene.children[sceneBuilder.scene.children.length - 1] : null,
    ].filter(Boolean),
  };
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (world) {
    const { gameLoop, pointer, camera, waterMesh, terrainMesh, beacon, grid, sim } = world;
    gameLoop.tick(dt);
    pointer.tick(dt, grid);
    camera.update(dt);
    beacon.update(dt);
    if (gameLoop.phase !== 'build') {
      waterMesh.update();
      sound.setFlow(sim.flowEnergy);
      world.wetTimer += dt;
      if (world.wetTimer > 0.25) {
        world.wetTimer = 0;
        terrainMesh.absorbWetness();
        if (gameLoop.phase === 'flood') terrainMesh.update();
      }
    }
  }
  sceneBuilder.render();
}
requestAnimationFrame(frame);

levelSelect.show();

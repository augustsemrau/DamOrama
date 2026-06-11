import { SIM_DT, GRID_SIZE } from '../core/Constants.js';
import { Grid } from '../core/Grid.js';
import { WaterSim } from '../sim/WaterSim.js';
import { Erosion } from '../sim/Erosion.js';
import { WinLoss } from './WinLoss.js';

// Headless flood for tests and tuning: builds the level world, optionally
// applies a build, runs the full flood + settle, returns the outcome.
// This is the level designer's wind tunnel.
export function makeWorld(level, simOpts = {}) {
  const grid = new Grid(GRID_SIZE, GRID_SIZE);
  grid.terrainHeight.set(level.buildTerrain().h);
  const sim = new WaterSim(grid, simOpts);
  const erosion = new Erosion(grid, sim);
  const winLoss = new WinLoss(grid, level.houses);
  return { grid, sim, erosion, winLoss };
}

export function runFlood(level, { build = null, extraTime = 0, simOpts = {} } = {}) {
  const world = makeWorld(level, simOpts);
  const spent = build ? build(world.grid) : 0;

  world.sim.setEmitter(level.source);
  const total = level.source.duration + level.settleTime + extraTime;
  const steps = Math.round(total / SIM_DT);
  let firstFloodTime = -1;
  for (let s = 0; s < steps; s++) {
    world.sim.step();
    world.erosion.step();
    const t = s * SIM_DT;
    const newly = world.winLoss.check(t);
    if (newly.length && firstFloodTime < 0) firstFloodTime = t;
  }
  return { ...world, spent, firstFloodTime, won: world.winLoss.allDry() };
}

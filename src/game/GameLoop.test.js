import { describe, it, expect } from 'vitest';
import { GRID_SIZE, SIM_DT, MAT_SAND } from '../core/Constants.js';
import { Grid } from '../core/Grid.js';
import { EventBus } from '../core/EventBus.js';
import { WaterSim } from '../sim/WaterSim.js';
import { Erosion } from '../sim/Erosion.js';
import { WinLoss } from './WinLoss.js';
import { Budget } from './Budget.js';
import { GameLoop } from './GameLoop.js';
import { level1 } from '../levels/level1.js';

function makeGame(level = level1) {
  const grid = new Grid(GRID_SIZE, GRID_SIZE);
  grid.terrainHeight.set(level.buildTerrain().h);
  const bus = new EventBus();
  const sim = new WaterSim(grid);
  const erosion = new Erosion(grid, sim);
  const winLoss = new WinLoss(grid, level.houses, bus);
  const budget = new Budget(level.budgets, bus);
  const loop = new GameLoop({ level, grid, sim, erosion, winLoss, budget, bus });
  return { grid, bus, sim, erosion, winLoss, budget, loop };
}

function runToVerdict(loop, frameDt = SIM_DT) {
  // Generous wall clock; tick() clamps internally.
  for (let i = 0; i < 60 * 60 && loop.phase !== 'verdict'; i++) loop.tick(frameDt);
  return loop.verdict;
}

describe('GameLoop', () => {
  it('walks build → flood → verdict and loses undefended', () => {
    const { loop } = makeGame();
    expect(loop.phase).toBe('build');
    loop.releaseWater();
    expect(loop.phase).toBe('flood');
    const verdict = runToVerdict(loop);
    expect(loop.phase).toBe('verdict');
    expect(verdict.won).toBe(false);
    expect(verdict.label).toContain('flooded');
  });

  it('retry restores build and budget to the flood-start snapshot', () => {
    const { grid, budget, loop } = makeGame();
    // Hand-place some material and spend budget.
    const i = grid.index(70, 64);
    grid.materialHeight[i] = 0.3;
    grid.materialId[i] = MAT_SAND;
    budget.spend('sand', 12);

    loop.releaseWater();
    runToVerdict(loop);
    // Flood may have eroded the material; retry must restore it bit-exact.
    loop.retry();
    expect(loop.phase).toBe('build');
    expect(grid.materialHeight[i]).toBeCloseTo(0.3, 6);
    expect(budget.left.sand).toBe(level1.budgets.sand - 12);
    expect(grid.totalWaterVolume()).toBe(0);
  });

  it('fast-forward reaches the same verdict (determinism)', () => {
    const run = (ff) => {
      const { loop } = makeGame();
      loop.releaseWater();
      loop.fastForward = ff;
      return runToVerdict(loop, ff ? SIM_DT * 2 : SIM_DT);
    };
    const a = run(false);
    const b = run(true);
    expect(a.won).toBe(b.won);
    expect(a.cause).toBe(b.cause);
    expect(a.cell).toBe(b.cell);
  });

  it('wins with the reference build and awards stars', () => {
    const { grid, budget, loop } = makeGame();
    const spent = level1.referenceSolution(grid);
    budget.spend('sand', spent.sand);
    loop.releaseWater();
    const verdict = runToVerdict(loop);
    expect(verdict.won).toBe(true);
    expect(verdict.stars).toBeGreaterThanOrEqual(1);
  });
});

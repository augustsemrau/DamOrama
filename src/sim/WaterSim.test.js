import { describe, it, expect, beforeEach } from 'vitest';
import { WaterSim } from './WaterSim.js';
import { Grid } from '../core/Grid.js';

describe('WaterSim', () => {
  let grid, sim;
  const W = 8, H = 8;

  beforeEach(() => {
    grid = new Grid(W, H);
    grid.terrainHeight.fill(0.1);
    sim = new WaterSim();
    sim.init(grid, {
      sim: { substepsPerFrame: 2 },
      waterSource: null
    });
  });

  it('init allocates flux and velocity buffers', () => {
    expect(sim.flux.length).toBe(W * H * 4);
    expect(sim.velocity.length).toBe(W * H * 2);
  });

  it('water spreads from a high cell to neighbors', () => {
    const center = grid.index(4, 4);
    grid.waterDepth[center] = 1.0;

    sim.step(1 / 60);

    expect(grid.waterDepth[center]).toBeLessThan(1.0);
    const n = grid.index(4, 3);
    const s = grid.index(4, 5);
    const e = grid.index(5, 4);
    const w = grid.index(3, 4);
    const neighborWater = grid.waterDepth[n] + grid.waterDepth[s]
      + grid.waterDepth[e] + grid.waterDepth[w];
    expect(neighborWater).toBeGreaterThan(0);
  });

  it('total water is conserved (no source/drain)', () => {
    const center = grid.index(4, 4);
    grid.waterDepth[center] = 1.0;
    let totalBefore = 0;
    for (let i = 0; i < grid.cellCount; i++) totalBefore += grid.waterDepth[i];

    sim.step(1 / 60);

    let totalAfter = 0;
    for (let i = 0; i < grid.cellCount; i++) totalAfter += grid.waterDepth[i];
    expect(totalAfter).toBeCloseTo(totalBefore, 4);
  });

  it('water does not flow into blocked cells', () => {
    const center = grid.index(4, 4);
    grid.waterDepth[center] = 1.0;

    const east = grid.index(5, 4);
    grid.occupancy[east] = 1; // STONE_BIT

    sim.step(1 / 60);

    expect(grid.waterDepth[east]).toBe(0);
  });

  it('boundary cells have zero outward flux (closed basin)', () => {
    const edge = grid.index(0, 4);
    grid.waterDepth[edge] = 1.0;

    sim.step(1 / 60);

    // West flux at x=0 must be zero (no outflow at west boundary)
    expect(sim.flux[edge * 4 + 3]).toBe(0); // F_W = 3

    // Total water conserved
    let total = 0;
    for (let i = 0; i < grid.cellCount; i++) total += grid.waterDepth[i];
    expect(total).toBeCloseTo(1.0, 4);
  });

  it('injectSource adds water capped at maxDepth', () => {
    const source = {
      position: { x: 4, y: 4 },
      radius: 1,
      flowRate: 10.0,  // high rate so flowRate * dt * iterations overshoots maxDepth
      maxDepth: 0.8
    };
    sim.setSource(source);

    // 60 calls at dt=1/60: total injected per cell = 10 * (1/60) * 60 = 10.0
    // But capped at maxDepth = 0.8
    for (let i = 0; i < 60; i++) {
      sim._injectSource(1 / 60);
    }

    const center = grid.index(4, 4);
    expect(grid.waterDepth[center]).toBeCloseTo(0.8, 4);
  });

  it('reset zeros water depth, flux, and velocity', () => {
    grid.waterDepth[grid.index(4, 4)] = 1.0;
    sim.step(1 / 60);

    sim.reset();

    for (let i = 0; i < grid.cellCount; i++) {
      expect(grid.waterDepth[i]).toBe(0);
    }
    for (let i = 0; i < sim.flux.length; i++) {
      expect(sim.flux[i]).toBe(0);
    }
  });
});

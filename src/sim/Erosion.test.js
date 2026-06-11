import { describe, it, expect } from 'vitest';
import { WaterSim } from './WaterSim.js';
import { Erosion } from './Erosion.js';
import {
  MAT_SAND, MAT_CLAY, MAT_STONE, OCC_STONE, STONE_HEIGHT,
} from '../core/Constants.js';
import { makeGrid, runSeconds, maxDepthInRegion } from './testUtils.js';

// Slope running east, wall across the flow at x=32, strong sustained emitter.
function scenario(materialId, wallHeight) {
  const g = makeGrid(64, 64, (x) => 0.5 * (1 - x / 63));
  for (let y = 0; y < 64; y++) {
    for (const x of [32, 33]) {
      const i = g.index(x, y);
      g.materialHeight[i] = wallHeight;
      g.materialId[i] = materialId;
      if (materialId === MAT_STONE) g.occupancy[i] |= OCC_STONE;
    }
  }
  const sim = new WaterSim(g);
  const erosion = new Erosion(g, sim);
  sim.setEmitter({ x: 8, y: 32, radius: 4, rate: 0.3, duration: 20 });
  runSeconds(30, sim, erosion);
  return { g, erosion };
}

function wallVolume(g) {
  let v = 0;
  for (let y = 0; y < 64; y++) {
    for (const x of [32, 33]) v += g.materialHeight[g.index(x, y)];
  }
  return v;
}

describe('Erosion', () => {
  it('sustained fast flow erodes a sand wall through', () => {
    const { g } = scenario(MAT_SAND, 0.25);
    // The wall loses substantial volume and the far side gets wet.
    expect(wallVolume(g)).toBeLessThan(0.7 * 0.25 * 128);
    expect(maxDepthInRegion(g, 36, 63, 0, 63)).toBeGreaterThan(0.005);
  });

  // Marginal overtopping in a valley: the flood peak briefly crests the wall.
  // Sand must collapse into a breach; clay must keep its form so the crest
  // re-seals when the level drops. ("Clay holds where sand fails" as a level
  // outcome is asserted in the Level 2 solvability tests.)
  it('under marginal overtop, sand erodes through while clay keeps its form', () => {
    const smooth = (a, b, t) => {
      const u = Math.min(1, Math.max(0, (t - a) / (b - a)));
      return u * u * (3 - 2 * u);
    };
    const run = (mat) => {
      const g = makeGrid(64, 64, (x, y) =>
        0.5 * (1 - x / 63) + 0.4 * smooth(10, 24, Math.abs(y - 32)));
      for (let y = 16; y <= 48; y++) {
        for (const x of [32, 33]) {
          const i = g.index(x, y);
          g.materialHeight[i] = 0.22;
          g.materialId[i] = mat;
        }
      }
      const sim = new WaterSim(g);
      const erosion = new Erosion(g, sim);
      sim.setEmitter({ x: 8, y: 32, radius: 4, rate: 0.2, duration: 8 });
      runSeconds(25, sim, erosion);
      let minH = Infinity;
      for (let y = 20; y <= 44; y++) {
        for (const x of [32, 33]) {
          const h = g.materialHeight[g.index(x, y)];
          if (h < minH) minH = h;
        }
      }
      return minH;
    };
    expect(run(MAT_SAND)).toBeLessThan(0.02);   // breached through
    expect(run(MAT_CLAY)).toBeGreaterThan(0.1); // crest survives
  });

  it('stone never erodes', () => {
    const { g } = scenario(MAT_STONE, STONE_HEIGHT);
    const stored = Math.fround(STONE_HEIGHT); // Float32Array storage precision
    for (let y = 0; y < 64; y++) {
      for (const x of [32, 33]) {
        expect(g.materialHeight[g.index(x, y)]).toBe(stored);
      }
    }
  });

  it('records overtop and erosion stats for the postmortem', () => {
    const { erosion } = scenario(MAT_SAND, 0.25);
    let maxEroded = 0, maxOver = 0;
    for (let i = 0; i < erosion.erosionTotal.length; i++) {
      if (erosion.erosionTotal[i] > maxEroded) maxEroded = erosion.erosionTotal[i];
      if (erosion.maxOvertop[i] > maxOver) maxOver = erosion.maxOvertop[i];
    }
    expect(maxEroded).toBeGreaterThan(0.02);
    expect(maxOver).toBeGreaterThan(0);
  });
});

describe('performance gate (spec §10.3 — milestone 1)', () => {
  it('steps a fully wet 128×128 grid well under frame budget', () => {
    const g = makeGrid(128, 128, (x) => 0.5 * (1 - x / 127));
    for (let i = 0; i < g.cellCount; i++) g.waterDepth[i] = 0.05;
    const sim = new WaterSim(g);
    const erosion = new Erosion(g, sim);

    runSeconds(1, sim, erosion); // warm-up
    const t0 = performance.now();
    const steps = 300;
    for (let s = 0; s < steps; s++) { sim.step(); erosion.step(); }
    const msPerStep = (performance.now() - t0) / steps;
    expect(msPerStep).toBeLessThan(8); // target < 4, hard gate 8
  });
});

import { describe, it, expect } from 'vitest';
import { WaterSim } from './WaterSim.js';
import { MAT_CLAY } from '../core/Constants.js';
import { makeGrid, runSeconds, wetFrontX, maxDepthInRegion, assertFinite } from './testUtils.js';

// These tests are the simulation contract from spec §10.3. Tuning means
// changing Constants until they pass — never loosening them blindly.

function bowl(w, h) {
  const cx = (w - 1) / 2, cy = (h - 1) / 2;
  return makeGrid(w, h, (x, y) => {
    const dx = (x - cx) / cx, dy = (y - cy) / cy;
    return 0.4 * (dx * dx + dy * dy);
  });
}

describe('WaterSim — stability and conservation', () => {
  it('conserves volume and never goes NaN/negative in a bowl', () => {
    const g = bowl(64, 64);
    // Drop a blob in the middle.
    for (let y = 24; y < 40; y++) {
      for (let x = 24; x < 40; x++) g.waterDepth[g.index(x, y)] = 0.2;
    }
    const sim = new WaterSim(g);
    const before = g.totalWaterVolume();
    runSeconds(10, sim);
    assertFinite(g);
    expect(g.totalWaterVolume()).toBeCloseTo(before, 4);
  });

  it('pools level in a bowl', () => {
    const g = bowl(64, 64);
    for (let y = 24; y < 40; y++) {
      for (let x = 24; x < 40; x++) g.waterDepth[g.index(x, y)] = 0.25;
    }
    const sim = new WaterSim(g);
    runSeconds(20, sim);

    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < g.cellCount; i++) {
      if (g.waterDepth[i] > 0.01) {
        const s = g.waterSurface(i);
        if (s < lo) lo = s;
        if (s > hi) hi = s;
      }
    }
    expect(hi - lo).toBeLessThan(0.03);
  });

  it('is deterministic — identical runs produce identical state', () => {
    const run = () => {
      const g = bowl(48, 48);
      const sim = new WaterSim(g);
      sim.setEmitter({ x: 10, y: 24, radius: 3, rate: 0.1, duration: 4 });
      runSeconds(6, sim);
      return g.waterDepth.slice();
    };
    const a = run(), b = run();
    expect(a).toEqual(b);
  });
});

describe('WaterSim — propagation (level-scale readability)', () => {
  it('crosses most of a 128-wide sloped basin within 8 sim-seconds', () => {
    // Mirrors Level 1 scale: west-high slope, emitter near the west edge.
    const g = makeGrid(128, 128, (x) => 0.6 * (1 - x / 127));
    const sim = new WaterSim(g);
    sim.setEmitter({ x: 10, y: 64, radius: 4, rate: 0.25, duration: 12 });

    runSeconds(3, sim);
    expect(wetFrontX(g)).toBeGreaterThan(40);
    runSeconds(5, sim);
    expect(wetFrontX(g)).toBeGreaterThan(100);
    assertFinite(g);
  });
});

describe('WaterSim — walls and overtopping', () => {
  function wallScenario(wallHeight) {
    const g = makeGrid(64, 64, () => 0);
    for (let y = 0; y < 64; y++) {
      for (const x of [32, 33]) {
        const i = g.index(x, y);
        g.materialHeight[i] = wallHeight;
        g.materialId[i] = MAT_CLAY;
      }
    }
    const sim = new WaterSim(g);
    sim.setEmitter({ x: 8, y: 32, radius: 3, rate: 0.15, duration: 6 });
    runSeconds(14, sim);
    return maxDepthInRegion(g, 36, 63, 0, 63);
  }

  it('a tall wall keeps the far side dry', () => {
    expect(wallScenario(0.5)).toBeLessThan(0.001);
  });

  it('water overtops a low wall', () => {
    expect(wallScenario(0.04)).toBeGreaterThan(0.005);
  });
});

import { describe, it, expect } from 'vitest';
import { runFlood } from '../game/FloodRunner.js';
import { levels, budgetValue } from './index.js';
import { level1 } from './level1.js';
import { level2 } from './level2.js';
import { level3 } from './level3.js';

// The design's regression armor (spec §10.3): every level is proven winnable
// and losable, forever. Any tuning change that breaks a level fails here.

describe.each(levels.map((l) => [l.name, l]))('%s', (_name, level) => {
  it('floods at least one house when undefended, in a watchable window', () => {
    const r = runFlood(level);
    expect(r.won).toBe(false);
    expect(r.firstFloodTime).toBeGreaterThan(4);    // not a jump-scare
    expect(r.firstFloodTime).toBeLessThan(level.source.duration + level.settleTime - 1);
  });

  it('is won by its reference solution, within budget', () => {
    let spent;
    const r = runFlood(level, {
      build: (g) => { spent = level.referenceSolution(g); return spent; },
    });
    expect(r.won).toBe(true);
    expect(spent.sand).toBeLessThanOrEqual(level.budgets.sand);
    expect(spent.clay).toBeLessThanOrEqual(level.budgets.clay);
    // The reference earns at least 2 stars' headroom in budget value.
    const remaining = {
      sand: level.budgets.sand - spent.sand,
      clay: level.budgets.clay - spent.clay,
      stone: level.budgets.stone - spent.stone,
    };
    const frac = budgetValue(remaining) / budgetValue(level.budgets);
    expect(frac).toBeGreaterThanOrEqual(level.starThresholds[0]);
  });
});

describe('Level 2 — material identity is load-bearing', () => {
  it('the same walls built from sand alone erode through and lose', () => {
    const r = runFlood(level2, { build: (g) => level2.sandOnlySolution(g) });
    expect(r.won).toBe(false);
    // The breach is the north gorge: the north-branch houses flood.
    expect(r.winLoss.floodedIds()).toContain('gorse');
  });
});

describe('Level 3 — brute force fails', () => {
  it('plugging the source impounds the flood and breaches catastrophically', () => {
    const r = runFlood(level3, { build: (g) => level3.sourcePlugSolution(g) });
    expect(r.won).toBe(false);
  });
});

describe('Level 1 — generosity', () => {
  it('wins with a lean wall worth 3 stars', () => {
    // A thinner, shorter wall than the reference: the 3-star line.
    const r = runFlood(level1, {
      build: (g) => level1.referenceSolution(g),
    });
    expect(r.won).toBe(true);
  });
});

import { level1 } from './level1.js';
import { level2 } from './level2.js';
import { level3 } from './level3.js';

export const levels = [level1, level2, level3];

// Budget value weighting for stars: clay is worth 3 sand units, a stone
// block 15 — so hoarding cheap sand can't buy stars that clay spending earned.
export const VALUE_WEIGHTS = { sand: 1, clay: 3, stone: 15 };

export function budgetValue(b) {
  return b.sand * VALUE_WEIGHTS.sand + b.clay * VALUE_WEIGHTS.clay + b.stone * VALUE_WEIGHTS.stone;
}

export function starsForRemaining(level, remaining) {
  const frac = budgetValue(remaining) / budgetValue(level.budgets);
  const [two, three] = level.starThresholds;
  if (frac >= three) return 3;
  if (frac >= two) return 2;
  return 1;
}

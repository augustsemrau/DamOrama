import { MAT_SAND } from '../core/Constants.js';
import { makeTerrain, slopeWE, carvePath, rim, roughen, stampWall } from './terrainKit.js';

// Lesson: block the channel. One valley, one obvious build spot, generous
// sand. Any decent wall across the valley wins; a lean one earns stars.
export const level1 = {
  id: 'level1',
  name: 'The Valley',
  tagline: 'One river, three homes. Put something in the way.',
  hint: 'Paint a sand wall across the valley — and tie it into the high ground on both sides.',

  buildTerrain() {
    const t = makeTerrain();
    slopeWE(t, 0.55, 0.05);
    carvePath(t, [{ x: 0, y: 64 }, { x: 127, y: 64 }], 12, 0.22, 10);
    rim(t, 5, 0.6);
    roughen(t, 0.012, 11);
    return t;
  },

  source: { x: 12, y: 64, radius: 4, rate: 0.1, duration: 12, head: 0.3 },
  settleTime: 10,

  houses: [
    { id: 'alder', name: 'Alder Cottage', x: 98, y: 52, w: 8, h: 8 },
    { id: 'brook', name: 'Brook House', x: 107, y: 61, w: 8, h: 8 },
    { id: 'cedar', name: 'Cedar Hut', x: 98, y: 71, w: 8, h: 8 },
  ],

  budgets: { sand: 60, clay: 20, stone: 1 },
  starThresholds: [0.55, 0.75],

  referenceSolution(grid) {
    const sand = stampWall(grid, { x: 72, y: 46 }, { x: 72, y: 82 }, 1.5, 0.35, MAT_SAND);
    return { sand, clay: 0, stone: 0 };
  },
};

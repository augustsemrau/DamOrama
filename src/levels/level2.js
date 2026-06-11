import { MAT_SAND, MAT_CLAY } from '../core/Constants.js';
import { makeTerrain, slopeWE, carveChannels, knoll, rim, roughen, stampWall } from './terrainKit.js';

// Lesson: the right material in the right place. The river runs through a
// deep canyon, then forks around a knoll: a narrow fast gorge north, a wide
// slow channel south. The flood is big enough that any affordable wall
// becomes a spillway — water WILL run over your crest for a while. Sand
// crests collapse into a gushing notch; clay crests hold and keep it a
// trickle. The houses stand on low pads: a trickle leaves them dry, a gush
// does not.
export const level2 = {
  id: 'level2',
  name: 'The Fork',
  tagline: 'Two channels, one batch of clay. Spend it where the water runs fast.',
  hint: 'The flood will crest your walls — that is fine. A clay crest survives it; a sand crest washes into a breach. The narrow north gorge runs fastest.',

  buildTerrain() {
    const t = makeTerrain();
    slopeWE(t, 0.62, 0.06);
    knoll(t, 66, 64, 16, 0.3);    // fork knoll — the carves cut gorge walls into it
    // North gorge sits low — it is the hot path the pool hits first and
    // hardest. The south channel's sill is higher: a slow, occasional spill.
    // One carve call: overlapping depths take the max, so the fork junction
    // stays a smooth basin instead of a stacked pit.
    carveChannels(t, [
      { points: [{ x: 0, y: 64 }, { x: 44, y: 64 }], halfWidth: 11, depth: 0.42, feather: 8 },                                     // canyon stem
      { points: [{ x: 40, y: 64 }, { x: 60, y: 50 }, { x: 96, y: 40 }, { x: 127, y: 38 }], halfWidth: 6, depth: 0.38, feather: 3 },  // north gorge
      { points: [{ x: 40, y: 64 }, { x: 58, y: 82 }, { x: 96, y: 90 }, { x: 127, y: 92 }], halfWidth: 10, depth: 0.26, feather: 4 }, // south channel
    ]);
    // East bowls give the spill somewhere to collect — deep enough that a
    // clay-crest trickle pools harmlessly below the pads, while a sand-crest
    // gush fills them past the pad tops.
    knoll(t, 106, 40, 20, -0.24);
    knoll(t, 106, 90, 16, -0.12);
    // House pads — a footing's height of safety against trickles, not gushes.
    knoll(t, 102, 37, 7, 0.12);
    knoll(t, 114, 39, 7, 0.12);
    knoll(t, 106, 88, 7, 0.12);
    rim(t, 5, 0.6);
    roughen(t, 0.012, 22);
    return t;
  },

  source: { x: 42, y: 64, radius: 4, rate: 0.5, duration: 16, head: 0.4 },
  settleTime: 10,

  houses: [
    { id: 'fern', name: 'Fern Lodge', x: 98, y: 33, w: 8, h: 8 },
    { id: 'gorse', name: 'Gorse End', x: 110, y: 35, w: 8, h: 8 },
    { id: 'heath', name: 'Heath Cottage', x: 102, y: 84, w: 8, h: 8 },
  ],

  budgets: { sand: 60, clay: 30, stone: 1 },
  starThresholds: [0.25, 0.5],

  referenceSolution(grid) {
    const clay = stampWall(grid, { x: 62, y: 40 }, { x: 62, y: 59 }, 1.5, 0.41, MAT_CLAY);
    const sand = stampWall(grid, { x: 60, y: 69 }, { x: 60, y: 96 }, 1.5, 0.325, MAT_SAND);
    return { sand, clay, stone: 0 };
  },

  // The build the level is designed to defeat: both walls from sand.
  sandOnlySolution(grid) {
    const a = stampWall(grid, { x: 62, y: 40 }, { x: 62, y: 59 }, 1.5, 0.41, MAT_SAND);
    const b = stampWall(grid, { x: 60, y: 69 }, { x: 60, y: 96 }, 1.5, 0.325, MAT_SAND);
    return { sand: a + b, clay: 0, stone: 0 };
  },
};

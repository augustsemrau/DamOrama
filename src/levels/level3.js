import { MAT_SAND, MAT_CLAY } from '../core/Constants.js';
import { makeTerrain, slopeWE, tiltNS, carvePath, knoll, rim, roughen, stampWall } from './terrainKit.js';

// Lesson: you can't block everything — redirect. A broad shallow front with
// no chokepoint; the hamlet sits in a low dish to the south-east, a deep
// sacrificial basin lies north, and the land already tilts north. The budget
// cannot wall the whole front tall enough: the winning shape is an angled
// deflector tied into the spur ridge, sending the flood north.
export const level3 = {
  id: 'level3',
  name: 'The Plain',
  tagline: 'Too much water, too little sand. Send it somewhere else.',
  hint: 'You cannot stop this flood — but the land tilts north. Angle a wall from the south heights to the spur ridge, and let the basin take it.',

  buildTerrain() {
    const t = makeTerrain();
    slopeWE(t, 0.5, 0.1);
    tiltNS(t, 0.12);                 // north side lies lower — water wants north
    knoll(t, 70, 30, 22, -0.22);     // sacrificial basin
    knoll(t, 98, 86, 16, -0.1);      // hamlet dish
    // Spur ridge: keeps the north pool from curling back into the dish, and
    // gives the deflector something to tie into.
    carvePath(t, [{ x: 88, y: 72 }, { x: 127, y: 68 }], 5, -0.28, 7);
    // Southern highland: the deflector's other anchor. Without it the west
    // pool's southern arm wraps around any wall end into the dish.
    knoll(t, 64, 114, 20, 0.3);
    // House pads
    knoll(t, 96, 84, 6, 0.05);
    knoll(t, 106, 88, 6, 0.05);
    knoll(t, 98, 94, 6, 0.05);
    rim(t, 5, 0.6);
    roughen(t, 0.012, 33);
    return t;
  },

  source: { x: 8, y: 64, radius: 5, rate: 0.38, duration: 14, head: 0.25 },
  settleTime: 12,

  houses: [
    { id: 'ivy', name: 'Ivy Den', x: 92, y: 80, w: 8, h: 8 },
    { id: 'juniper', name: 'Juniper Croft', x: 102, y: 84, w: 8, h: 8 },
    { id: 'kestrel', name: 'Kestrel Rest', x: 94, y: 90, w: 8, h: 8 },
  ],

  budgets: { sand: 55, clay: 15, stone: 0 },
  starThresholds: [0.2, 0.45],

  referenceSolution(grid) {
    // Deflector from the south heights to the spur ridge; clay armor where
    // the current strikes hardest.
    const sand = stampWall(grid, { x: 72, y: 104 }, { x: 90, y: 70 }, 1.5, 0.38, MAT_SAND);
    const clay = stampWall(grid, { x: 85, y: 80 }, { x: 90, y: 70 }, 1.5, 0.42, MAT_CLAY);
    return { sand, clay, stone: 0 };
  },

  // The build the level is designed to defeat: the beginner instinct of
  // damming right at the pipe. It impounds the whole flood in a tiny pool —
  // guaranteed deep overtop, erosion breach, catastrophe.
  sourcePlugSolution(grid) {
    const sand = stampWall(grid, { x: 22, y: 44 }, { x: 22, y: 84 }, 1.5, 0.45, MAT_SAND);
    return { sand, clay: 0, stone: 0 };
  },
};

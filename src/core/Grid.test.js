import { describe, it, expect } from 'vitest';
import { Grid } from './Grid.js';
import { MAT_SAND, MAT_NONE, OCC_STONE } from './Constants.js';

describe('Grid', () => {
  it('indexes row-major and checks bounds', () => {
    const g = new Grid(8, 4);
    expect(g.index(3, 2)).toBe(19);
    expect(g.inBounds(7, 3)).toBe(true);
    expect(g.inBounds(8, 0)).toBe(false);
    expect(g.inBounds(0, -1)).toBe(false);
  });

  it('surface and water heights stack terrain + material + water', () => {
    const g = new Grid(4, 4);
    const i = g.index(1, 1);
    g.terrainHeight[i] = 0.5;
    g.materialHeight[i] = 0.2;
    g.waterDepth[i] = 0.1;
    expect(g.surfaceHeight(i)).toBeCloseTo(0.7);
    expect(g.waterSurface(i)).toBeCloseTo(0.8);
  });

  it('snapshot/restore round-trips the build exactly', () => {
    const g = new Grid(4, 4);
    g.materialHeight[5] = 0.33;
    g.materialId[5] = MAT_SAND;
    g.occupancy[6] = OCC_STONE;
    const snap = g.snapshotBuild();

    g.materialHeight[5] = 0;
    g.materialId[5] = MAT_NONE;
    g.occupancy[6] = 0;
    g.materialHeight[7] = 0.9;

    g.restoreBuild(snap);
    expect(g.materialHeight[5]).toBeCloseTo(0.33);
    expect(g.materialId[5]).toBe(MAT_SAND);
    expect(g.occupancy[6]).toBe(OCC_STONE);
    expect(g.materialHeight[7]).toBe(0);
  });
});

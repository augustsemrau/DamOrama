import { describe, it, expect, beforeEach } from 'vitest';
import { Grid } from './Grid.js';
import { MAT_SAND, MAT_STONE, STONE_BIT, HOUSE_BIT } from './Constants.js';

describe('Grid', () => {
  let grid;
  const W = 4, H = 4;

  beforeEach(() => {
    grid = new Grid(W, H);
  });

  it('initializes with correct dimensions', () => {
    expect(grid.width).toBe(W);
    expect(grid.height).toBe(H);
    expect(grid.cellCount).toBe(W * H);
  });

  it('all buffers start zeroed', () => {
    for (let i = 0; i < grid.cellCount; i++) {
      expect(grid.terrainHeight[i]).toBe(0);
      expect(grid.materialHeight[i]).toBe(0);
      expect(grid.waterDepth[i]).toBe(0);
      expect(grid.materialId[i]).toBe(0);
      expect(grid.occupancy[i]).toBe(0);
    }
  });

  it('index converts x,y to flat index', () => {
    expect(grid.index(0, 0)).toBe(0);
    expect(grid.index(1, 0)).toBe(1);
    expect(grid.index(0, 1)).toBe(W);
    expect(grid.index(3, 3)).toBe(3 * W + 3);
  });

  it('getSurfaceHeight returns terrain + material', () => {
    const i = grid.index(1, 2);
    grid.terrainHeight[i] = 0.5;
    grid.materialHeight[i] = 0.3;
    expect(grid.getSurfaceHeight(i)).toBeCloseTo(0.8);
  });

  it('getWaterSurfaceHeight returns surface + water', () => {
    const i = grid.index(1, 1);
    grid.terrainHeight[i] = 0.5;
    grid.materialHeight[i] = 0.2;
    grid.waterDepth[i] = 0.1;
    expect(grid.getWaterSurfaceHeight(i)).toBeCloseTo(0.8);
  });

  it('isBlocked checks STONE_BIT', () => {
    const i = grid.index(2, 2);
    expect(grid.isBlocked(i)).toBe(false);
    grid.occupancy[i] |= STONE_BIT;
    expect(grid.isBlocked(i)).toBe(true);
  });

  it('isHouse checks HOUSE_BIT', () => {
    const i = grid.index(0, 0);
    expect(grid.isHouse(i)).toBe(false);
    grid.occupancy[i] |= HOUSE_BIT;
    expect(grid.isHouse(i)).toBe(true);
  });

  it('inBounds validates coordinates', () => {
    expect(grid.inBounds(0, 0)).toBe(true);
    expect(grid.inBounds(3, 3)).toBe(true);
    expect(grid.inBounds(-1, 0)).toBe(false);
    expect(grid.inBounds(0, 4)).toBe(false);
    expect(grid.inBounds(4, 0)).toBe(false);
  });

  it('reset zeros all mutable buffers but preserves terrainHeight', () => {
    const i = grid.index(1, 1);
    grid.terrainHeight[i] = 1.0;
    grid.materialHeight[i] = 0.5;
    grid.waterDepth[i] = 0.3;
    grid.materialId[i] = MAT_SAND;
    grid.occupancy[i] = STONE_BIT;

    grid.reset();

    expect(grid.terrainHeight[i]).toBe(1.0);
    expect(grid.materialHeight[i]).toBe(0);
    expect(grid.waterDepth[i]).toBe(0);
    expect(grid.materialId[i]).toBe(0);
    expect(grid.occupancy[i]).toBe(0);
  });
});

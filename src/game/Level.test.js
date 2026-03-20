import { describe, it, expect } from 'vitest';
import { Level } from './Level.js';
import { Grid } from '../core/Grid.js';
import levelData from '../levels/level-01.json';

describe('Level', () => {
  it('creates a grid with dimensions from level data', () => {
    const { grid } = Level.load(levelData);
    expect(grid.width).toBe(256);
    expect(grid.height).toBe(256);
  });

  it('generates terrain with a valley profile', () => {
    const { grid } = Level.load(levelData);
    const centerY = 128;
    const edgeY = 0;
    const centerHeight = grid.terrainHeight[grid.index(128, centerY)];
    const edgeHeight = grid.terrainHeight[grid.index(128, edgeY)];
    // Valley center should be lower than edges
    expect(centerHeight).toBeLessThan(edgeHeight);
  });

  it('terrain has non-zero values', () => {
    const { grid } = Level.load(levelData);
    let hasNonZero = false;
    for (let i = 0; i < grid.cellCount; i++) {
      if (grid.terrainHeight[i] > 0) { hasNonZero = true; break; }
    }
    expect(hasNonZero).toBe(true);
  });

  it('returns level config alongside grid', () => {
    const { grid, config } = Level.load(levelData);
    expect(config.waterSource.flowRate).toBe(0.12);
    expect(config.houses).toHaveLength(3);
    expect(config.resources.sandVolume).toBe(1600);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { WinLoss } from './WinLoss.js';
import { Grid } from '../core/Grid.js';
import { EventBus } from '../core/EventBus.js';
import { HOUSE_BIT } from '../core/Constants.js';
import { MAT_SAND } from '../core/Constants.js';

describe('WinLoss', () => {
  let grid, bus, winLoss;
  const houses = [
    { id: 'h1', position: { x: 10, y: 10 }, footprint: { w: 3, h: 3 }, floodThreshold: 0.05 }
  ];

  beforeEach(() => {
    grid = new Grid(16, 16);
    grid.terrainHeight.fill(0.1);
    bus = new EventBus();
    winLoss = new WinLoss(grid, bus, houses);

    // Mark house footprint
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        grid.occupancy[grid.index(10 + dx, 10 + dy)] |= HOUSE_BIT;
      }
    }
  });

  it('detects no flooding when houses are dry', () => {
    winLoss.checkFlooding();
    const result = winLoss.evaluate();
    expect(result.won).toBe(true);
    expect(result.firstFloodedHouse).toBe(null);
  });

  it('detects flooding when water exceeds threshold', () => {
    // Flood the house footprint
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        grid.waterDepth[grid.index(10 + dx, 10 + dy)] = 0.1;
      }
    }

    const flooded = [];
    bus.on('house-flooded', (d) => flooded.push(d.houseId));

    winLoss.checkFlooding();

    expect(flooded).toContain('h1');
  });

  it('evaluate returns loss with failure cause', () => {
    // Place some material that got overtopped
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        const i = grid.index(10 + dx, 10 + dy);
        grid.waterDepth[i] = 0.1;
      }
    }

    // Add material near breach area (still intact = overtopped)
    grid.materialHeight[grid.index(8, 10)] = 0.3;
    grid.materialId[grid.index(8, 10)] = MAT_SAND;

    winLoss.checkFlooding();
    const result = winLoss.evaluate();

    expect(result.won).toBe(false);
    expect(result.firstFloodedHouse).toBe('h1');
    expect(result.failureCause).toMatch(/overtopped|eroded/);
  });

  it('reset clears flood state', () => {
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        grid.waterDepth[grid.index(10 + dx, 10 + dy)] = 0.1;
      }
    }
    winLoss.checkFlooding();
    winLoss.reset();

    const result = winLoss.evaluate();
    expect(result.won).toBe(true);
  });
});

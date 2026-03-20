import { describe, it, expect, beforeEach } from 'vitest';
import { EditTools } from './EditTools.js';
import { UndoSystem } from './UndoSystem.js';
import { ResourceBudget } from './ResourceBudget.js';
import { Grid } from '../core/Grid.js';
import { EventBus } from '../core/EventBus.js';
import { MAT_SAND, MAT_CLAY, MAT_STONE, MAT_NONE, STONE_BIT } from '../core/Constants.js';

describe('EditTools', () => {
  let grid, bus, tools, budget, undo;

  beforeEach(() => {
    grid = new Grid(16, 16);
    grid.terrainHeight.fill(0.1);
    bus = new EventBus();
    tools = new EditTools(grid, bus);
    budget = new ResourceBudget(bus, {
      sandVolume: 100, clayVolume: 50, stoneBlocks: 5
    });
    undo = new UndoSystem();
  });

  it('paint adds material and spends budget', () => {
    undo.beginStroke();
    const spent = tools.paint(8, 8, 0, MAT_SAND, budget, undo);
    undo.endStroke();

    const i = grid.index(8, 8);
    expect(grid.materialId[i]).toBe(MAT_SAND);
    expect(grid.materialHeight[i]).toBeGreaterThan(0);
    expect(spent).toBeGreaterThan(0);
    expect(budget.sandVolume).toBeLessThan(100);
  });

  it('paint stone sets occupancy STONE_BIT', () => {
    undo.beginStroke();
    tools.paint(4, 4, 0, MAT_STONE, budget, undo);
    undo.endStroke();

    const i = grid.index(4, 4);
    expect(grid.materialId[i]).toBe(MAT_STONE);
    expect(grid.occupancy[i] & STONE_BIT).toBeTruthy();
    expect(budget.stoneBlocks).toBe(4);
  });

  it('paint does not exceed budget', () => {
    const smallBudget = new ResourceBudget(bus, {
      sandVolume: 0, clayVolume: 0, stoneBlocks: 0
    });
    const spent = tools.paint(8, 8, 2, MAT_SAND, smallBudget, null);
    expect(spent).toBe(0);
  });

  it('smooth conserves total material volume', () => {
    // Place some uneven material
    const i1 = grid.index(7, 8);
    const i2 = grid.index(8, 8);
    const i3 = grid.index(9, 8);
    grid.materialHeight[i1] = 0.6;
    grid.materialHeight[i2] = 0.2;
    grid.materialHeight[i3] = 0.4;
    grid.materialId[i1] = MAT_SAND;
    grid.materialId[i2] = MAT_SAND;
    grid.materialId[i3] = MAT_SAND;

    const totalBefore = grid.materialHeight[i1] + grid.materialHeight[i2] + grid.materialHeight[i3];

    tools.smooth(8, 8, 1, null);

    const totalAfter = grid.materialHeight[i1] + grid.materialHeight[i2] + grid.materialHeight[i3];
    expect(totalAfter).toBeCloseTo(totalBefore, 4);
  });

  it('smooth skips stone cells', () => {
    const si = grid.index(8, 8);
    grid.materialHeight[si] = 0.5;
    grid.materialId[si] = MAT_STONE;

    const original = grid.materialHeight[si];
    tools.smooth(8, 8, 1, null);
    expect(grid.materialHeight[si]).toBe(original);
  });

  it('remove clears material and refunds budget', () => {
    // Place first
    undo.beginStroke();
    tools.paint(8, 8, 0, MAT_SAND, budget, undo);
    undo.endStroke();

    const sandBefore = budget.sandVolume;

    undo.beginStroke();
    tools.remove(8, 8, 0, budget, undo);
    undo.endStroke();

    const i = grid.index(8, 8);
    expect(grid.materialId[i]).toBe(MAT_NONE);
    expect(grid.materialHeight[i]).toBe(0);
    expect(budget.sandVolume).toBeGreaterThan(sandBefore);
  });

  it('remove stone refunds block count', () => {
    tools.paint(4, 4, 0, MAT_STONE, budget, null);
    expect(budget.stoneBlocks).toBe(4);

    tools.remove(4, 4, 0, budget, null);
    expect(budget.stoneBlocks).toBe(5);
  });

  it('undo restores grid state after paint', () => {
    const i = grid.index(8, 8);
    undo.beginStroke();
    tools.paint(8, 8, 0, MAT_SAND, budget, undo);
    undo.endStroke();

    undo.undo(grid, null);
    expect(grid.materialId[i]).toBe(MAT_NONE);
    expect(grid.materialHeight[i]).toBe(0);
  });

  it('emits terrain-changed on paint', () => {
    const events = [];
    bus.on('terrain-changed', () => events.push(true));
    tools.paint(8, 8, 0, MAT_SAND, budget, null);
    expect(events.length).toBeGreaterThan(0);
  });
});

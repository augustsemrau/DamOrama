import { describe, it, expect, beforeEach } from 'vitest';
import { Grid } from '../core/Grid.js';
import { EventBus } from '../core/EventBus.js';
import { Budget } from './Budget.js';
import { UndoSystem } from './UndoSystem.js';
import { EditTools } from './EditTools.js';
import { MAT_SAND, MAT_CLAY, OCC_HOUSE, STONE_SIZE, STONE_HEIGHT } from '../core/Constants.js';

let grid, budget, undo, tools, bus;

beforeEach(() => {
  grid = new Grid(64, 64);
  bus = new EventBus();
  budget = new Budget({ sand: 10, clay: 5, stone: 2 }, bus);
  undo = new UndoSystem(grid, budget, bus);
  tools = new EditTools(grid, budget, undo, bus);
});

describe('paint', () => {
  it('places material and drains the budget by placed volume', () => {
    undo.beginStroke();
    const placed = tools.paint(32, 32, 5, MAT_SAND, 0.5);
    undo.endStroke();
    expect(placed).toBeGreaterThan(0);
    expect(budget.left.sand).toBeCloseTo(10 - placed, 5);
    expect(grid.totalMaterialVolume()).toBeGreaterThan(0);
  });

  it('never exceeds the budget', () => {
    undo.beginStroke();
    let placed = 0;
    for (let s = 0; s < 200; s++) placed += tools.paint(32, 32, 8, MAT_SAND, 0.5);
    undo.endStroke();
    expect(placed).toBeCloseTo(10, 4);
    expect(budget.left.sand).toBeCloseTo(0, 5);
  });

  it('does not paint over houses', () => {
    const hi = grid.index(32, 32);
    grid.occupancy[hi] |= OCC_HOUSE;
    undo.beginStroke();
    tools.paint(32, 32, 2, MAT_CLAY, 1);
    undo.endStroke();
    expect(grid.materialHeight[hi]).toBe(0);
  });
});

describe('remove', () => {
  it('refunds what it erases', () => {
    undo.beginStroke();
    const placed = tools.paint(32, 32, 5, MAT_SAND, 0.5);
    undo.endStroke();
    undo.beginStroke();
    for (let s = 0; s < 100; s++) tools.remove(32, 32, 8, 0.5);
    undo.endStroke();
    expect(grid.totalMaterialVolume()).toBeCloseTo(0, 4);
    expect(budget.left.sand).toBeCloseTo(10, 3);
  });
});

describe('smooth', () => {
  it('conserves placed volume', () => {
    undo.beginStroke();
    tools.paint(32, 32, 4, MAT_SAND, 1);
    undo.endStroke();
    const before = grid.totalMaterialVolume();
    undo.beginStroke();
    for (let s = 0; s < 20; s++) tools.smooth(32, 32, 6, 0.1);
    undo.endStroke();
    expect(grid.totalMaterialVolume()).toBeCloseTo(before, 4);
  });

  it('flattens peaks', () => {
    undo.beginStroke();
    tools.paint(32, 32, 3, MAT_SAND, 1);
    undo.endStroke();
    const peakBefore = Math.max(...grid.materialHeight);
    undo.beginStroke();
    for (let s = 0; s < 30; s++) tools.smooth(32, 32, 6, 0.1);
    undo.endStroke();
    expect(Math.max(...grid.materialHeight)).toBeLessThan(peakBefore);
  });
});

describe('stone', () => {
  it('stamps an impermeable block and spends one from the budget', () => {
    const block = tools.placeStone(32, 32);
    expect(block).toBeTruthy();
    expect(budget.left.stone).toBe(1);
    const i = grid.index(32, 32);
    expect(grid.materialHeight[i]).toBeCloseTo(STONE_HEIGHT);
    expect(grid.isStone(i)).toBe(true);
  });

  it('rejects overlap with houses or other stone', () => {
    tools.placeStone(32, 32);
    expect(tools.placeStone(33, 33)).toBeNull();
    grid.occupancy[grid.index(50, 50)] |= OCC_HOUSE;
    expect(tools.placeStone(50, 50)).toBeNull();
  });

  it('removes a block with full refund', () => {
    tools.placeStone(32, 32);
    expect(tools.removeStoneAt(32, 32)).toBe(true);
    expect(budget.left.stone).toBe(2);
    expect(grid.isStone(grid.index(32, 32))).toBe(false);
    expect(grid.materialHeight[grid.index(32, 32)]).toBe(0);
  });
});

describe('undo', () => {
  it('restores grid and budget exactly after a paint stroke', () => {
    const h0 = grid.materialHeight.slice();
    undo.beginStroke();
    tools.paint(32, 32, 5, MAT_SAND, 0.7);
    undo.endStroke();
    expect(undo.undo()).toBe(true);
    expect(grid.materialHeight).toEqual(h0);
    expect(budget.left.sand).toBeCloseTo(10, 6);
  });

  it('undoes stone placement including the block list side', () => {
    tools.placeStone(32, 32);
    undo.undo();
    expect(grid.isStone(grid.index(32, 32))).toBe(false);
    expect(budget.left.stone).toBe(2);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { UndoSystem } from './UndoSystem.js';
import { Grid } from '../core/Grid.js';
import { MAT_SAND } from '../core/Constants.js';

describe('UndoSystem', () => {
  let undo, grid;

  beforeEach(() => {
    undo = new UndoSystem();
    grid = new Grid(4, 4);
  });

  it('starts with no undo available', () => {
    expect(undo.canUndo).toBe(false);
  });

  it('records and restores cell state on undo', () => {
    const i = grid.index(1, 1);

    undo.beginStroke();
    undo.recordCell(i, grid);
    grid.materialHeight[i] = 0.5;
    grid.materialId[i] = MAT_SAND;
    undo.endStroke();

    expect(undo.canUndo).toBe(true);

    undo.undo(grid, null);

    expect(grid.materialHeight[i]).toBe(0);
    expect(grid.materialId[i]).toBe(0);
    expect(undo.canUndo).toBe(false);
  });

  it('records each cell only once per stroke', () => {
    const i = grid.index(2, 2);

    undo.beginStroke();
    undo.recordCell(i, grid); // first time: captures 0
    grid.materialHeight[i] = 0.3;
    undo.recordCell(i, grid); // second time: ignored
    grid.materialHeight[i] = 0.6;
    undo.endStroke();

    undo.undo(grid, null);
    expect(grid.materialHeight[i]).toBe(0); // restored to original 0, not 0.3
  });

  it('supports multiple undo levels', () => {
    const i = grid.index(0, 0);

    // Stroke 1
    undo.beginStroke();
    undo.recordCell(i, grid);
    grid.materialHeight[i] = 0.2;
    undo.endStroke();

    // Stroke 2
    undo.beginStroke();
    undo.recordCell(i, grid);
    grid.materialHeight[i] = 0.5;
    undo.endStroke();

    undo.undo(grid, null);
    expect(grid.materialHeight[i]).toBeCloseTo(0.2, 5); // Float32Array precision

    undo.undo(grid, null);
    expect(grid.materialHeight[i]).toBe(0);
  });

  it('empty stroke is not pushed', () => {
    undo.beginStroke();
    undo.endStroke();
    expect(undo.canUndo).toBe(false);
  });

  it('clear removes all history', () => {
    const i = grid.index(0, 0);
    undo.beginStroke();
    undo.recordCell(i, grid);
    grid.materialHeight[i] = 1;
    undo.endStroke();

    undo.clear();
    expect(undo.canUndo).toBe(false);
  });
});

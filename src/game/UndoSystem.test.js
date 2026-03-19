import { describe, it, expect, beforeEach } from 'vitest';
import * as Grid from './UnifiedGrid.js';
import {
  pushSnapshot,
  undo,
  getStackDepth,
  clear,
} from './UndoSystem.js';

describe('UndoSystem', () => {
  beforeEach(() => {
    Grid.init();
    clear();
  });

  // ── pushSnapshot + undo (Req 12.1, 12.2) ─────────────────────────

  describe('pushSnapshot and undo', () => {
    it('restores terrain height after undo', () => {
      // Capture original state
      pushSnapshot(0, 0, 2, 2);

      // Modify grid
      Grid.setTerrainHeight(1, 1, 5.0);
      expect(Grid.getTerrainHeight(1, 1)).toBe(5.0);

      // Undo should restore
      expect(undo()).toBe(true);
      expect(Grid.getTerrainHeight(1, 1)).toBe(0);
    });

    it('restores material type after undo', () => {
      pushSnapshot(0, 0, 2, 2);
      Grid.setMaterialType(1, 1, 3); // STONE
      expect(undo()).toBe(true);
      expect(Grid.getMaterialType(1, 1)).toBe(0); // NONE
    });

    it('restores permeability after undo', () => {
      pushSnapshot(0, 0, 2, 2);
      Grid.setPermeability(1, 1, 0.01);
      expect(undo()).toBe(true);
      expect(Grid.getPermeability(1, 1)).toBe(1.0);
    });

    it('restores only the affected bounding box region', () => {
      Grid.setTerrainHeight(5, 5, 10.0);
      pushSnapshot(0, 0, 2, 2);
      Grid.setTerrainHeight(1, 1, 99.0);

      undo();
      // Inside snapshot region: restored
      expect(Grid.getTerrainHeight(1, 1)).toBe(0);
      // Outside snapshot region: untouched
      expect(Grid.getTerrainHeight(5, 5)).toBe(10.0);
    });

    it('supports multiple sequential undos (LIFO order)', () => {
      // First action
      pushSnapshot(0, 0, 0, 0);
      Grid.setTerrainHeight(0, 0, 1.0);

      // Second action
      pushSnapshot(0, 0, 0, 0);
      Grid.setTerrainHeight(0, 0, 2.0);

      expect(Grid.getTerrainHeight(0, 0)).toBe(2.0);

      // Undo second → back to 1.0
      undo();
      expect(Grid.getTerrainHeight(0, 0)).toBe(1.0);

      // Undo first → back to 0
      undo();
      expect(Grid.getTerrainHeight(0, 0)).toBe(0);
    });
  });

  // ── undo on empty stack ───────────────────────────────────────────

  describe('undo on empty stack', () => {
    it('returns false when stack is empty', () => {
      expect(undo()).toBe(false);
    });

    it('returns false after all snapshots have been undone', () => {
      pushSnapshot(0, 0, 0, 0);
      undo();
      expect(undo()).toBe(false);
    });
  });

  // ── getStackDepth (Req 12.3) ──────────────────────────────────────

  describe('getStackDepth', () => {
    it('starts at 0', () => {
      expect(getStackDepth()).toBe(0);
    });

    it('increments on push', () => {
      pushSnapshot(0, 0, 0, 0);
      expect(getStackDepth()).toBe(1);
      pushSnapshot(0, 0, 0, 0);
      expect(getStackDepth()).toBe(2);
    });

    it('decrements on undo', () => {
      pushSnapshot(0, 0, 0, 0);
      pushSnapshot(0, 0, 0, 0);
      undo();
      expect(getStackDepth()).toBe(1);
    });
  });

  // ── max stack depth (Req 12.3, 12.4) ─────────────────────────────

  describe('max stack depth', () => {
    it('caps at 20 entries', () => {
      for (let i = 0; i < 25; i++) {
        pushSnapshot(0, 0, 0, 0);
      }
      expect(getStackDepth()).toBe(20);
    });

    it('discards oldest when full and new snapshot is pushed', () => {
      // Push 20 snapshots, each with a unique terrain value at (0,0)
      for (let i = 0; i < 20; i++) {
        pushSnapshot(0, 0, 0, 0);
        Grid.setTerrainHeight(0, 0, i + 1);
      }
      expect(getStackDepth()).toBe(20);

      // Push 21st — oldest (height=0 snapshot) is discarded
      pushSnapshot(0, 0, 0, 0);
      Grid.setTerrainHeight(0, 0, 99);
      expect(getStackDepth()).toBe(20);

      // Undo all 20 — the last undo should restore height=1 (not 0)
      for (let i = 0; i < 19; i++) {
        undo();
      }
      // The oldest remaining snapshot captured height=1
      undo();
      expect(Grid.getTerrainHeight(0, 0)).toBe(1);

      // No more undos
      expect(undo()).toBe(false);
    });
  });

  // ── clear (Req 12.5) ─────────────────────────────────────────────

  describe('clear', () => {
    it('empties the stack', () => {
      pushSnapshot(0, 0, 0, 0);
      pushSnapshot(0, 0, 0, 0);
      clear();
      expect(getStackDepth()).toBe(0);
      expect(undo()).toBe(false);
    });
  });

  // ── edge cases ────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles single-cell snapshot', () => {
      Grid.setTerrainHeight(100, 100, 7.5);
      pushSnapshot(100, 100, 100, 100);
      Grid.setTerrainHeight(100, 100, 0);
      undo();
      expect(Grid.getTerrainHeight(100, 100)).toBe(7.5);
    });

    it('clamps out-of-bounds coordinates to grid range', () => {
      // Should not throw — coordinates get clamped
      pushSnapshot(-5, -5, 600, 600);
      expect(getStackDepth()).toBe(1);
      expect(undo()).toBe(true);
    });
  });
});

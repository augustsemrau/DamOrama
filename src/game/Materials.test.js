import { describe, it, expect, beforeEach } from 'vitest';
import {
  MATERIAL_PROPERTIES,
  placeSand,
  placeClay,
  placeStone,
  placeTimber,
  getMaterialProperties,
} from './Materials.js';
import {
  MaterialType,
  init as initGrid,
  getTerrainHeight,
  getMaterialType,
  getPermeability,
  worldToGrid,
  GRID_SIZE,
} from './UnifiedGrid.js';
import {
  init as initRigidBodies,
  getBodies,
  getBodyCount,
  getBody,
} from '../physics/RigidBodies.js';

describe('Materials', () => {
  // ── Property definitions ──────────────────────────────────────────

  describe('MATERIAL_PROPERTIES', () => {
    it('Sand has high erosion rate and high permeability (Req 7.2)', () => {
      const s = MATERIAL_PROPERTIES.SAND;
      expect(s.erosionRate).toBeGreaterThan(MATERIAL_PROPERTIES.CLAY.erosionRate);
      expect(s.permeability).toBeGreaterThan(MATERIAL_PROPERTIES.CLAY.permeability);
      expect(s.degradationRate).toBe(0);
    });

    it('Clay has low erosion rate and low permeability (Req 7.3)', () => {
      const c = MATERIAL_PROPERTIES.CLAY;
      expect(c.erosionRate).toBeGreaterThan(0);
      expect(c.erosionRate).toBeLessThan(MATERIAL_PROPERTIES.SAND.erosionRate);
      expect(c.permeability).toBeGreaterThan(0);
      expect(c.permeability).toBeLessThan(MATERIAL_PROPERTIES.SAND.permeability);
      expect(c.degradationRate).toBe(0);
    });

    it('Stone has zero erosion and near-zero permeability (Req 7.4)', () => {
      const st = MATERIAL_PROPERTIES.STONE;
      expect(st.erosionRate).toBe(0);
      expect(st.permeability).toBeCloseTo(0.01);
      expect(st.degradationRate).toBe(0);
    });

    it('Timber has degradation over time (Req 7.5)', () => {
      const t = MATERIAL_PROPERTIES.TIMBER;
      expect(t.degradationRate).toBeGreaterThan(0);
    });
  });

  // ── getMaterialProperties ─────────────────────────────────────────

  describe('getMaterialProperties', () => {
    it('returns correct properties for each material type', () => {
      expect(getMaterialProperties(MaterialType.SAND)).toBe(MATERIAL_PROPERTIES.SAND);
      expect(getMaterialProperties(MaterialType.CLAY)).toBe(MATERIAL_PROPERTIES.CLAY);
      expect(getMaterialProperties(MaterialType.STONE)).toBe(MATERIAL_PROPERTIES.STONE);
      expect(getMaterialProperties(MaterialType.TIMBER)).toBe(MATERIAL_PROPERTIES.TIMBER);
    });

    it('returns null for NONE or unknown types', () => {
      expect(getMaterialProperties(MaterialType.NONE)).toBeNull();
      expect(getMaterialProperties(99)).toBeNull();
    });
  });

  // ── Sand / Clay placement (terrain modification) ──────────────────

  describe('placeSand (Req 7.6)', () => {
    beforeEach(() => {
      initGrid();
    });

    it('raises terrain height in a 3×3 area centred on target cell', () => {
      const wx = 0;
      const wz = 0;
      const amount = 0.5;
      placeSand(wx, wz, amount);

      const { x: cx, y: cy } = worldToGrid(wx, wz);

      // All 9 cells in the 3×3 brush should be raised
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          expect(getTerrainHeight(cx + dx, cy + dy)).toBeCloseTo(amount, 5);
        }
      }
    });

    it('sets material type to SAND in affected cells', () => {
      placeSand(0, 0, 0.1);
      const { x: cx, y: cy } = worldToGrid(0, 0);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          expect(getMaterialType(cx + dx, cy + dy)).toBe(MaterialType.SAND);
        }
      }
    });

    it('sets permeability to sand value in affected cells', () => {
      placeSand(0, 0, 0.1);
      const { x: cx, y: cy } = worldToGrid(0, 0);
      expect(getPermeability(cx, cy)).toBeCloseTo(MATERIAL_PROPERTIES.SAND.permeability);
    });

    it('accumulates height on repeated placement', () => {
      placeSand(0, 0, 0.3);
      placeSand(0, 0, 0.2);
      const { x: cx, y: cy } = worldToGrid(0, 0);
      expect(getTerrainHeight(cx, cy)).toBeCloseTo(0.5, 5);
    });
  });

  describe('placeClay (Req 7.6)', () => {
    beforeEach(() => {
      initGrid();
    });

    it('raises terrain height in a 3×3 area centred on target cell', () => {
      placeClay(1, 1, 0.4);
      const { x: cx, y: cy } = worldToGrid(1, 1);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          expect(getTerrainHeight(cx + dx, cy + dy)).toBeCloseTo(0.4, 5);
        }
      }
    });

    it('sets material type to CLAY in affected cells', () => {
      placeClay(1, 1, 0.1);
      const { x: cx, y: cy } = worldToGrid(1, 1);
      expect(getMaterialType(cx, cy)).toBe(MaterialType.CLAY);
    });

    it('sets permeability to clay value in affected cells', () => {
      placeClay(1, 1, 0.1);
      const { x: cx, y: cy } = worldToGrid(1, 1);
      expect(getPermeability(cx, cy)).toBeCloseTo(MATERIAL_PROPERTIES.CLAY.permeability);
    });
  });

  // ── Stone placement (rigid body) ──────────────────────────────────

  describe('placeStone (Req 7.7)', () => {
    beforeEach(async () => {
      initGrid();
      await initRigidBodies();
    });

    it('creates a rigid body and returns a valid ID', () => {
      const id = placeStone(0, 0);
      expect(id).not.toBeNull();
      expect(typeof id).toBe('number');
      expect(getBodyCount()).toBe(1);
    });

    it('creates a block-type body', () => {
      const id = placeStone(0, 0);
      const entry = getBody(id);
      expect(entry.type).toBe('block');
    });

    it('positions the block on top of terrain', () => {
      // Raise terrain first
      placeSand(2, 2, 1.0);
      const { x: cx, y: cy } = worldToGrid(2, 2);
      const terrainY = getTerrainHeight(cx, cy);

      const id = placeStone(2, 2);
      const bodies = getBodies();
      const stone = bodies.find((b) => b.id === id);
      // Block centre should be at terrainY + 0.25 (half-extent)
      expect(stone.position.y).toBeCloseTo(terrainY + 0.25, 2);
    });
  });

  // ── Timber placement (rigid body) ─────────────────────────────────

  describe('placeTimber (Req 7.8)', () => {
    beforeEach(async () => {
      initGrid();
      await initRigidBodies();
    });

    it('creates a rigid body and returns a valid ID', () => {
      const id = placeTimber(0, 0);
      expect(id).not.toBeNull();
      expect(typeof id).toBe('number');
      expect(getBodyCount()).toBe(1);
    });

    it('creates a stake-type body', () => {
      const id = placeTimber(0, 0);
      const entry = getBody(id);
      expect(entry.type).toBe('stake');
    });

    it('positions the stake base on terrain', () => {
      placeSand(-1, -1, 0.5);
      const { x: cx, y: cy } = worldToGrid(-1, -1);
      const terrainY = getTerrainHeight(cx, cy);

      const id = placeTimber(-1, -1);
      const bodies = getBodies();
      const timber = bodies.find((b) => b.id === id);
      // Stake centre should be at terrainY + halfHeight (0.5)
      expect(timber.position.y).toBeCloseTo(terrainY + 0.5, 2);
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────

  describe('edge cases', () => {
    beforeEach(() => {
      initGrid();
    });

    it('placeSand near grid edge clamps without error', () => {
      // World coord -8,-8 maps to grid (0,0); brush extends to (-1,-1) which clamps to (0,0)
      expect(() => placeSand(-8, -8, 0.1)).not.toThrow();
      expect(getTerrainHeight(0, 0)).toBeGreaterThan(0);
    });

    it('placeClay near grid edge clamps without error', () => {
      expect(() => placeClay(7.99, 7.99, 0.1)).not.toThrow();
      expect(getTerrainHeight(GRID_SIZE - 1, GRID_SIZE - 1)).toBeGreaterThan(0);
    });
  });
});

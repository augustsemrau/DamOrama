import { describe, it, expect, beforeEach } from 'vitest';
import {
  GRID_SIZE, CELL_SIZE, BASIN_SIZE,
  MaterialType, DEFAULT_PERMEABILITY,
  init, idx,
  getTerrainHeight, setTerrainHeight,
  getWaterDepth, setWaterDepth,
  getMaterialType, setMaterialType,
  getPermeability, setPermeability,
  worldToGrid, gridToWorld,
  getTerrainHeightArray, getWaterDepthArray,
  getMaterialTypeArray, getPermeabilityArray,
} from './UnifiedGrid.js';

describe('UnifiedGrid', () => {
  beforeEach(() => {
    init();
  });

  describe('constants', () => {
    it('should have GRID_SIZE 512', () => {
      expect(GRID_SIZE).toBe(512);
    });

    it('should have CELL_SIZE 0.03125', () => {
      expect(CELL_SIZE).toBeCloseTo(0.03125, 10);
    });

    it('should have BASIN_SIZE 16', () => {
      expect(BASIN_SIZE).toBe(16);
    });

    it('GRID_SIZE * CELL_SIZE should equal BASIN_SIZE', () => {
      expect(GRID_SIZE * CELL_SIZE).toBeCloseTo(BASIN_SIZE, 10);
    });
  });

  describe('MaterialType enum', () => {
    it('should define all five material types', () => {
      expect(MaterialType.NONE).toBe(0);
      expect(MaterialType.SAND).toBe(1);
      expect(MaterialType.CLAY).toBe(2);
      expect(MaterialType.STONE).toBe(3);
      expect(MaterialType.TIMBER).toBe(4);
    });
  });

  describe('DEFAULT_PERMEABILITY', () => {
    it('should map each material to its default permeability', () => {
      expect(DEFAULT_PERMEABILITY[MaterialType.NONE]).toBe(1.0);
      expect(DEFAULT_PERMEABILITY[MaterialType.SAND]).toBe(0.8);
      expect(DEFAULT_PERMEABILITY[MaterialType.CLAY]).toBe(0.1);
      expect(DEFAULT_PERMEABILITY[MaterialType.STONE]).toBe(0.01);
      expect(DEFAULT_PERMEABILITY[MaterialType.TIMBER]).toBe(0.5);
    });
  });

  describe('init', () => {
    it('should allocate arrays of correct size', () => {
      expect(getTerrainHeightArray()).toBeInstanceOf(Float32Array);
      expect(getTerrainHeightArray().length).toBe(512 * 512);
      expect(getWaterDepthArray()).toBeInstanceOf(Float32Array);
      expect(getWaterDepthArray().length).toBe(512 * 512);
      expect(getMaterialTypeArray()).toBeInstanceOf(Uint8Array);
      expect(getMaterialTypeArray().length).toBe(512 * 512);
      expect(getPermeabilityArray()).toBeInstanceOf(Float32Array);
      expect(getPermeabilityArray().length).toBe(512 * 512);
    });

    it('should default terrain height to 0', () => {
      expect(getTerrainHeight(0, 0)).toBe(0);
      expect(getTerrainHeight(255, 255)).toBe(0);
      expect(getTerrainHeight(511, 511)).toBe(0);
    });

    it('should default water depth to 0', () => {
      expect(getWaterDepth(0, 0)).toBe(0);
      expect(getWaterDepth(511, 511)).toBe(0);
    });

    it('should default material type to NONE (0)', () => {
      expect(getMaterialType(0, 0)).toBe(MaterialType.NONE);
      expect(getMaterialType(511, 511)).toBe(MaterialType.NONE);
    });

    it('should default permeability to 1.0', () => {
      expect(getPermeability(0, 0)).toBe(1.0);
      expect(getPermeability(255, 255)).toBe(1.0);
      expect(getPermeability(511, 511)).toBe(1.0);
    });
  });

  describe('idx', () => {
    it('should compute row-major flat index', () => {
      expect(idx(0, 0)).toBe(0);
      expect(idx(1, 0)).toBe(1);
      expect(idx(0, 1)).toBe(512);
      expect(idx(511, 511)).toBe(512 * 512 - 1);
    });
  });

  describe('terrain height get/set', () => {
    it('should store and retrieve terrain height', () => {
      setTerrainHeight(10, 20, 3.5);
      expect(getTerrainHeight(10, 20)).toBeCloseTo(3.5, 5);
    });

    it('should not affect other cells', () => {
      setTerrainHeight(10, 20, 3.5);
      expect(getTerrainHeight(11, 20)).toBe(0);
    });
  });

  describe('water depth get/set', () => {
    it('should store and retrieve water depth', () => {
      setWaterDepth(100, 200, 1.25);
      expect(getWaterDepth(100, 200)).toBeCloseTo(1.25, 5);
    });
  });

  describe('material type get/set', () => {
    it('should store and retrieve material type', () => {
      setMaterialType(50, 50, MaterialType.CLAY);
      expect(getMaterialType(50, 50)).toBe(MaterialType.CLAY);
    });
  });

  describe('permeability get/set', () => {
    it('should store and retrieve permeability', () => {
      setPermeability(300, 400, 0.01);
      expect(getPermeability(300, 400)).toBeCloseTo(0.01, 5);
    });
  });

  describe('worldToGrid', () => {
    it('should map world origin (0,0) to grid centre (256,256)', () => {
      const { x, y } = worldToGrid(0, 0);
      expect(x).toBe(256);
      expect(y).toBe(256);
    });

    it('should map bottom-left corner (-8,-8) to grid (0,0)', () => {
      const { x, y } = worldToGrid(-8, -8);
      expect(x).toBe(0);
      expect(y).toBe(0);
    });

    it('should map near top-right corner to grid (511,511)', () => {
      // Just inside the last cell
      const { x, y } = worldToGrid(8 - CELL_SIZE / 2, 8 - CELL_SIZE / 2);
      expect(x).toBe(511);
      expect(y).toBe(511);
    });
  });

  describe('gridToWorld', () => {
    it('should map grid (0,0) to world cell centre near (-8,-8)', () => {
      const { x, z } = gridToWorld(0, 0);
      expect(x).toBeCloseTo(-8 + CELL_SIZE / 2, 5);
      expect(z).toBeCloseTo(-8 + CELL_SIZE / 2, 5);
    });

    it('should map grid (256,256) to world near origin', () => {
      const { x, z } = gridToWorld(256, 256);
      expect(x).toBeCloseTo(CELL_SIZE / 2, 5);
      expect(z).toBeCloseTo(CELL_SIZE / 2, 5);
    });
  });

  describe('worldToGrid / gridToWorld round-trip', () => {
    it('should round-trip from grid to world and back', () => {
      const gx = 100, gy = 200;
      const world = gridToWorld(gx, gy);
      const grid = worldToGrid(world.x, world.z);
      expect(grid.x).toBe(gx);
      expect(grid.y).toBe(gy);
    });
  });
});

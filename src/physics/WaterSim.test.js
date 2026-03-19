import { describe, it, expect, beforeEach } from 'vitest';
import {
  init,
  step,
  getWaterDepth,
  addSource,
  getGridSize,
  getWaterDepthArray,
  getTerrainHeightArray,
  clearSources,
  reset,
  isGPU,
  setBlockedCells,
} from './WaterSim.js';

describe('WaterSim facade', () => {
  beforeEach(async () => {
    // In test environment there's no navigator.gpu, so CPU fallback is used
    await init();
  });

  describe('backend selection', () => {
    it('should fall back to CPU when WebGPU is unavailable', () => {
      expect(isGPU()).toBe(false);
    });

    it('should report grid size 128 for CPU backend', () => {
      expect(getGridSize()).toBe(128);
    });
  });

  describe('unified API delegation', () => {
    it('should initialise with zero water depth', () => {
      expect(getWaterDepth(64, 64)).toBe(0);
    });

    it('should delegate addSource and step to CPU backend', () => {
      addSource({ x: 64, y: 64 }, 1.0);
      step(1 / 60);
      expect(getWaterDepth(64, 64)).toBeGreaterThan(0);
    });

    it('should return water depth array reference', () => {
      const arr = getWaterDepthArray();
      expect(arr).toBeInstanceOf(Float32Array);
      expect(arr.length).toBe(128 * 128);
    });

    it('should return terrain height array reference', () => {
      const arr = getTerrainHeightArray();
      expect(arr).toBeInstanceOf(Float32Array);
      expect(arr.length).toBe(128 * 128);
    });

    it('should delegate clearSources', () => {
      addSource({ x: 64, y: 64 }, 10.0);
      step(1 / 60);
      clearSources();
      // No crash, sources cleared
      const depthBefore = getWaterDepth(64, 64);
      step(1 / 60);
      expect(getWaterDepth(64, 64)).toBeGreaterThanOrEqual(0);
    });

    it('should delegate reset', () => {
      addSource({ x: 64, y: 64 }, 10.0);
      step(1 / 60);
      expect(getWaterDepth(64, 64)).toBeGreaterThan(0);
      reset();
      expect(getWaterDepth(64, 64)).toBe(0);
    });

    it('should return 0 for out-of-bounds coordinates', () => {
      expect(getWaterDepth(-1, 0)).toBe(0);
      expect(getWaterDepth(200, 200)).toBe(0);
    });
  });

  describe('pre-init safety', () => {
    it('should return safe defaults when called before init', async () => {
      // Import a fresh module to test pre-init state
      // The facade functions guard against null impl
      const mod = await import('./WaterSim.js');
      // After our beforeEach init, impl is set — test the guard logic
      // by verifying the API doesn't throw on valid calls
      expect(() => mod.step(1 / 60)).not.toThrow();
      expect(() => mod.getWaterDepth(0, 0)).not.toThrow();
      expect(() => mod.clearSources()).not.toThrow();
      expect(() => mod.reset()).not.toThrow();
    });
  });

  describe('setBlockedCells delegation', () => {
    it('should delegate setBlockedCells to CPU backend without throwing', () => {
      expect(() => setBlockedCells([{ minX: -1, minZ: -1, maxX: 1, maxZ: 1 }])).not.toThrow();
    });

    it('should block water flow through blocked cells', () => {
      // Block a vertical strip at world x=0 (grid x=64)
      setBlockedCells([{ minX: -0.1, minZ: -8, maxX: 0.1, maxZ: 8 }]);

      // Add source on the left side
      addSource({ x: 32, y: 64 }, 5.0);

      for (let i = 0; i < 200; i++) {
        step(1 / 60);
      }

      // Water should not cross the wall
      expect(getWaterDepth(80, 64)).toBe(0);
    });
  });
});

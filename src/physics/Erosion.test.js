import { describe, it, expect } from 'vitest';
import { applyErosion, EROSION_THRESHOLD } from './Erosion.js';
import { MaterialType } from '../game/UnifiedGrid.js';

const GRID = 16; // small grid for fast tests
const CELL_SIZE = 16 / GRID; // 1.0

/**
 * Helper: create a flat grid with given material type and a water surface
 * gradient that produces a known velocity.
 */
function makeGrid(matType, opts = {}) {
  const n = GRID * GRID;
  const terrainHeight = new Float32Array(n);
  const waterDepth = new Float32Array(n);
  const materialType = new Uint8Array(n);

  const terrainH = opts.terrainH ?? 1.0;
  const waterH = opts.waterH ?? 0.5;

  terrainHeight.fill(terrainH);
  waterDepth.fill(waterH);
  materialType.fill(matType);

  return { terrainHeight, waterDepth, materialType };
}

/**
 * Helper: create a water surface gradient in the x-direction so that
 * velocity ≈ gradient / cellSize. We set water depth to create a slope.
 */
function applyWaterGradient(waterDepth, gridSize, slope) {
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      // Water depth increases linearly with x → surface gradient = slope
      waterDepth[y * gridSize + x] = 0.5 + slope * x * CELL_SIZE;
    }
  }
}

describe('Erosion', () => {
  it('should export EROSION_THRESHOLD = 0.4', () => {
    expect(EROSION_THRESHOLD).toBe(0.4);
  });

  describe('Req 8.1: erosion when velocity > threshold', () => {
    it('should reduce terrain height when flow velocity exceeds threshold', () => {
      const { terrainHeight, waterDepth, materialType } = makeGrid(MaterialType.SAND);
      // Create a steep water gradient to produce high velocity
      applyWaterGradient(waterDepth, GRID, 2.0);

      const initialHeight = terrainHeight[Math.floor(GRID / 2) * GRID + Math.floor(GRID / 2)];

      applyErosion({
        terrainHeight,
        waterDepth,
        materialType,
        gridSize: GRID,
        cellSize: CELL_SIZE,
        dt: 1.0,
      });

      // Interior cell should have been eroded
      const midIdx = Math.floor(GRID / 2) * GRID + Math.floor(GRID / 2);
      expect(terrainHeight[midIdx]).toBeLessThan(initialHeight);
    });

    it('should NOT erode when velocity is below threshold', () => {
      const { terrainHeight, waterDepth, materialType } = makeGrid(MaterialType.SAND);
      // Flat water surface → zero velocity → no erosion
      waterDepth.fill(0.5);

      const initialHeight = terrainHeight[0];

      applyErosion({
        terrainHeight,
        waterDepth,
        materialType,
        gridSize: GRID,
        cellSize: CELL_SIZE,
        dt: 1.0,
      });

      // No cell should have changed
      for (let i = 0; i < GRID * GRID; i++) {
        expect(terrainHeight[i]).toBe(initialHeight);
      }
    });
  });

  describe('Req 8.2: Sand erodes faster than Clay', () => {
    it('should erode Sand more than Clay under identical flow', () => {
      // Sand grid
      const sand = makeGrid(MaterialType.SAND);
      applyWaterGradient(sand.waterDepth, GRID, 2.0);
      const sandInitial = sand.terrainHeight[Math.floor(GRID / 2) * GRID + Math.floor(GRID / 2)];

      // Clay grid — identical setup
      const clay = makeGrid(MaterialType.CLAY);
      applyWaterGradient(clay.waterDepth, GRID, 2.0);
      const clayInitial = clay.terrainHeight[Math.floor(GRID / 2) * GRID + Math.floor(GRID / 2)];

      const params = { gridSize: GRID, cellSize: CELL_SIZE, dt: 1.0 };

      applyErosion({ ...sand, ...params });
      applyErosion({ ...clay, ...params });

      const midIdx = Math.floor(GRID / 2) * GRID + Math.floor(GRID / 2);
      const sandLoss = sandInitial - sand.terrainHeight[midIdx];
      const clayLoss = clayInitial - clay.terrainHeight[midIdx];

      expect(sandLoss).toBeGreaterThan(0);
      expect(clayLoss).toBeGreaterThan(0);
      expect(sandLoss).toBeGreaterThan(clayLoss);
    });
  });

  describe('Req 8.3: Stone has zero erosion', () => {
    it('should not erode Stone cells regardless of flow velocity', () => {
      const { terrainHeight, waterDepth, materialType } = makeGrid(MaterialType.STONE);
      applyWaterGradient(waterDepth, GRID, 5.0); // very steep gradient

      const initialHeights = new Float32Array(terrainHeight);

      applyErosion({
        terrainHeight,
        waterDepth,
        materialType,
        gridSize: GRID,
        cellSize: CELL_SIZE,
        dt: 1.0,
      });

      for (let i = 0; i < GRID * GRID; i++) {
        expect(terrainHeight[i]).toBe(initialHeights[i]);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle dt = 0 gracefully (no erosion)', () => {
      const { terrainHeight, waterDepth, materialType } = makeGrid(MaterialType.SAND);
      applyWaterGradient(waterDepth, GRID, 2.0);
      const initial = new Float32Array(terrainHeight);

      applyErosion({
        terrainHeight,
        waterDepth,
        materialType,
        gridSize: GRID,
        cellSize: CELL_SIZE,
        dt: 0,
      });

      for (let i = 0; i < GRID * GRID; i++) {
        expect(terrainHeight[i]).toBe(initial[i]);
      }
    });

    it('should handle negative dt gracefully (no erosion)', () => {
      const { terrainHeight, waterDepth, materialType } = makeGrid(MaterialType.SAND);
      applyWaterGradient(waterDepth, GRID, 2.0);
      const initial = new Float32Array(terrainHeight);

      applyErosion({
        terrainHeight,
        waterDepth,
        materialType,
        gridSize: GRID,
        cellSize: CELL_SIZE,
        dt: -1,
      });

      for (let i = 0; i < GRID * GRID; i++) {
        expect(terrainHeight[i]).toBe(initial[i]);
      }
    });

    it('should never reduce terrain below 0', () => {
      const { terrainHeight, waterDepth, materialType } = makeGrid(MaterialType.SAND, {
        terrainH: 0.001, // very low terrain
      });
      applyWaterGradient(waterDepth, GRID, 5.0);

      applyErosion({
        terrainHeight,
        waterDepth,
        materialType,
        gridSize: GRID,
        cellSize: CELL_SIZE,
        dt: 100, // large dt to force heavy erosion
      });

      for (let i = 0; i < GRID * GRID; i++) {
        expect(terrainHeight[i]).toBeGreaterThanOrEqual(0);
      }
    });

    it('should skip cells with no water', () => {
      const { terrainHeight, waterDepth, materialType } = makeGrid(MaterialType.SAND);
      waterDepth.fill(0); // no water anywhere
      const initial = new Float32Array(terrainHeight);

      applyErosion({
        terrainHeight,
        waterDepth,
        materialType,
        gridSize: GRID,
        cellSize: CELL_SIZE,
        dt: 1.0,
      });

      for (let i = 0; i < GRID * GRID; i++) {
        expect(terrainHeight[i]).toBe(initial[i]);
      }
    });

    it('should work with null materialType (defaults to no erosion)', () => {
      const n = GRID * GRID;
      const terrainHeight = new Float32Array(n).fill(1.0);
      const waterDepth = new Float32Array(n).fill(0.5);
      applyWaterGradient(waterDepth, GRID, 2.0);
      const initial = new Float32Array(terrainHeight);

      applyErosion({
        terrainHeight,
        waterDepth,
        materialType: null,
        gridSize: GRID,
        cellSize: CELL_SIZE,
        dt: 1.0,
      });

      // NONE material → getMaterialProperties returns null → erosionRate = 0
      for (let i = 0; i < GRID * GRID; i++) {
        expect(terrainHeight[i]).toBe(initial[i]);
      }
    });
  });
});

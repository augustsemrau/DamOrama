/**
 * Erosion — per-cell terrain height reduction driven by water flow velocity.
 *
 * Estimates flow velocity from water surface height gradients, then
 * reduces terrain height for cells exceeding the erosion threshold.
 * Erosion rate is modulated by material type (Sand > Clay > Stone = 0).
 *
 * Also stores per-cell permeability in UnifiedGrid for future seepage.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

import { MaterialType } from '../game/UnifiedGrid.js';
import { getMaterialProperties } from '../game/Materials.js';

/** Flow velocity threshold below which no erosion occurs. */
export const EROSION_THRESHOLD = 0.4;

/**
 * Estimate flow velocity magnitude at cell (x, y) from water surface
 * height gradients using central differences.
 *
 * velocity ≈ sqrt((dh/dx)² + (dh/dy)²)
 *
 * where h = terrainHeight + waterDepth (water surface elevation).
 *
 * @param {Float32Array} terrainHeight
 * @param {Float32Array} waterDepth
 * @param {number} gridSize
 * @param {number} cellSize
 * @param {number} x
 * @param {number} y
 * @returns {number} estimated velocity magnitude
 */
function estimateVelocity(terrainHeight, waterDepth, gridSize, cellSize, x, y) {
  const idx = (cx, cy) => cy * gridSize + cx;

  const surface = (cx, cy) => terrainHeight[idx(cx, cy)] + waterDepth[idx(cx, cy)];

  const hC = surface(x, y);

  // dh/dx — use forward/backward difference at boundaries, central otherwise
  let dhDx = 0;
  if (x > 0 && x < gridSize - 1) {
    dhDx = (surface(x + 1, y) - surface(x - 1, y)) / (2 * cellSize);
  } else if (x === 0 && gridSize > 1) {
    dhDx = (surface(x + 1, y) - hC) / cellSize;
  } else if (x === gridSize - 1 && gridSize > 1) {
    dhDx = (hC - surface(x - 1, y)) / cellSize;
  }

  // dh/dy — same approach
  let dhDy = 0;
  if (y > 0 && y < gridSize - 1) {
    dhDy = (surface(x, y + 1) - surface(x, y - 1)) / (2 * cellSize);
  } else if (y === 0 && gridSize > 1) {
    dhDy = (surface(x, y + 1) - hC) / cellSize;
  } else if (y === gridSize - 1 && gridSize > 1) {
    dhDy = (hC - surface(x, y - 1)) / cellSize;
  }

  return Math.sqrt(dhDx * dhDx + dhDy * dhDy);
}

/**
 * Apply one erosion pass over the grid.
 *
 * For each cell with water, estimates flow velocity from the water surface
 * gradient. If velocity exceeds EROSION_THRESHOLD, reduces terrain height
 * by: erosionRate × (velocity − threshold) × dt.
 *
 * Terrain height is never reduced below 0.
 *
 * Modifies `terrainHeight` in-place.
 *
 * @param {object} params
 * @param {Float32Array} params.terrainHeight — terrain height per cell (modified in-place)
 * @param {Float32Array} params.waterDepth — water depth per cell
 * @param {Uint8Array|null} [params.materialType] — material type per cell (MaterialType enum). Defaults to NONE (no erosion).
 * @param {number} params.gridSize — grid dimension (e.g. 128)
 * @param {number} params.cellSize — cell size in world units
 * @param {number} params.dt — time step in seconds
 */
export function applyErosion({ terrainHeight, waterDepth, materialType, gridSize, cellSize, dt }) {
  if (dt <= 0) return;

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const i = y * gridSize + x;

      // Skip cells with no water — no flow, no erosion
      if (waterDepth[i] <= 0) continue;

      // Look up material erosion rate
      const matType = materialType ? materialType[i] : MaterialType.NONE;
      const props = getMaterialProperties(matType);
      const erosionRate = props ? props.erosionRate : 0;

      // Stone and Timber have zero erosion rate — skip early
      if (erosionRate <= 0) continue;

      // Estimate flow velocity from water surface gradient
      const velocity = estimateVelocity(terrainHeight, waterDepth, gridSize, cellSize, x, y);

      // Only erode if velocity exceeds threshold
      if (velocity <= EROSION_THRESHOLD) continue;

      // Reduce terrain height: rate × (v − threshold) × dt
      const erosionAmount = erosionRate * (velocity - EROSION_THRESHOLD) * dt;
      terrainHeight[i] = Math.max(0, terrainHeight[i] - erosionAmount);
    }
  }
}

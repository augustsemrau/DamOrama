/**
 * UnifiedGrid — Single source of truth for all grid data.
 *
 * Stores per-cell terrain height, water depth, material type, and
 * permeability on a 512×512 grid mapping to a 16×16 world-unit basin.
 *
 * Requirements: 2.1, 2.4
 */

export const GRID_SIZE = 512;
export const BASIN_SIZE = 16;
export const CELL_SIZE = BASIN_SIZE / GRID_SIZE; // 0.03125

/**
 * Material type enum.
 */
export const MaterialType = {
  NONE: 0,
  SAND: 1,
  CLAY: 2,
  STONE: 3,
  TIMBER: 4,
};

/**
 * Default permeability by material type.
 */
export const DEFAULT_PERMEABILITY = {
  [MaterialType.NONE]: 1.0,
  [MaterialType.SAND]: 0.8,
  [MaterialType.CLAY]: 0.1,
  [MaterialType.STONE]: 0.01,
  [MaterialType.TIMBER]: 0.5,
};

const CELL_COUNT = GRID_SIZE * GRID_SIZE;

/** @type {Float32Array|null} */ let terrainHeight = null;
/** @type {Float32Array|null} */ let waterDepth = null;
/** @type {Uint8Array|null} */   let materialType = null;
/** @type {Float32Array|null} */ let permeability = null;

/**
 * Flat index from grid coordinates.
 * @param {number} x — column (0..511)
 * @param {number} y — row (0..511)
 * @returns {number}
 */
export function idx(x, y) {
  return y * GRID_SIZE + x;
}

/**
 * Allocate all arrays and fill with defaults.
 * terrain=0, water=0, material=NONE, permeability=1.0
 */
export function init() {
  terrainHeight = new Float32Array(CELL_COUNT);
  waterDepth = new Float32Array(CELL_COUNT);
  materialType = new Uint8Array(CELL_COUNT);
  permeability = new Float32Array(CELL_COUNT);
  permeability.fill(1.0);
}

// --- Terrain height ---

/** @param {number} x @param {number} y @returns {number} */
export function getTerrainHeight(x, y) {
  return terrainHeight[idx(x, y)];
}

/** @param {number} x @param {number} y @param {number} h */
export function setTerrainHeight(x, y, h) {
  terrainHeight[idx(x, y)] = h;
}

// --- Water depth ---

/** @param {number} x @param {number} y @returns {number} */
export function getWaterDepth(x, y) {
  return waterDepth[idx(x, y)];
}

/** @param {number} x @param {number} y @param {number} d */
export function setWaterDepth(x, y, d) {
  waterDepth[idx(x, y)] = d;
}

// --- Material type ---

/** @param {number} x @param {number} y @returns {number} */
export function getMaterialType(x, y) {
  return materialType[idx(x, y)];
}

/** @param {number} x @param {number} y @param {number} type */
export function setMaterialType(x, y, type) {
  materialType[idx(x, y)] = type;
}

// --- Permeability ---

/** @param {number} x @param {number} y @returns {number} */
export function getPermeability(x, y) {
  return permeability[idx(x, y)];
}

/** @param {number} x @param {number} y @param {number} p */
export function setPermeability(x, y, p) {
  permeability[idx(x, y)] = p;
}

// --- Coordinate conversion ---

/**
 * Convert world coordinates to grid cell.
 * World origin (0, 0) maps to grid centre. World range is [-8, 8] on both axes.
 * @param {number} wx — world X
 * @param {number} wz — world Z
 * @returns {{ x: number, y: number }}
 */
export function worldToGrid(wx, wz) {
  const x = Math.floor((wx + BASIN_SIZE / 2) / CELL_SIZE);
  const y = Math.floor((wz + BASIN_SIZE / 2) / CELL_SIZE);
  return { x, y };
}

/**
 * Convert grid cell to world coordinates (cell centre).
 * @param {number} gx — grid column
 * @param {number} gy — grid row
 * @returns {{ x: number, z: number }}
 */
export function gridToWorld(gx, gy) {
  const x = (gx + 0.5) * CELL_SIZE - BASIN_SIZE / 2;
  const z = (gy + 0.5) * CELL_SIZE - BASIN_SIZE / 2;
  return { x, z };
}

// --- Direct array access (read-only getters) ---

/** @returns {Float32Array} */
export function getTerrainHeightArray() { return terrainHeight; }

/** @returns {Float32Array} */
export function getWaterDepthArray() { return waterDepth; }

/** @returns {Uint8Array} */
export function getMaterialTypeArray() { return materialType; }

/** @returns {Float32Array} */
export function getPermeabilityArray() { return permeability; }

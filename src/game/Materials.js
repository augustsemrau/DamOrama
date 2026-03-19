/**
 * Materials — material property definitions and placement logic.
 *
 * Four materials: Sand, Clay, Stone, Timber.
 * Sand/Clay placement modifies terrain height in UnifiedGrid.
 * Stone/Timber placement creates rigid bodies via RigidBodies.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8
 */

import {
  MaterialType,
  GRID_SIZE,
  worldToGrid,
  getTerrainHeight,
  setTerrainHeight,
  setMaterialType,
  setPermeability,
} from './UnifiedGrid.js';

import { addBlock, addStake } from '../physics/RigidBodies.js';

/**
 * Material property definitions.
 * erosionRate:      how fast water erodes this material (higher = faster)
 * permeability:     how easily water passes through (0 = impermeable, 1 = fully permeable)
 * degradationRate:  structural integrity loss per second during Flood_Phase
 */
export const MATERIAL_PROPERTIES = {
  SAND:   { erosionRate: 0.05,  permeability: 0.8,  degradationRate: 0 },
  CLAY:   { erosionRate: 0.005, permeability: 0.1,  degradationRate: 0 },
  STONE:  { erosionRate: 0,     permeability: 0.01, degradationRate: 0 },
  TIMBER: { erosionRate: 0,     permeability: 0.5,  degradationRate: 0.01 },
};

/** Default stone block half-extents (0.5 unit cube). */
const STONE_HALF_EXTENTS = { x: 0.25, y: 0.25, z: 0.25 };

/** Default timber stake dimensions. */
const TIMBER_HEIGHT = 1.0;
const TIMBER_RADIUS = 0.05;

/** Radius of the 3×3 sculpting brush (1 = centre ± 1 = 3 cells). */
const BRUSH_RADIUS = 1;

/**
 * Clamp a grid coordinate to valid range.
 * @param {number} v
 * @returns {number}
 */
function clampGrid(v) {
  return Math.max(0, Math.min(GRID_SIZE - 1, v));
}

/**
 * Place sand at a world position, raising terrain in a 3×3 area.
 * Sets material type to SAND and permeability to sand's value.
 *
 * @param {number} wx — world X
 * @param {number} wz — world Z
 * @param {number} amount — height to add per cell
 */
export function placeSand(wx, wz, amount) {
  const { x: cx, y: cy } = worldToGrid(wx, wz);

  for (let dy = -BRUSH_RADIUS; dy <= BRUSH_RADIUS; dy++) {
    for (let dx = -BRUSH_RADIUS; dx <= BRUSH_RADIUS; dx++) {
      const gx = clampGrid(cx + dx);
      const gy = clampGrid(cy + dy);
      const h = getTerrainHeight(gx, gy);
      setTerrainHeight(gx, gy, h + amount);
      setMaterialType(gx, gy, MaterialType.SAND);
      setPermeability(gx, gy, MATERIAL_PROPERTIES.SAND.permeability);
    }
  }
}

/**
 * Place clay at a world position, raising terrain in a 3×3 area.
 * Sets material type to CLAY and permeability to clay's value.
 *
 * @param {number} wx — world X
 * @param {number} wz — world Z
 * @param {number} amount — height to add per cell
 */
export function placeClay(wx, wz, amount) {
  const { x: cx, y: cy } = worldToGrid(wx, wz);

  for (let dy = -BRUSH_RADIUS; dy <= BRUSH_RADIUS; dy++) {
    for (let dx = -BRUSH_RADIUS; dx <= BRUSH_RADIUS; dx++) {
      const gx = clampGrid(cx + dx);
      const gy = clampGrid(cy + dy);
      const h = getTerrainHeight(gx, gy);
      setTerrainHeight(gx, gy, h + amount);
      setMaterialType(gx, gy, MaterialType.CLAY);
      setPermeability(gx, gy, MATERIAL_PROPERTIES.CLAY.permeability);
    }
  }
}

/**
 * Place a stone block at a world position.
 * Creates a fixed rigid body via RigidBodies.addBlock().
 *
 * @param {number} wx — world X
 * @param {number} wz — world Z
 * @returns {number|null} body handle ID, or null if at limit
 */
export function placeStone(wx, wz) {
  const { x: cx, y: cy } = worldToGrid(wx, wz);
  const terrainY = getTerrainHeight(cx, cy);
  const pos = {
    x: wx,
    y: terrainY + STONE_HALF_EXTENTS.y,
    z: wz,
  };
  return addBlock(pos, STONE_HALF_EXTENTS);
}

/**
 * Place a timber stake at a world position.
 * Creates a thin cylindrical fixed rigid body via RigidBodies.addStake().
 *
 * @param {number} wx — world X
 * @param {number} wz — world Z
 * @returns {number|null} body handle ID, or null if at limit
 */
export function placeTimber(wx, wz) {
  const { x: cx, y: cy } = worldToGrid(wx, wz);
  const terrainY = getTerrainHeight(cx, cy);
  const pos = { x: wx, y: terrainY, z: wz };
  return addStake(pos, TIMBER_HEIGHT, TIMBER_RADIUS);
}

/**
 * Get the property object for a given MaterialType value.
 *
 * @param {number} materialType — one of MaterialType.SAND/CLAY/STONE/TIMBER
 * @returns {{ erosionRate: number, permeability: number, degradationRate: number }|null}
 */
export function getMaterialProperties(materialType) {
  switch (materialType) {
    case MaterialType.SAND:   return MATERIAL_PROPERTIES.SAND;
    case MaterialType.CLAY:   return MATERIAL_PROPERTIES.CLAY;
    case MaterialType.STONE:  return MATERIAL_PROPERTIES.STONE;
    case MaterialType.TIMBER: return MATERIAL_PROPERTIES.TIMBER;
    default: return null;
  }
}

/**
 * Level — JSON level loader.
 *
 * Parses level data and initialises all game subsystems:
 * terrain profile, water sources, houses, resource budget, flood parameters.
 *
 * Requirements: 16.1, 16.2, 16.3, 16.4, 16.5
 */

import * as UnifiedGrid from './UnifiedGrid.js';
import * as Houses from './Houses.js';
import * as ResourceBudget from './ResourceBudget.js';
import { setFloodDuration } from './GameLoop.js';

/** @type {Array<{ x: number, y: number, rate: number, radius: number }>} */
let waterSources = [];

/** @type {boolean} */
let partialCredit = false;

/**
 * Apply a terrain profile to the UnifiedGrid.
 * Currently supports the "valley" type.
 * @param {{ type: string, params: object }} terrain
 */
function applyTerrainProfile(terrain) {
  if (!terrain || !terrain.type) return;

  const size = UnifiedGrid.GRID_SIZE;

  if (terrain.type === 'valley') {
    const { width = 128, depth = 0.3, direction = 'east-west' } = terrain.params || {};
    const centre = Math.floor(size / 2);
    const halfWidth = Math.floor(width / 2);

    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        // For east-west valley: the valley runs along X, so Y determines depth
        // For north-south valley: the valley runs along Y, so X determines depth
        const coord = direction === 'north-south' ? x : y;
        const dist = Math.abs(coord - centre);

        let h = 0;
        if (dist < halfWidth) {
          // Inside the valley — cosine-shaped depression
          const t = dist / halfWidth; // 0 at centre, 1 at edge
          h = -depth * (1 - t);
        }

        UnifiedGrid.setTerrainHeight(x, y, h);
      }
    }
  }
}

/**
 * Load a level from a JSON object.
 * Resets subsystems and initialises terrain, water sources, houses,
 * resource budget, and flood parameters from the level data.
 *
 * @param {object} levelData — parsed level JSON
 */
export function loadLevel(levelData) {
  if (!levelData) return;

  // 1. Reset subsystems
  Houses.reset();
  ResourceBudget.reset();
  waterSources = [];
  partialCredit = false;

  // 2. Init UnifiedGrid
  UnifiedGrid.init();

  // 3. Apply terrain profile
  if (levelData.terrain) {
    applyTerrainProfile(levelData.terrain);
  }

  // 4. Store water sources (added to WaterSim on flood trigger, not here)
  if (Array.isArray(levelData.waterSources)) {
    waterSources = levelData.waterSources.map(s => ({
      x: s.gridX ?? 0,
      y: s.gridY ?? 0,
      rate: s.rate ?? 0,
      radius: s.radius ?? 0,
    }));
  }

  // 5. Place houses
  if (Array.isArray(levelData.houses)) {
    for (const h of levelData.houses) {
      Houses.placeHouse(
        { x: h.x ?? 0, y: h.y ?? 0, z: h.z ?? 0 },
        { x: h.scaleX ?? 1, y: h.scaleY ?? 1, z: h.scaleZ ?? 1 },
      );
    }
  }

  // 6. Init ResourceBudget
  if (levelData.budget) {
    ResourceBudget.init(levelData.budget);
  }

  // 7. Set flood duration
  if (typeof levelData.floodDuration === 'number') {
    setFloodDuration(levelData.floodDuration);
  }

  // 8. Partial credit setting
  if (typeof levelData.partialCredit === 'boolean') {
    partialCredit = levelData.partialCredit;
  }
}

/**
 * Get the stored water sources (to be added to WaterSim when flood triggers).
 * @returns {Array<{ x: number, y: number, rate: number, radius: number }>}
 */
export function getWaterSources() {
  return waterSources;
}

/**
 * Get the level's partial credit setting.
 * @returns {boolean}
 */
export function isPartialCreditEnabled() {
  return partialCredit;
}

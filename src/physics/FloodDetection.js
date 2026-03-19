/**
 * FloodDetection — hysteresis-based flood detection for houses.
 *
 * Tracks per-house flood/unflood frame counters. A house becomes flooded
 * when ANY cell in its footprint has water depth > FLOOD_THRESHOLD for
 * FLOOD_FRAMES consecutive frames. A flooded house becomes dry when ALL
 * cells in its footprint have water depth < UNFLOOD_THRESHOLD for
 * UNFLOOD_FRAMES consecutive frames.
 *
 * Requirements: 9.2, 9.4, 9.6
 */

import { getHouses, setFlooded } from '../game/Houses.js';

export const FLOOD_THRESHOLD = 0.1;
export const UNFLOOD_THRESHOLD = 0.05;
export const FLOOD_FRAMES = 60;
export const UNFLOOD_FRAMES = 30;

/** Per-house counters: id → { floodCounter: number, unfloodCounter: number } */
const counters = new Map();

/**
 * Sample water depth at the five footprint points of a house
 * (four corners + centre) and return the array of depths.
 *
 * @param {{ position: {x:number, z:number}, scale: {x:number, z:number} }} house
 * @param {(wx: number, wz: number) => number} waterDepthFn
 * @returns {number[]}
 */
function sampleFootprint(house, waterDepthFn) {
  const { position: pos, scale } = house;
  const minX = pos.x - scale.x;
  const maxX = pos.x + scale.x;
  const minZ = pos.z - scale.z;
  const maxZ = pos.z + scale.z;

  return [
    waterDepthFn(pos.x, pos.z),       // centre
    waterDepthFn(minX, minZ),          // corner 1
    waterDepthFn(maxX, minZ),          // corner 2
    waterDepthFn(minX, maxZ),          // corner 3
    waterDepthFn(maxX, maxZ),          // corner 4
  ];
}

/**
 * Update flood detection for all houses. Called once per frame.
 *
 * @param {(wx: number, wz: number) => number} waterDepthFn — returns water depth at world coords
 */
export function updateFloodDetection(waterDepthFn) {
  const houses = getHouses();

  for (const house of houses) {
    // Ensure counter entry exists
    if (!counters.has(house.id)) {
      counters.set(house.id, { floodCounter: 0, unfloodCounter: 0 });
    }
    const c = counters.get(house.id);

    const depths = sampleFootprint(house, waterDepthFn);
    const anyAboveFlood = depths.some(d => d > FLOOD_THRESHOLD);
    const allBelowUnflood = depths.every(d => d < UNFLOOD_THRESHOLD);

    if (!house.flooded) {
      // Not flooded — check if we should mark flooded
      if (anyAboveFlood) {
        c.floodCounter++;
        c.unfloodCounter = 0;
        if (c.floodCounter >= FLOOD_FRAMES) {
          setFlooded(house.id, true);
          c.floodCounter = 0;
        }
      } else {
        c.floodCounter = 0;
      }
    } else {
      // Currently flooded — check if we should mark dry
      if (allBelowUnflood) {
        c.unfloodCounter++;
        c.floodCounter = 0;
        if (c.unfloodCounter >= UNFLOOD_FRAMES) {
          setFlooded(house.id, false);
          c.unfloodCounter = 0;
        }
      } else {
        c.unfloodCounter = 0;
      }
    }
  }
}

/**
 * Reset all counters.
 */
export function reset() {
  counters.clear();
}

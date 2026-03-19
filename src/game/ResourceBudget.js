/**
 * ResourceBudget — tracks per-material unit counts.
 *
 * Reads initial budget from level JSON, tracks remaining units per material
 * type during Construction_Phase, decrements on placement, and blocks
 * placement when budget is exhausted.
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4
 */

/** @type {{ sand: number, clay: number, stone: number, timber: number }} */
let budget = { sand: 0, clay: 0, stone: 0, timber: 0 };

/** Valid material type keys. */
const VALID_TYPES = ['sand', 'clay', 'stone', 'timber'];

/**
 * Initialise the budget from level data.
 * @param {{ sand: number, clay: number, stone: number, timber: number }} initialBudget
 */
export function init(initialBudget) {
  for (const type of VALID_TYPES) {
    budget[type] = (initialBudget && typeof initialBudget[type] === 'number')
      ? Math.max(0, Math.floor(initialBudget[type]))
      : 0;
  }
}

/**
 * Get remaining units for a material type.
 * @param {'sand'|'clay'|'stone'|'timber'} type
 * @returns {number}
 */
export function getRemaining(type) {
  if (!VALID_TYPES.includes(type)) return 0;
  return budget[type];
}

/**
 * Get the full budget object (shallow copy).
 * @returns {{ sand: number, clay: number, stone: number, timber: number }}
 */
export function getBudget() {
  return { ...budget };
}

/**
 * Check if a material type can be placed (has remaining units).
 * @param {'sand'|'clay'|'stone'|'timber'} type
 * @returns {boolean}
 */
export function canPlace(type) {
  if (!VALID_TYPES.includes(type)) return false;
  return budget[type] > 0;
}

/**
 * Spend one unit of a material type. Returns true if successful.
 * @param {'sand'|'clay'|'stone'|'timber'} type
 * @returns {boolean}
 */
export function spend(type) {
  if (!canPlace(type)) return false;
  budget[type] -= 1;
  return true;
}

/**
 * Reset the budget to zero for all material types.
 */
export function reset() {
  budget = { sand: 0, clay: 0, stone: 0, timber: 0 };
}

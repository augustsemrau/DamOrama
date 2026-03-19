/**
 * AdaptiveQuality — runtime quality downgrade system.
 *
 * Monitors frame time and permanently downgrades simulation fidelity
 * when the frame budget is consistently exceeded.
 *
 * Downgrade chain (permanent, no upgrade back):
 *   1. Reduce water sim substeps from 6 → 2
 *   2. Halve water grid to 256×256
 *
 * Requirements: 17.4, 17.5, 17.6
 */

const FRAME_TIME_THRESHOLD = 20; // ms
const CONSECUTIVE_THRESHOLD = 30; // frames

const DEFAULT_SUBSTEPS = 6;
const REDUCED_SUBSTEPS = 2;
const DEFAULT_GRID_SIZE = 512;
const HALVED_GRID_SIZE = 256;

let substeps = DEFAULT_SUBSTEPS;
let gridSize = DEFAULT_GRID_SIZE;
let consecutiveOverBudget = 0;
let substepsDowngraded = false;
let gridDowngraded = false;
let initialized = false;

/**
 * Initialise the adaptive quality system.
 * Resets all state to defaults.
 */
export function init() {
  substeps = DEFAULT_SUBSTEPS;
  gridSize = DEFAULT_GRID_SIZE;
  consecutiveOverBudget = 0;
  substepsDowngraded = false;
  gridDowngraded = false;
  initialized = true;
}

/**
 * Update with the current frame's time in milliseconds.
 * Triggers permanent downgrades when threshold is exceeded
 * for enough consecutive frames.
 * @param {number} frameTimeMs
 */
export function update(frameTimeMs) {
  if (!initialized) return;
  // Both downgrades already applied — nothing left to do
  if (substepsDowngraded && gridDowngraded) return;

  if (frameTimeMs > FRAME_TIME_THRESHOLD) {
    consecutiveOverBudget++;

    if (consecutiveOverBudget >= CONSECUTIVE_THRESHOLD) {
      if (!substepsDowngraded) {
        // First downgrade: reduce substeps
        substeps = REDUCED_SUBSTEPS;
        substepsDowngraded = true;
        consecutiveOverBudget = 0;
        console.log('[AdaptiveQuality] Reduced substeps to 2');
      } else if (!gridDowngraded) {
        // Second downgrade: halve grid
        gridSize = HALVED_GRID_SIZE;
        gridDowngraded = true;
        consecutiveOverBudget = 0;
        console.log('[AdaptiveQuality] Halved water grid to 256×256');
      }
    }
  } else {
    // Good frame — reset consecutive counter
    consecutiveOverBudget = 0;
  }
}

/**
 * Get the current substep count for the water simulation.
 * @returns {number}
 */
export function getSubsteps() {
  return substeps;
}

/**
 * Get the current water grid size.
 * @returns {number}
 */
export function getGridSize() {
  return gridSize;
}

/**
 * Whether any downgrade has been applied.
 * @returns {boolean}
 */
export function isDowngraded() {
  return substepsDowngraded || gridDowngraded;
}

/**
 * GameLoop — three-phase state machine for Dam-Orama.
 *
 * Phases:
 *   Construction_Phase: player sculpts and places freely, no water flowing
 *   Flood_Phase: water released from source, player can observe and make minor edits
 *   Resolution_Phase: evaluate win/loss, display result, offer replay
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

export const Phase = {
  CONSTRUCTION: 'construction',
  FLOOD: 'flood',
  RESOLUTION: 'resolution',
};

let currentPhase = Phase.CONSTRUCTION;
let floodTimer = 0;
let floodDuration = 120; // seconds — configurable per level
let onPhaseChange = null; // callback

/**
 * Get the current phase.
 * @returns {string}
 */
export function getPhase() {
  return currentPhase;
}

/**
 * Set a callback for phase changes.
 * @param {(phase: string) => void} cb
 */
export function setOnPhaseChange(cb) {
  onPhaseChange = cb;
}

/**
 * Set the flood duration in seconds.
 * @param {number} seconds
 */
export function setFloodDuration(seconds) {
  floodDuration = seconds;
}

/**
 * Trigger the flood — transition from Construction to Flood phase.
 * Returns true if transition occurred.
 * @returns {boolean}
 */
export function triggerFlood() {
  if (currentPhase !== Phase.CONSTRUCTION) return false;
  currentPhase = Phase.FLOOD;
  floodTimer = 0;
  if (onPhaseChange) onPhaseChange(Phase.FLOOD);
  return true;
}

/**
 * Update the game loop. Called each frame.
 * During Flood phase, increments flood timer and checks for resolution conditions.
 * @param {number} dt — time step in seconds
 * @param {{ allHousesFlooded: boolean }} status — current game status
 */
export function update(dt, status) {
  if (currentPhase === Phase.FLOOD) {
    floodTimer += dt;
    if (status.allHousesFlooded || floodTimer >= floodDuration) {
      currentPhase = Phase.RESOLUTION;
      if (onPhaseChange) onPhaseChange(Phase.RESOLUTION);
    }
  }
  // CONSTRUCTION and RESOLUTION phases: do nothing in update
}

/**
 * Check if water simulation should be active (only during Flood phase).
 * @returns {boolean}
 */
export function isWaterActive() {
  return currentPhase === Phase.FLOOD;
}

/**
 * Check if the current phase is the flood phase (for timber degradation).
 * @returns {boolean}
 */
export function isFloodPhase() {
  return currentPhase === Phase.FLOOD;
}

/**
 * Get the current flood timer value in seconds.
 * @returns {number}
 */
export function getFloodTimer() {
  return floodTimer;
}

/**
 * Reset to construction phase.
 */
export function reset() {
  currentPhase = Phase.CONSTRUCTION;
  floodTimer = 0;
  onPhaseChange = null;
}

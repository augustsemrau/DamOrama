/**
 * TimberDegradation — tracks timber stake structural integrity during Flood_Phase.
 *
 * Each registered timber stake starts at integrity 1.0 and degrades by
 * MATERIAL_PROPERTIES.TIMBER.degradationRate per second while the flood phase
 * is active. When integrity reaches 0, the body is removed via RigidBodies.
 *
 * Requirements: 7.5
 */

import { MATERIAL_PROPERTIES } from '../game/Materials.js';
import { removeBody } from './RigidBodies.js';

/** @type {Map<number, number>} body ID → remaining integrity (0..1) */
const timberIntegrity = new Map();

/**
 * Register a timber stake for degradation tracking.
 * @param {number} id — body handle from RigidBodies
 */
export function registerTimber(id) {
  timberIntegrity.set(id, 1.0);
}

/**
 * Unregister a timber stake (e.g., when manually removed).
 * @param {number} id
 */
export function unregisterTimber(id) {
  timberIntegrity.delete(id);
}

/**
 * Step degradation for all registered timber stakes.
 * Reduces integrity by degradationRate * dt during flood phase.
 * When integrity reaches 0, removes the body via RigidBodies.removeBody().
 *
 * @param {number} dt — time step in seconds
 * @param {boolean} isFloodPhase — only degrade during flood phase
 * @returns {number[]} IDs of removed timber stakes
 */
export function stepDegradation(dt, isFloodPhase) {
  const removed = [];

  if (!isFloodPhase || dt <= 0) return removed;

  const rate = MATERIAL_PROPERTIES.TIMBER.degradationRate;

  for (const [id, integrity] of timberIntegrity) {
    const next = integrity - rate * dt;

    if (next <= 1e-9) {
      timberIntegrity.delete(id);
      removeBody(id);
      removed.push(id);
    } else {
      timberIntegrity.set(id, next);
    }
  }

  return removed;
}

/**
 * Get the current integrity of a timber stake.
 * @param {number} id
 * @returns {number|null} integrity (0..1), or null if not tracked
 */
export function getIntegrity(id) {
  const v = timberIntegrity.get(id);
  return v !== undefined ? v : null;
}

/**
 * Reset all tracking (e.g., on level restart).
 */
export function reset() {
  timberIntegrity.clear();
}

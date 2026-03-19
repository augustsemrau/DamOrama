/**
 * SupportCheck — detects when terrain erosion has undermined rigid bodies.
 *
 * Checks whether the terrain height beneath each rigid body's base has
 * dropped below a support threshold. Returns IDs of bodies that have
 * lost support so they can be made dynamic (collapse).
 *
 * Requirements: 6.4, 6.5
 */

/** Support loss threshold in world units */
export const SUPPORT_THRESHOLD = 0.2;

/**
 * Check which bodies have lost terrain support.
 *
 * For each body, queries the terrain height at the body's world (x, z)
 * position. If the terrain height has dropped more than SUPPORT_THRESHOLD
 * below the body's base Y, the body is considered unsupported.
 *
 * @param {Array<{ id: number, position: { x: number, y: number, z: number }, type: string }>} bodies
 *   — array from RigidBodies.getBodies()
 * @param {(id: number) => number | null} getBaseY
 *   — function returning the base Y of a body by ID
 * @param {(wx: number, wz: number) => number} terrainHeightFn
 *   — function returning terrain height at world coordinates (x, z)
 * @returns {number[]} array of body IDs that have lost support
 */
export function checkSupport(bodies, getBaseY, terrainHeightFn) {
  const unsupported = [];

  for (const body of bodies) {
    const baseY = getBaseY(body.id);
    if (baseY === null || baseY === undefined) continue;

    const terrainH = terrainHeightFn(body.position.x, body.position.z);

    // If terrain has dropped more than threshold below the body's base, support is lost
    if (terrainH < baseY - SUPPORT_THRESHOLD) {
      unsupported.push(body.id);
    }
  }

  return unsupported;
}

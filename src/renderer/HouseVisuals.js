/**
 * HouseVisuals — updates house mesh materials based on flood state.
 *
 * Flooded houses get a darker, waterlogged appearance.
 * Dry houses are restored to their normal visual state.
 *
 * Requirements: 9.3, 9.5
 */

import { getHouses } from '../game/Houses.js';
import * as RigidBodies from '../physics/RigidBodies.js';

/** Normal (dry) house material properties */
export const NORMAL_COLOR = 0xCC4422;
export const NORMAL_ROUGHNESS = 0.6;

/** Flooded (waterlogged) house material properties */
export const FLOODED_COLOR = 0x663311;
export const FLOODED_ROUGHNESS = 0.95;

/**
 * Update house mesh visuals based on flood state.
 * Called each frame after flood detection.
 *
 * For each house:
 * - If flooded and not already waterlogged → apply darker color and higher roughness
 * - If dry and not already normal → restore normal color and roughness
 */
export function updateHouseVisuals() {
  const houses = getHouses();

  for (const house of houses) {
    const entry = RigidBodies.getBody(house.id);
    if (!entry || !entry.mesh) continue;

    const mat = entry.mesh.material;
    if (!mat) continue;

    if (house.flooded) {
      // Transition to waterlogged state if not already
      if (mat.color && mat.color.getHex() !== FLOODED_COLOR) {
        mat.color.setHex(FLOODED_COLOR);
        mat.roughness = FLOODED_ROUGHNESS;
      }
    } else {
      // Restore normal state if not already
      if (mat.color && mat.color.getHex() !== NORMAL_COLOR) {
        mat.color.setHex(NORMAL_COLOR);
        mat.roughness = NORMAL_ROUGHNESS;
      }
    }
  }
}

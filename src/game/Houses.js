/**
 * Houses — manages house placement and tracking.
 *
 * Houses are placed as static Rapier rigid bodies via RigidBodies.addHouse().
 * Each house has a position, scale, and flood state.
 * Visual appearance is handled by BodyMeshSync (warm red-orange 0xCC4422).
 *
 * Requirements: 9.1, 18.4, 18.6
 */

import { addHouse as addHouseBody } from '../physics/RigidBodies.js';

/** @type {Array<{ id: number, position: {x:number,y:number,z:number}, scale: {x:number,y:number,z:number}, flooded: boolean }>} */
const houses = [];

/**
 * Place a house at the given world position with the given scale.
 * Creates a static rigid body via RigidBodies.addHouse().
 * @param {{ x: number, y: number, z: number }} pos — base position
 * @param {{ x: number, y: number, z: number }} scale — half-extents
 * @returns {number|null} body handle ID, or null if placement failed
 */
export function placeHouse(pos, scale) {
  const id = addHouseBody(pos, scale);
  if (id == null) return null;

  houses.push({
    id,
    position: { x: pos.x, y: pos.y, z: pos.z },
    scale: { x: scale.x, y: scale.y, z: scale.z },
    flooded: false,
  });

  return id;
}

/**
 * Get all placed houses.
 * @returns {Array<{ id: number, position: {x:number,y:number,z:number}, scale: {x:number,y:number,z:number}, flooded: boolean }>}
 */
export function getHouses() {
  return houses;
}

/**
 * Get a house by its body ID.
 * @param {number} id
 * @returns {{ id: number, position: {x:number,y:number,z:number}, scale: {x:number,y:number,z:number}, flooded: boolean }|null}
 */
export function getHouse(id) {
  return houses.find(h => h.id === id) ?? null;
}

/**
 * Set the flood state of a house.
 * @param {number} id
 * @param {boolean} flooded
 */
export function setFlooded(id, flooded) {
  const house = houses.find(h => h.id === id);
  if (house) {
    house.flooded = flooded;
  }
}

/**
 * Get the number of houses.
 * @returns {number}
 */
export function getHouseCount() {
  return houses.length;
}

/**
 * Reset all house tracking.
 */
export function reset() {
  houses.length = 0;
}

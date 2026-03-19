import RAPIER from '@dimforge/rapier3d-compat';

/**
 * RigidBodies — Rapier.js WASM physics wrapper.
 *
 * Full API for managing rigid bodies in the Dam-Orama physics world.
 * Supports stone blocks, timber stakes, and houses as rigid bodies.
 *
 * Requirements: 5.1, 5.6
 */

/** @type {RAPIER.World | null} */
let world = null;

/**
 * Internal body registry: id → { rapierBody, type, mesh, colliderId }
 * @type {Map<number, { rapierBody: RAPIER.RigidBody, type: string, mesh: object|null, colliderId: number }>}
 */
const bodies = new Map();

/** Max simultaneous rigid bodies */
const MAX_BODIES_DESKTOP = 64;
const MAX_BODIES_MOBILE = 32;

/** Detect mobile device */
function isMobile() {
  if (typeof navigator === 'undefined') return false;
  return navigator.maxTouchPoints > 0 || window.innerWidth < 768;
}

/**
 * Get the max body limit for the current device.
 * @returns {number}
 */
export function getMaxBodies() {
  return isMobile() ? MAX_BODIES_MOBILE : MAX_BODIES_DESKTOP;
}

/**
 * Get current body count.
 * @returns {number}
 */
export function getBodyCount() {
  return bodies.size;
}

/**
 * Initialise the Rapier WASM module and create a physics world.
 * @returns {Promise<{ world: RAPIER.World }>}
 */
export async function init() {
  await RAPIER.init();

  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

  // Clear any previous bodies
  bodies.clear();

  return { world };
}

/**
 * Advance the physics world by dt seconds.
 * @param {number} dt — time step in seconds
 */
export function step(dt) {
  if (!world) return;
  world.timestep = dt;
  world.step();
}

/**
 * Get the Rapier world reference.
 * @returns {RAPIER.World | null}
 */
export function getWorld() {
  return world;
}

/**
 * Add a stone block as a fixed rigid body with cuboid collider.
 * @param {{ x: number, y: number, z: number }} pos — centre position
 * @param {{ x: number, y: number, z: number }} size — half-extents
 * @returns {number | null} body handle ID, or null if at limit
 */
export function addBlock(pos, size) {
  if (!world) return null;
  if (bodies.size >= getMaxBodies()) {
    console.warn('[RigidBodies] Body limit reached (' + getMaxBodies() + '), cannot add block');
    return null;
  }

  const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z);
  const rapierBody = world.createRigidBody(bodyDesc);

  const colliderDesc = RAPIER.ColliderDesc.cuboid(size.x, size.y, size.z);
  const collider = world.createCollider(colliderDesc, rapierBody);

  const id = rapierBody.handle;
  bodies.set(id, {
    rapierBody,
    type: 'block',
    mesh: null,
    colliderId: collider.handle,
  });

  return id;
}

/**
 * Add a timber stake as a fixed rigid body with cylinder collider.
 * @param {{ x: number, y: number, z: number }} pos — base centre position
 * @param {number} height — total height of the stake
 * @param {number} radius — cylinder radius
 * @returns {number | null} body handle ID, or null if at limit
 */
export function addStake(pos, height, radius) {
  if (!world) return null;
  if (bodies.size >= getMaxBodies()) {
    console.warn('[RigidBodies] Body limit reached (' + getMaxBodies() + '), cannot add stake');
    return null;
  }

  const halfHeight = height / 2;
  // Position the body so its base is at pos.y (centre at pos.y + halfHeight)
  const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
    pos.x,
    pos.y + halfHeight,
    pos.z
  );
  const rapierBody = world.createRigidBody(bodyDesc);

  const colliderDesc = RAPIER.ColliderDesc.cylinder(halfHeight, radius);
  const collider = world.createCollider(colliderDesc, rapierBody);

  const id = rapierBody.handle;
  bodies.set(id, {
    rapierBody,
    type: 'stake',
    mesh: null,
    colliderId: collider.handle,
  });

  return id;
}

/**
 * Add a house as a fixed rigid body with cuboid collider.
 * @param {{ x: number, y: number, z: number }} pos — base centre position
 * @param {{ x: number, y: number, z: number }} scale — half-extents of the house
 * @returns {number | null} body handle ID, or null if at limit
 */
export function addHouse(pos, scale) {
  if (!world) return null;
  if (bodies.size >= getMaxBodies()) {
    console.warn('[RigidBodies] Body limit reached (' + getMaxBodies() + '), cannot add house');
    return null;
  }

  // Position the body so its base is at pos.y (centre at pos.y + scale.y)
  const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
    pos.x,
    pos.y + scale.y,
    pos.z
  );
  const rapierBody = world.createRigidBody(bodyDesc);

  const colliderDesc = RAPIER.ColliderDesc.cuboid(scale.x, scale.y, scale.z);
  const collider = world.createCollider(colliderDesc, rapierBody);

  const id = rapierBody.handle;
  bodies.set(id, {
    rapierBody,
    type: 'house',
    mesh: null,
    colliderId: collider.handle,
  });

  return id;
}

/**
 * Get all tracked bodies as an array.
 * @returns {Array<{ id: number, position: { x: number, y: number, z: number }, rotation: { x: number, y: number, z: number, w: number }, type: string, mesh: object|null }>}
 */
export function getBodies() {
  const result = [];
  for (const [id, entry] of bodies) {
    const t = entry.rapierBody.translation();
    const r = entry.rapierBody.rotation();
    result.push({
      id,
      position: { x: t.x, y: t.y, z: t.z },
      rotation: { x: r.x, y: r.y, z: r.z, w: r.w },
      type: entry.type,
      mesh: entry.mesh,
    });
  }
  return result;
}

/**
 * Remove a body by ID.
 * @param {number} id — body handle
 * @returns {boolean} true if removed, false if not found
 */
export function removeBody(id) {
  if (!world) return false;
  const entry = bodies.get(id);
  if (!entry) return false;

  world.removeRigidBody(entry.rapierBody);
  bodies.delete(id);
  return true;
}

/**
 * Get all body AABBs for water–rigid body coupling.
 * Returns axis-aligned bounding boxes in world coordinates.
 * Computes AABB from collider shape properties (halfExtents for cuboids,
 * radius/halfHeight for cylinders).
 * @returns {Array<{ minX: number, minZ: number, maxX: number, maxZ: number }>}
 */
export function getBodyAABBs() {
  const result = [];
  for (const [, entry] of bodies) {
    const body = entry.rapierBody;
    const numColliders = body.numColliders();
    for (let i = 0; i < numColliders; i++) {
      const collider = body.collider(i);
      const pos = collider.translation();
      const shapeType = collider.shapeType();

      let hx, hz;
      // ShapeType 1 = Cuboid, ShapeType 10 = Cylinder
      if (shapeType === 1) {
        const he = collider.halfExtents();
        hx = he.x;
        hz = he.z;
      } else if (shapeType === 10) {
        const r = collider.radius();
        hx = r;
        hz = r;
      } else {
        // Fallback: treat as point
        hx = 0;
        hz = 0;
      }

      result.push({
        minX: pos.x - hx,
        minZ: pos.z - hz,
        maxX: pos.x + hx,
        maxZ: pos.z + hz,
      });
    }
  }
  return result;
}

/**
 * Make a static (fixed) body dynamic — used for collapse when support is lost.
 * @param {number} id — body handle
 * @returns {boolean} true if changed, false if not found
 */
export function makeBodyDynamic(id) {
  if (!world) return false;
  const entry = bodies.get(id);
  if (!entry) return false;

  entry.rapierBody.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
  return true;
}

/**
 * Set the mesh reference for a body (used by renderer sync).
 * @param {number} id — body handle
 * @param {object} mesh — Three.js mesh
 */
export function setBodyMesh(id, mesh) {
  const entry = bodies.get(id);
  if (entry) {
    entry.mesh = mesh;
  }
}

/**
 * Get the base Y coordinate (bottom) of a body by ID.
 * Uses the collider's vertical half-extent to compute base from centre position.
 * @param {number} id — body handle
 * @returns {number | null} base Y in world coordinates, or null if not found
 */
export function getBodyBaseY(id) {
  if (!world) return null;
  const entry = bodies.get(id);
  if (!entry) return null;

  const body = entry.rapierBody;
  const pos = body.translation();
  const numColliders = body.numColliders();
  if (numColliders === 0) return pos.y;

  const collider = body.collider(0);
  const shapeType = collider.shapeType();

  let hy;
  if (shapeType === 1) {
    // Cuboid — halfExtents gives { x, y, z }
    hy = collider.halfExtents().y;
  } else if (shapeType === 10) {
    // Cylinder — halfHeight
    hy = collider.halfHeight();
  } else {
    hy = 0;
  }

  return pos.y - hy;
}

/**
 * Get a body entry by ID (for internal use / testing).
 * @param {number} id
 * @returns {{ rapierBody: RAPIER.RigidBody, type: string, mesh: object|null, colliderId: number } | undefined}
 */
export function getBody(id) {
  return bodies.get(id);
}

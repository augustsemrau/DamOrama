import * as THREE from 'three/webgpu';
import * as RigidBodies from '../physics/RigidBodies.js';

/**
 * BodyMeshSync — Syncs Rapier rigid body transforms to Three.js meshes.
 *
 * Creates appropriate meshes for each body type (block, stake, house),
 * updates mesh transforms from Rapier state each frame, and handles
 * mesh removal/disposal.
 *
 * Requirements: 5.4
 */

/** @type {THREE.Scene | null} */
let scene = null;

/** Material definitions per body type */
const MATERIALS = {
  block: () => new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 }),
  stake: () => new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.7 }),
  house: () => new THREE.MeshStandardMaterial({ color: 0xCC4422, roughness: 0.6 }),
};

/**
 * Store the scene reference for mesh management.
 * @param {THREE.Scene} sceneRef
 */
export function init(sceneRef) {
  scene = sceneRef;
}

/**
 * Read collider shape dimensions from a Rapier body entry.
 * @param {object} bodyEntry — internal body entry from RigidBodies.getBody()
 * @returns {{ shapeType: number, halfExtents?: {x:number,y:number,z:number}, radius?: number, halfHeight?: number }}
 */
function getColliderShape(bodyEntry) {
  const body = bodyEntry.rapierBody;
  const collider = body.collider(0);
  const shapeType = collider.shapeType();

  if (shapeType === 1) {
    // Cuboid
    const he = collider.halfExtents();
    return { shapeType, halfExtents: { x: he.x, y: he.y, z: he.z } };
  } else if (shapeType === 10) {
    // Cylinder
    return { shapeType, radius: collider.radius(), halfHeight: collider.halfHeight() };
  }
  return { shapeType };
}

/**
 * Create a Three.js mesh for a specific rigid body.
 * Reads collider shape from Rapier to determine geometry size.
 * @param {number} id — body handle ID
 * @returns {THREE.Mesh | null} the created mesh, or null if body not found or scene not set
 */
export function createMeshForBody(id) {
  if (!scene) {
    console.warn('[BodyMeshSync] Scene not initialised');
    return null;
  }

  const bodyEntry = RigidBodies.getBody(id);
  if (!bodyEntry) return null;

  const { type } = bodyEntry;
  const shape = getColliderShape(bodyEntry);
  const materialFactory = MATERIALS[type];
  if (!materialFactory) {
    console.warn('[BodyMeshSync] Unknown body type:', type);
    return null;
  }

  let geometry;
  if (type === 'block' || type === 'house') {
    const he = shape.halfExtents || { x: 0.5, y: 0.5, z: 0.5 };
    geometry = new THREE.BoxGeometry(he.x * 2, he.y * 2, he.z * 2);
  } else if (type === 'stake') {
    const r = shape.radius || 0.1;
    const hh = shape.halfHeight || 1;
    geometry = new THREE.CylinderGeometry(r, r, hh * 2, 8);
  } else {
    return null;
  }

  const mesh = new THREE.Mesh(geometry, materialFactory());
  scene.add(mesh);
  RigidBodies.setBodyMesh(id, mesh);

  return mesh;
}

/**
 * Sync all rigid body transforms to their Three.js meshes.
 * Creates meshes for bodies that don't have one yet.
 * Called each frame from the animation loop.
 */
export function syncAll() {
  const bodies = RigidBodies.getBodies();
  for (const body of bodies) {
    // Create mesh if missing
    if (!body.mesh) {
      createMeshForBody(body.id);
      // Re-fetch mesh after creation
      const entry = RigidBodies.getBody(body.id);
      if (!entry || !entry.mesh) continue;
      body.mesh = entry.mesh;
    }

    // Update position
    body.mesh.position.set(body.position.x, body.position.y, body.position.z);

    // Update rotation (quaternion)
    body.mesh.quaternion.set(body.rotation.x, body.rotation.y, body.rotation.z, body.rotation.w);
  }
}

/**
 * Remove a body's mesh from the scene and dispose its resources.
 * @param {number} id — body handle ID
 */
export function removeMesh(id) {
  if (!scene) return;

  const bodyEntry = RigidBodies.getBody(id);
  if (!bodyEntry || !bodyEntry.mesh) return;

  const mesh = bodyEntry.mesh;
  scene.remove(mesh);
  if (mesh.geometry) mesh.geometry.dispose();
  if (mesh.material) mesh.material.dispose();
  RigidBodies.setBodyMesh(id, null);
}

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Three.js (same pattern as BodyMeshSync.test.js)
vi.mock('three/webgpu', () => {
  class MockColor {
    constructor(hex = 0x000000) { this._hex = hex; }
    getHex() { return this._hex; }
    setHex(hex) { this._hex = hex; }
  }
  class MockVector3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; }
  }
  class MockQuaternion {
    constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; }
    set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; }
  }
  class MockGeometry { dispose() {} }
  class MockMaterial {
    constructor(opts = {}) {
      this.color = new MockColor(opts.color || 0x000000);
      this.roughness = opts.roughness || 0.5;
    }
    dispose() {}
  }
  class MockMesh {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.position = new MockVector3();
      this.quaternion = new MockQuaternion();
    }
  }
  class MockScene {
    constructor() { this.children = []; }
    add(obj) { this.children.push(obj); }
    remove(obj) {
      const idx = this.children.indexOf(obj);
      if (idx >= 0) this.children.splice(idx, 1);
    }
  }
  return {
    BoxGeometry: MockGeometry,
    CylinderGeometry: MockGeometry,
    MeshStandardMaterial: MockMaterial,
    Mesh: MockMesh,
    Scene: MockScene,
  };
});

import * as RigidBodies from '../physics/RigidBodies.js';
import * as Houses from '../game/Houses.js';
import * as BodyMeshSync from './BodyMeshSync.js';
import { updateHouseVisuals, NORMAL_COLOR, NORMAL_ROUGHNESS, FLOODED_COLOR, FLOODED_ROUGHNESS } from './HouseVisuals.js';
import * as THREE from 'three/webgpu';

describe('HouseVisuals', () => {
  let scene;

  beforeEach(async () => {
    await RigidBodies.init();
    Houses.reset();
    scene = new THREE.Scene();
    BodyMeshSync.init(scene);
  });

  it('should not throw when no houses exist', () => {
    expect(() => updateHouseVisuals()).not.toThrow();
  });

  it('should not throw when house has no mesh yet', () => {
    Houses.placeHouse({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
    // Don't create mesh — updateHouseVisuals should skip gracefully
    expect(() => updateHouseVisuals()).not.toThrow();
  });

  it('should apply waterlogged visuals when house is flooded', () => {
    const id = Houses.placeHouse({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
    BodyMeshSync.createMeshForBody(id);

    Houses.setFlooded(id, true);
    updateHouseVisuals();

    const entry = RigidBodies.getBody(id);
    expect(entry.mesh.material.color.getHex()).toBe(FLOODED_COLOR);
    expect(entry.mesh.material.roughness).toBe(FLOODED_ROUGHNESS);
  });

  it('should restore normal visuals when house transitions from flooded to dry', () => {
    const id = Houses.placeHouse({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
    BodyMeshSync.createMeshForBody(id);

    // Flood it
    Houses.setFlooded(id, true);
    updateHouseVisuals();

    // Un-flood it
    Houses.setFlooded(id, false);
    updateHouseVisuals();

    const entry = RigidBodies.getBody(id);
    expect(entry.mesh.material.color.getHex()).toBe(NORMAL_COLOR);
    expect(entry.mesh.material.roughness).toBe(NORMAL_ROUGHNESS);
  });

  it('should not re-apply flooded material if already waterlogged', () => {
    const id = Houses.placeHouse({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
    BodyMeshSync.createMeshForBody(id);

    Houses.setFlooded(id, true);
    updateHouseVisuals();

    const entry = RigidBodies.getBody(id);
    const spy = vi.spyOn(entry.mesh.material.color, 'setHex');

    // Call again — should skip since already waterlogged
    updateHouseVisuals();
    expect(spy).not.toHaveBeenCalled();
  });

  it('should not re-apply normal material if already normal', () => {
    const id = Houses.placeHouse({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
    BodyMeshSync.createMeshForBody(id);

    // House starts dry, material starts at normal color
    updateHouseVisuals();

    const entry = RigidBodies.getBody(id);
    const spy = vi.spyOn(entry.mesh.material.color, 'setHex');

    // Call again — should skip since already normal
    updateHouseVisuals();
    expect(spy).not.toHaveBeenCalled();
  });

  it('should handle multiple houses with mixed flood states', () => {
    const id1 = Houses.placeHouse({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
    const id2 = Houses.placeHouse({ x: 5, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
    BodyMeshSync.createMeshForBody(id1);
    BodyMeshSync.createMeshForBody(id2);

    Houses.setFlooded(id1, true);
    // id2 stays dry

    updateHouseVisuals();

    const entry1 = RigidBodies.getBody(id1);
    const entry2 = RigidBodies.getBody(id2);

    expect(entry1.mesh.material.color.getHex()).toBe(FLOODED_COLOR);
    expect(entry2.mesh.material.color.getHex()).toBe(NORMAL_COLOR);
  });
});

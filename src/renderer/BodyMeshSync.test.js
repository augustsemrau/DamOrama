import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Three.js since it requires browser/WebGPU context
vi.mock('three/webgpu', () => {
  class MockVector3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; }
  }
  class MockQuaternion {
    constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; }
    set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; }
  }
  class MockGeometry {
    dispose() { this._disposed = true; }
  }
  class MockMaterial {
    constructor(opts = {}) { Object.assign(this, opts); }
    dispose() { this._disposed = true; }
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

import { init, syncAll, createMeshForBody, removeMesh } from './BodyMeshSync.js';
import * as RigidBodies from '../physics/RigidBodies.js';
import * as THREE from 'three/webgpu';

describe('BodyMeshSync', () => {
  let scene;

  beforeEach(async () => {
    await RigidBodies.init();
    scene = new THREE.Scene();
    init(scene);
  });

  describe('init', () => {
    it('should store the scene reference without error', () => {
      expect(() => init(scene)).not.toThrow();
    });
  });

  describe('createMeshForBody', () => {
    it('should create a mesh for a block body', () => {
      const id = RigidBodies.addBlock({ x: 1, y: 2, z: 3 }, { x: 0.5, y: 0.5, z: 0.5 });
      const mesh = createMeshForBody(id);
      expect(mesh).not.toBeNull();
      expect(scene.children).toContain(mesh);
    });

    it('should create a mesh for a stake body', () => {
      const id = RigidBodies.addStake({ x: 0, y: 0, z: 0 }, 2, 0.15);
      const mesh = createMeshForBody(id);
      expect(mesh).not.toBeNull();
      expect(scene.children).toContain(mesh);
    });

    it('should create a mesh for a house body', () => {
      const id = RigidBodies.addHouse({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
      const mesh = createMeshForBody(id);
      expect(mesh).not.toBeNull();
      expect(scene.children).toContain(mesh);
    });

    it('should set the mesh on the body via setBodyMesh', () => {
      const id = RigidBodies.addBlock({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
      const mesh = createMeshForBody(id);
      const entry = RigidBodies.getBody(id);
      expect(entry.mesh).toBe(mesh);
    });

    it('should return null for non-existent body ID', () => {
      const mesh = createMeshForBody(9999);
      expect(mesh).toBeNull();
    });

    it('should return null if scene not initialised', () => {
      init(null);
      const id = RigidBodies.addBlock({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
      const mesh = createMeshForBody(id);
      expect(mesh).toBeNull();
    });
  });

  describe('syncAll', () => {
    it('should create meshes for bodies that have none', () => {
      RigidBodies.addBlock({ x: 1, y: 2, z: 3 }, { x: 0.5, y: 0.5, z: 0.5 });
      expect(scene.children).toHaveLength(0);
      syncAll();
      expect(scene.children).toHaveLength(1);
    });

    it('should update mesh position from body state', () => {
      const id = RigidBodies.addBlock({ x: 1, y: 2, z: 3 }, { x: 0.5, y: 0.5, z: 0.5 });
      syncAll();
      const entry = RigidBodies.getBody(id);
      const mesh = entry.mesh;
      expect(mesh.position.x).toBeCloseTo(1);
      expect(mesh.position.y).toBeCloseTo(2);
      expect(mesh.position.z).toBeCloseTo(3);
    });

    it('should update mesh quaternion from body rotation', () => {
      const id = RigidBodies.addBlock({ x: 0, y: 0, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 });
      syncAll();
      const entry = RigidBodies.getBody(id);
      const mesh = entry.mesh;
      // Fixed body at identity rotation: quaternion (0, 0, 0, 1)
      expect(mesh.quaternion.w).toBeCloseTo(1);
      expect(mesh.quaternion.x).toBeCloseTo(0);
      expect(mesh.quaternion.y).toBeCloseTo(0);
      expect(mesh.quaternion.z).toBeCloseTo(0);
    });

    it('should handle multiple bodies', () => {
      RigidBodies.addBlock({ x: 0, y: 0, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 });
      RigidBodies.addStake({ x: 2, y: 0, z: 0 }, 2, 0.1);
      RigidBodies.addHouse({ x: 4, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
      syncAll();
      expect(scene.children).toHaveLength(3);
    });

    it('should not duplicate meshes on repeated calls', () => {
      RigidBodies.addBlock({ x: 0, y: 0, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 });
      syncAll();
      syncAll();
      syncAll();
      expect(scene.children).toHaveLength(1);
    });
  });

  describe('removeMesh', () => {
    it('should remove mesh from scene and dispose resources', () => {
      const id = RigidBodies.addBlock({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
      createMeshForBody(id);
      expect(scene.children).toHaveLength(1);

      const entry = RigidBodies.getBody(id);
      const mesh = entry.mesh;

      removeMesh(id);
      expect(scene.children).toHaveLength(0);
      expect(mesh.geometry._disposed).toBe(true);
      expect(mesh.material._disposed).toBe(true);
      expect(RigidBodies.getBody(id).mesh).toBeNull();
    });

    it('should handle non-existent body gracefully', () => {
      expect(() => removeMesh(9999)).not.toThrow();
    });

    it('should handle body with no mesh gracefully', () => {
      const id = RigidBodies.addBlock({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
      expect(() => removeMesh(id)).not.toThrow();
    });
  });
});

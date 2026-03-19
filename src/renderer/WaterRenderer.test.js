import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Three.js since we're in a Node test environment
vi.mock('three/webgpu', () => {
  class MockBufferAttribute {
    constructor(array, itemSize) {
      this.array = array;
      this.itemSize = itemSize;
      this.needsUpdate = false;
    }
    setY(index, value) {
      this.array[index * this.itemSize + 1] = value;
    }
    setXYZ(index, x, y, z) {
      const offset = index * this.itemSize;
      this.array[offset] = x;
      this.array[offset + 1] = y;
      this.array[offset + 2] = z;
    }
    getY(index) {
      return this.array[index * this.itemSize + 1];
    }
    getX(index) {
      return this.array[index * this.itemSize];
    }
    getZ(index) {
      return this.array[index * this.itemSize + 2];
    }
  }

  class MockPlaneGeometry {
    constructor(width, height, wSeg, hSeg) {
      this.parameters = { width, height, widthSegments: wSeg, heightSegments: hSeg };
      const vertexCount = (wSeg + 1) * (hSeg + 1);
      this._posArray = new Float32Array(vertexCount * 3);
      this._posAttr = new MockBufferAttribute(this._posArray, 3);
      this._attributes = { position: this._posAttr };
    }
    rotateX() { return this; }
    setAttribute(name, attr) { this._attributes[name] = attr; }
    getAttribute(name) { return this._attributes[name]; }
    computeVertexNormals() {}
  }

  class MockMeshPhysicalMaterial {
    constructor(opts) { Object.assign(this, opts); }
  }

  class MockMesh {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
    }
  }

  const DoubleSide = 2;

  return {
    PlaneGeometry: MockPlaneGeometry,
    BufferAttribute: MockBufferAttribute,
    MeshPhysicalMaterial: MockMeshPhysicalMaterial,
    Mesh: MockMesh,
    DoubleSide,
  };
});

import { create, update } from './WaterRenderer.js';

describe('WaterRenderer', () => {
  describe('create()', () => {
    it('returns a mesh with PlaneGeometry matching grid size', () => {
      const mesh = create(4);
      expect(mesh).toBeDefined();
      expect(mesh.geometry).toBeDefined();
      expect(mesh.material).toBeDefined();
      expect(mesh.geometry.parameters.widthSegments).toBe(3);
      expect(mesh.geometry.parameters.heightSegments).toBe(3);
    });

    it('creates geometry with 16×16 world unit dimensions', () => {
      const mesh = create(4);
      expect(mesh.geometry.parameters.width).toBe(16);
      expect(mesh.geometry.parameters.height).toBe(16);
    });

    it('uses MeshPhysicalMaterial with correct water properties', () => {
      const mesh = create(4);
      const mat = mesh.material;
      expect(mat.transmission).toBe(0.6);
      expect(mat.roughness).toBe(0.05);
      expect(mat.metalness).toBe(0.0);
      expect(mat.transparent).toBe(true);
      expect(mat.opacity).toBe(0.8);
      expect(mat.thickness).toBe(0.5);
      expect(mat.ior).toBe(1.33);
    });

    it('initialises all vertices hidden below terrain', () => {
      const mesh = create(4);
      const posAttr = mesh.geometry.getAttribute('position');
      for (let i = 0; i < 16; i++) {
        expect(posAttr.getY(i)).toBe(-100);
      }
    });

    it('initialises colour attribute with shallow blue', () => {
      const mesh = create(4);
      const colorAttr = mesh.geometry.getAttribute('color');
      expect(colorAttr).toBeDefined();
      expect(colorAttr.array[0]).toBeCloseTo(0.4, 2);
      expect(colorAttr.array[1]).toBeCloseTo(0.7, 2);
      expect(colorAttr.array[2]).toBeCloseTo(0.9, 2);
    });
  });

  describe('update()', () => {
    it('sets vertex Y to terrainHeight + waterDepth when depth > threshold', () => {
      create(4);
      const terrain = new Float32Array(16);
      const water = new Float32Array(16);
      terrain[0] = 1.0;
      water[0] = 0.5;

      update(terrain, water);

      const mesh = create(4); // re-read won't work, use module state
      // We need to call update on the already-created mesh
      // Re-create and update properly:
      const m = create(4);
      terrain[0] = 1.0;
      water[0] = 0.5;
      update(terrain, water);

      const posAttr = m.geometry.getAttribute('position');
      expect(posAttr.getY(0)).toBeCloseTo(1.5);
    });

    it('hides vertices with negligible water depth (Y = -100)', () => {
      const m = create(4);
      const terrain = new Float32Array(16);
      const water = new Float32Array(16);
      terrain[3] = 2.0;
      water[3] = 0.0005; // below threshold

      update(terrain, water);

      const posAttr = m.geometry.getAttribute('position');
      expect(posAttr.getY(3)).toBe(-100);
    });

    it('colours shallow water as light blue', () => {
      const m = create(4);
      const terrain = new Float32Array(16);
      const water = new Float32Array(16);
      water[0] = 0.01; // just above threshold, very shallow

      update(terrain, water);

      const colorAttr = m.geometry.getAttribute('color');
      // Very shallow → close to shallow colour
      expect(colorAttr.getX(0)).toBeCloseTo(0.4, 1);
      expect(colorAttr.getY(0)).toBeCloseTo(0.7, 1);
      expect(colorAttr.getZ(0)).toBeCloseTo(0.9, 1);
    });

    it('colours deep water as dark blue', () => {
      const m = create(4);
      const terrain = new Float32Array(16);
      const water = new Float32Array(16);
      water[0] = 2.0; // well above 1.0 deep threshold

      update(terrain, water);

      const colorAttr = m.geometry.getAttribute('color');
      expect(colorAttr.getX(0)).toBeCloseTo(0.1, 2);
      expect(colorAttr.getY(0)).toBeCloseTo(0.3, 2);
      expect(colorAttr.getZ(0)).toBeCloseTo(0.6, 2);
    });

    it('lerps colour for mid-depth water', () => {
      const m = create(4);
      const terrain = new Float32Array(16);
      const water = new Float32Array(16);
      water[0] = 0.5; // t = 0.5

      update(terrain, water);

      const colorAttr = m.geometry.getAttribute('color');
      const expectedR = 0.4 + (0.1 - 0.4) * 0.5; // 0.25
      const expectedG = 0.7 + (0.3 - 0.7) * 0.5; // 0.5
      const expectedB = 0.9 + (0.6 - 0.9) * 0.5; // 0.75
      expect(colorAttr.getX(0)).toBeCloseTo(expectedR, 2);
      expect(colorAttr.getY(0)).toBeCloseTo(expectedG, 2);
      expect(colorAttr.getZ(0)).toBeCloseTo(expectedB, 2);
    });

    it('marks position and color attributes for update', () => {
      const m = create(4);
      const terrain = new Float32Array(16);
      const water = new Float32Array(16);

      update(terrain, water);

      const posAttr = m.geometry.getAttribute('position');
      const colorAttr = m.geometry.getAttribute('color');
      expect(posAttr.needsUpdate).toBe(true);
      expect(colorAttr.needsUpdate).toBe(true);
    });
  });
});

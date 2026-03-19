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

  class MockMeshStandardMaterial {
    constructor(opts) { Object.assign(this, opts); }
  }

  class MockMesh {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
    }
  }

  return {
    PlaneGeometry: MockPlaneGeometry,
    BufferAttribute: MockBufferAttribute,
    MeshStandardMaterial: MockMeshStandardMaterial,
    Mesh: MockMesh,
  };
});

// Import after mock is set up
import { create, update } from './TerrainMesh.js';

describe('TerrainMesh', () => {
  describe('create()', () => {
    it('returns a mesh with PlaneGeometry matching grid size', () => {
      const mesh = create(4);
      expect(mesh).toBeDefined();
      expect(mesh.geometry).toBeDefined();
      expect(mesh.material).toBeDefined();
      // 4×4 grid → 3×3 segments
      expect(mesh.geometry.parameters.widthSegments).toBe(3);
      expect(mesh.geometry.parameters.heightSegments).toBe(3);
    });

    it('creates geometry with 16×16 world unit dimensions', () => {
      const mesh = create(4);
      expect(mesh.geometry.parameters.width).toBe(16);
      expect(mesh.geometry.parameters.height).toBe(16);
    });

    it('enables vertex colours on the material', () => {
      const mesh = create(4);
      expect(mesh.material.vertexColors).toBe(true);
    });

    it('initialises colour attribute with dry earth tones', () => {
      const mesh = create(4);
      const colorAttr = mesh.geometry.getAttribute('color');
      expect(colorAttr).toBeDefined();
      // First vertex should be dry colour
      expect(colorAttr.array[0]).toBeCloseTo(0.76, 2);
      expect(colorAttr.array[1]).toBeCloseTo(0.60, 2);
      expect(colorAttr.array[2]).toBeCloseTo(0.42, 2);
    });
  });

  describe('update()', () => {
    it('updates vertex Y positions from terrain height data', () => {
      const mesh = create(4);
      const terrain = new Float32Array(16);
      const water = new Float32Array(16);
      terrain[0] = 2.5;
      terrain[5] = 1.0;

      update(terrain, water);

      const posAttr = mesh.geometry.getAttribute('position');
      expect(posAttr.getY(0)).toBeCloseTo(2.5);
      expect(posAttr.getY(5)).toBeCloseTo(1.0);
    });

    it('colours dry cells with warm earth tones', () => {
      const mesh = create(4);
      const terrain = new Float32Array(16);
      const water = new Float32Array(16); // all zero = dry

      update(terrain, water);

      const colorAttr = mesh.geometry.getAttribute('color');
      expect(colorAttr.array[0]).toBeCloseTo(0.76, 2);
      expect(colorAttr.array[1]).toBeCloseTo(0.60, 2);
      expect(colorAttr.array[2]).toBeCloseTo(0.42, 2);
    });

    it('colours fully wet cells with dark olive-charcoal', () => {
      const mesh = create(4);
      const terrain = new Float32Array(16);
      const water = new Float32Array(16);
      water[0] = 1.0; // well above 0.5 threshold

      update(terrain, water);

      const colorAttr = mesh.geometry.getAttribute('color');
      expect(colorAttr.array[0]).toBeCloseTo(0.25, 2);
      expect(colorAttr.array[1]).toBeCloseTo(0.28, 2);
      expect(colorAttr.array[2]).toBeCloseTo(0.22, 2);
    });

    it('lerps colour for partially wet cells', () => {
      const mesh = create(4);
      const terrain = new Float32Array(16);
      const water = new Float32Array(16);
      water[0] = 0.25; // half of 0.5 threshold → t = 0.5

      update(terrain, water);

      const colorAttr = mesh.geometry.getAttribute('color');
      // Midpoint between dry (0.76) and wet (0.25) = 0.505
      const expectedR = 0.76 + (0.25 - 0.76) * 0.5;
      expect(colorAttr.array[0]).toBeCloseTo(expectedR, 2);
    });

    it('marks position and color attributes for update', () => {
      const mesh = create(4);
      const terrain = new Float32Array(16);
      const water = new Float32Array(16);

      update(terrain, water);

      const posAttr = mesh.geometry.getAttribute('position');
      const colorAttr = mesh.geometry.getAttribute('color');
      expect(posAttr.needsUpdate).toBe(true);
      expect(colorAttr.needsUpdate).toBe(true);
    });
  });
});

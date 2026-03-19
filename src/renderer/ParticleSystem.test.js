import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Three.js for Node test environment
vi.mock('three/webgpu', () => {
  class MockFloat32BufferAttribute {
    constructor(array, itemSize) {
      this.array = array;
      this.itemSize = itemSize;
      this.needsUpdate = false;
    }
  }

  class MockBufferGeometry {
    constructor() {
      this._attributes = {};
      this._drawRange = { start: 0, count: Infinity };
    }
    setAttribute(name, attr) { this._attributes[name] = attr; return this; }
    getAttribute(name) { return this._attributes[name]; }
    get attributes() { return this._attributes; }
    setDrawRange(start, count) { this._drawRange = { start, count }; }
    dispose() {}
  }

  class MockShaderMaterial {
    constructor(opts) { Object.assign(this, opts); }
    dispose() {}
  }

  class MockPoints {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.frustumCulled = true;
      this.parent = null;
    }
  }

  const mockScene = {
    add(obj) { obj.parent = mockScene; },
    remove(obj) { obj.parent = null; },
  };

  return {
    BufferGeometry: MockBufferGeometry,
    Float32BufferAttribute: MockFloat32BufferAttribute,
    Points: MockPoints,
    ShaderMaterial: MockShaderMaterial,
    AdditiveBlending: 2,
    Color: class { constructor() {} },
    __mockScene: mockScene,
  };
});

import {
  init, update, destroy,
  emitSplash, emitSpray, emitDebris,
  _getAliveCount, _getPositions, _getVelocities,
  _getColors, _getSizes, _getLives, _getMaxLives, _getPointsMesh,
} from './ParticleSystem.js';

import { __mockScene as scene } from 'three/webgpu';

describe('ParticleSystem', () => {
  beforeEach(() => {
    destroy();
    init(scene);
  });

  describe('init / destroy', () => {
    it('creates a Points mesh and adds it to the scene', () => {
      const mesh = _getPointsMesh();
      expect(mesh).toBeDefined();
      expect(mesh.parent).toBe(scene);
      expect(mesh.frustumCulled).toBe(false);
    });

    it('starts with zero alive particles', () => {
      expect(_getAliveCount()).toBe(0);
    });

    it('destroy removes mesh from scene and disposes resources', () => {
      destroy();
      expect(_getPointsMesh()).toBeNull();
      expect(_getAliveCount()).toBe(0);
    });
  });

  describe('emitSplash', () => {
    it('spawns particles with blue-white colour', () => {
      emitSplash({ x: 1, y: 2, z: 3 }, 0.5);
      const count = _getAliveCount();
      expect(count).toBeGreaterThan(0);

      const colors = _getColors();
      // First particle should have splash colour (blue-white)
      expect(colors[0]).toBeCloseTo(0.7, 1);  // R
      expect(colors[1]).toBeCloseTo(0.85, 1); // G
      expect(colors[2]).toBeCloseTo(1.0, 1);  // B
    });

    it('spawns more particles with higher intensity', () => {
      emitSplash({ x: 0, y: 0, z: 0 }, 0.0);
      const lowCount = _getAliveCount();

      destroy();
      init(scene);
      emitSplash({ x: 0, y: 0, z: 0 }, 1.0);
      const highCount = _getAliveCount();

      expect(highCount).toBeGreaterThan(lowCount);
    });

    it('positions particles near the given position', () => {
      emitSplash({ x: 5, y: 3, z: -2 }, 0.5);
      const pos = _getPositions();
      // First particle X should be near 5
      expect(pos[0]).toBeGreaterThan(4.5);
      expect(pos[0]).toBeLessThan(5.5);
    });

    it('gives particles upward velocity', () => {
      emitSplash({ x: 0, y: 0, z: 0 }, 1.0);
      const vel = _getVelocities();
      // Y velocity should be positive (upward)
      expect(vel[1]).toBeGreaterThan(0);
    });
  });

  describe('emitSpray', () => {
    it('spawns fine droplet particles', () => {
      emitSpray({ x: 0, y: 0, z: 0 });
      expect(_getAliveCount()).toBeGreaterThan(0);

      const sizes = _getSizes();
      // Spray particles are small
      expect(sizes[0]).toBeLessThan(0.1);
    });

    it('uses spray colour (blue tint)', () => {
      emitSpray({ x: 0, y: 0, z: 0 });
      const colors = _getColors();
      expect(colors[0]).toBeCloseTo(0.5, 1);  // R
      expect(colors[1]).toBeCloseTo(0.7, 1);  // G
      expect(colors[2]).toBeCloseTo(0.95, 1); // B
    });
  });

  describe('emitDebris', () => {
    it('spawns brown/grey particles', () => {
      emitDebris({ x: 0, y: 0, z: 0 });
      const count = _getAliveCount();
      expect(count).toBe(12);

      const colors = _getColors();
      // First particle (even index) should be brown
      expect(colors[0]).toBeCloseTo(0.55, 1); // R (brown)
      // Second particle (odd index) should be grey
      expect(colors[4]).toBeCloseTo(0.5, 1);  // R (grey)
      expect(colors[5]).toBeCloseTo(0.5, 1);  // G (grey)
      expect(colors[6]).toBeCloseTo(0.5, 1);  // B (grey)
    });

    it('gives particles outward velocity', () => {
      emitDebris({ x: 0, y: 0, z: 0 });
      const vel = _getVelocities();
      // Y velocity should be positive (upward burst)
      expect(vel[1]).toBeGreaterThan(0);
    });
  });

  describe('update(dt)', () => {
    it('advances particle positions by velocity * dt', () => {
      emitSplash({ x: 0, y: 0, z: 0 }, 0.5);
      const pos = _getPositions();
      const vel = _getVelocities();
      const prevY = pos[1];
      const vy = vel[1];

      update(0.016);

      // Position should have moved in the direction of velocity
      // (gravity also applies, so Y = prevY + vy*dt - gravity*dt)
      expect(pos[1]).not.toBe(prevY);
    });

    it('reduces particle life each step', () => {
      emitSplash({ x: 0, y: 0, z: 0 }, 0.5);
      const initialLife = _getLives()[0];

      update(0.1);

      expect(_getLives()[0]).toBeLessThan(initialLife);
    });

    it('recycles dead particles (life <= 0)', () => {
      emitSplash({ x: 0, y: 0, z: 0 }, 0.5);
      const initialCount = _getAliveCount();

      // Step far enough to kill all particles (max life ~0.9s)
      update(2.0);

      expect(_getAliveCount()).toBe(0);
      expect(_getAliveCount()).toBeLessThan(initialCount);
    });

    it('swap-removes dead particles and keeps live ones', () => {
      // Emit two batches — first with short life, second with long life
      emitSpray({ x: 0, y: 0, z: 0 }); // short life (0.3-0.6s)
      const sprayCount = _getAliveCount();

      emitDebris({ x: 5, y: 5, z: 5 }); // longer life (0.6-1.2s)
      const totalBefore = _getAliveCount();
      expect(totalBefore).toBe(sprayCount + 12);

      // Step enough to kill spray but not all debris
      update(0.7);

      // Some particles should have been recycled, but not all
      const remaining = _getAliveCount();
      expect(remaining).toBeLessThan(totalBefore);
      expect(remaining).toBeGreaterThan(0);
    });
  });

  describe('pool management', () => {
    it('does not exceed MAX_PARTICLES', () => {
      // Emit a huge number of particles
      for (let i = 0; i < 300; i++) {
        emitDebris({ x: 0, y: 0, z: 0 }); // 12 each = 3600 attempted
      }
      expect(_getAliveCount()).toBeLessThanOrEqual(2048);
    });

    it('new particles can be emitted after dead ones are recycled', () => {
      emitSplash({ x: 0, y: 0, z: 0 }, 1.0);
      const first = _getAliveCount();

      // Kill all
      update(5.0);
      expect(_getAliveCount()).toBe(0);

      // Emit again
      emitSplash({ x: 0, y: 0, z: 0 }, 1.0);
      expect(_getAliveCount()).toBe(first);
    });
  });
});

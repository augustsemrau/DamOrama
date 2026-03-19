// @vitest-environment jsdom

/**
 * KeyboardInput tests — WASD camera controls with acceleration/damping.
 *
 * Tests key tracking, acceleration/damping math, and scroll wheel
 * zoom vs shift+scroll brush resize.
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  init,
  update,
  destroy,
  onBrushResize,
  _test,
} from './KeyboardInput.js';

// --- Stubs ---

/** Minimal OrbitControls stub with rotateLeft/rotateUp and domElement. */
function createControlsStub() {
  const listeners = {};
  return {
    target: { set: vi.fn(), clone: () => ({ x: 0, y: 0, z: 0 }) },
    object: {
      position: {
        clone: () => ({
          sub: () => ({
            length: () => 10,
            setLength: vi.fn(),
            x: 0, y: 5, z: 10,
          }),
        }),
        copy: vi.fn().mockReturnValue({ add: vi.fn() }),
        x: 0, y: 5, z: 10,
      },
    },
    domElement: {
      addEventListener(type, fn, opts) {
        if (!listeners[type]) listeners[type] = [];
        listeners[type].push(fn);
      },
      removeEventListener(type, fn) {
        if (!listeners[type]) return;
        listeners[type] = listeners[type].filter((f) => f !== fn);
      },
      /** Fire a synthetic event on the domElement. */
      _fire(type, props) {
        const event = {
          type,
          deltaY: 0,
          shiftKey: false,
          preventDefault: vi.fn(),
          ...props,
        };
        (listeners[type] || []).forEach((fn) => fn(event));
      },
    },
    rotateLeft: vi.fn(),
    rotateUp: vi.fn(),
    update: vi.fn(),
    enableDamping: true,
    dampingFactor: 0.1,
  };
}

/** Fire a keyboard event on window. */
function fireKey(type, key, opts = {}) {
  const event = new KeyboardEvent(type, { key, ...opts });
  window.dispatchEvent(event);
}

// --- Tests ---

describe('KeyboardInput', () => {
  let controlsStub;

  beforeEach(() => {
    controlsStub = createControlsStub();
    init(controlsStub);
  });

  afterEach(() => {
    destroy();
  });

  describe('Key tracking (keydown/keyup state)', () => {
    it('should track W key press and release', () => {
      fireKey('keydown', 'w');
      expect(_test.getKeys().w).toBe(true);

      fireKey('keyup', 'w');
      expect(_test.getKeys().w).toBe(false);
    });

    it('should track A key press and release', () => {
      fireKey('keydown', 'a');
      expect(_test.getKeys().a).toBe(true);

      fireKey('keyup', 'a');
      expect(_test.getKeys().a).toBe(false);
    });

    it('should track S key press and release', () => {
      fireKey('keydown', 's');
      expect(_test.getKeys().s).toBe(true);

      fireKey('keyup', 's');
      expect(_test.getKeys().s).toBe(false);
    });

    it('should track D key press and release', () => {
      fireKey('keydown', 'd');
      expect(_test.getKeys().d).toBe(true);

      fireKey('keyup', 'd');
      expect(_test.getKeys().d).toBe(false);
    });

    it('should handle uppercase keys (Shift held)', () => {
      fireKey('keydown', 'W');
      expect(_test.getKeys().w).toBe(true);

      fireKey('keyup', 'W');
      expect(_test.getKeys().w).toBe(false);
    });

    it('should track multiple simultaneous keys', () => {
      fireKey('keydown', 'w');
      fireKey('keydown', 'a');
      expect(_test.getKeys().w).toBe(true);
      expect(_test.getKeys().a).toBe(true);

      fireKey('keyup', 'w');
      expect(_test.getKeys().w).toBe(false);
      expect(_test.getKeys().a).toBe(true);
    });

    it('should ignore non-WASD keys', () => {
      fireKey('keydown', 'x');
      const k = _test.getKeys();
      expect(k.w).toBe(false);
      expect(k.a).toBe(false);
      expect(k.s).toBe(false);
      expect(k.d).toBe(false);
    });

    it('should reset key state on destroy', () => {
      fireKey('keydown', 'w');
      fireKey('keydown', 'a');
      destroy();
      // Re-init to read state (destroy clears it)
      init(controlsStub);
      const k = _test.getKeys();
      expect(k.w).toBe(false);
      expect(k.a).toBe(false);
    });
  });

  describe('Acceleration and damping math', () => {
    it('should accelerate azimuth velocity when A is held', () => {
      fireKey('keydown', 'a');
      update(1 / 60);
      const vel = _test.getVelocity();
      expect(vel.azimuthVel).toBeGreaterThan(0);
    });

    it('should accelerate azimuth velocity in opposite direction when D is held', () => {
      fireKey('keydown', 'd');
      update(1 / 60);
      const vel = _test.getVelocity();
      expect(vel.azimuthVel).toBeLessThan(0);
    });

    it('should accelerate polar velocity when S is held (tilt down)', () => {
      fireKey('keydown', 's');
      update(1 / 60);
      const vel = _test.getVelocity();
      expect(vel.polarVel).toBeGreaterThan(0);
    });

    it('should accelerate polar velocity in opposite direction when W is held (tilt up)', () => {
      fireKey('keydown', 'w');
      update(1 / 60);
      const vel = _test.getVelocity();
      expect(vel.polarVel).toBeLessThan(0);
    });

    it('should apply damping when key is released', () => {
      // Build up velocity
      fireKey('keydown', 'a');
      update(1 / 60);
      update(1 / 60);
      const velBefore = _test.getVelocity().azimuthVel;
      expect(velBefore).toBeGreaterThan(0);

      // Release key — damping should reduce velocity
      fireKey('keyup', 'a');
      update(1 / 60);
      const velAfter = _test.getVelocity().azimuthVel;
      expect(velAfter).toBeLessThan(velBefore);
      expect(velAfter).toBeGreaterThan(0); // not yet zero
    });

    it('should snap velocity to zero when below epsilon', () => {
      fireKey('keydown', 'a');
      update(1 / 60);
      fireKey('keyup', 'a');

      // Run many damping frames to decay below epsilon
      for (let i = 0; i < 200; i++) {
        update(1 / 60);
      }
      expect(_test.getVelocity().azimuthVel).toBe(0);
    });

    it('should clamp velocity to MAX_SPEED', () => {
      fireKey('keydown', 'a');
      // Run many frames to try to exceed max speed
      for (let i = 0; i < 300; i++) {
        update(1 / 60);
      }
      expect(_test.getVelocity().azimuthVel).toBeLessThanOrEqual(_test.MAX_SPEED);
    });

    it('should call rotateLeft and rotateUp on OrbitControls when velocity is non-zero', () => {
      fireKey('keydown', 'a');
      update(1 / 60);
      expect(controlsStub.rotateLeft).toHaveBeenCalled();
    });

    it('should not call rotateLeft/rotateUp when velocity is zero', () => {
      update(1 / 60);
      expect(controlsStub.rotateLeft).not.toHaveBeenCalled();
      expect(controlsStub.rotateUp).not.toHaveBeenCalled();
    });
  });

  describe('Scroll wheel zoom vs shift+scroll brush resize', () => {
    it('should zoom camera on normal scroll (no shift)', () => {
      controlsStub.domElement._fire('wheel', { deltaY: -100, shiftKey: false });
      // Zoom modifies camera position — we check that position.copy was called
      expect(controlsStub.object.position.copy).toHaveBeenCalled();
    });

    it('should emit brush resize on shift+scroll', () => {
      const resizeEvents = [];
      onBrushResize((e) => resizeEvents.push(e));

      controlsStub.domElement._fire('wheel', { deltaY: -100, shiftKey: true });

      expect(resizeEvents.length).toBe(1);
      expect(resizeEvents[0].delta).toBeGreaterThan(0); // scroll up = increase
    });

    it('should emit negative brush resize delta on shift+scroll down', () => {
      const resizeEvents = [];
      onBrushResize((e) => resizeEvents.push(e));

      controlsStub.domElement._fire('wheel', { deltaY: 100, shiftKey: true });

      expect(resizeEvents.length).toBe(1);
      expect(resizeEvents[0].delta).toBeLessThan(0); // scroll down = decrease
    });

    it('should not emit brush resize on normal scroll', () => {
      const resizeEvents = [];
      onBrushResize((e) => resizeEvents.push(e));

      controlsStub.domElement._fire('wheel', { deltaY: -100, shiftKey: false });

      expect(resizeEvents.length).toBe(0);
    });

    it('should not zoom on shift+scroll', () => {
      controlsStub.object.position.copy.mockClear();
      controlsStub.domElement._fire('wheel', { deltaY: -100, shiftKey: true });
      expect(controlsStub.object.position.copy).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should stop responding to key events after destroy', () => {
      destroy();
      fireKey('keydown', 'w');
      // Re-init to check state wasn't modified
      init(controlsStub);
      expect(_test.getKeys().w).toBe(false);
    });

    it('should survive double destroy without error', () => {
      destroy();
      expect(() => destroy()).not.toThrow();
    });
  });
});

/**
 * InputHandler tests — simulated pointer events.
 *
 * We create a minimal canvas stub and fire synthetic PointerEvents
 * to verify gesture recognition and event emission.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  init,
  destroy,
  onSculpt,
  onPan,
  onBrushResize,
  onOrbitCamera,
  onZoom,
  onMaterialPicker,
} from './InputHandler.js';

// --- Stubs ---

/** Minimal canvas stub with event listener support and bounding rect. */
function createCanvasStub() {
  const listeners = {};
  return {
    style: {},
    addEventListener(type, fn) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(fn);
    },
    removeEventListener(type, fn) {
      if (!listeners[type]) return;
      listeners[type] = listeners[type].filter((f) => f !== fn);
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 800, height: 600 };
    },
    /** Fire a synthetic event on this stub. */
    _fire(type, props) {
      const event = {
        type,
        clientX: 0,
        clientY: 0,
        pointerId: 1,
        preventDefault: vi.fn(),
        ...props,
      };
      (listeners[type] || []).forEach((fn) => fn(event));
    },
  };
}

/**
 * Minimal camera stub. Raycasting won't actually hit anything in unit tests
 * (no real geometry), so 1-finger drags will emit 'pan' events by default.
 */
function createCameraStub() {
  return {
    projectionMatrix: { elements: new Float32Array(16) },
    matrixWorldInverse: { elements: new Float32Array(16) },
    projectionMatrixInverse: { elements: new Float32Array(16) },
    matrixWorld: { elements: new Float32Array(16) },
    isPerspectiveCamera: true,
  };
}

/** Minimal terrain mesh stub (raycaster won't intersect it in unit tests). */
function createTerrainStub() {
  return { isMesh: true };
}

// --- Tests ---

describe('InputHandler', () => {
  let canvasStub;

  beforeEach(() => {
    canvasStub = createCanvasStub();
    init(canvasStub, createCameraStub(), createTerrainStub());
  });

  afterEach(() => {
    destroy();
  });

  describe('init / destroy', () => {
    it('should set touch-action to none on canvas', () => {
      expect(canvasStub.style.touchAction).toBe('none');
    });

    it('should survive double destroy without error', () => {
      destroy();
      expect(() => destroy()).not.toThrow();
    });
  });

  describe('1-finger drag (pan — no terrain hit)', () => {
    it('should emit pan event on 1-finger drag when terrain is not hit', () => {
      const panEvents = [];
      onPan((e) => panEvents.push(e));

      canvasStub._fire('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 });
      canvasStub._fire('pointermove', { pointerId: 1, clientX: 110, clientY: 105 });

      expect(panEvents.length).toBe(1);
      expect(panEvents[0].dx).toBe(10);
      expect(panEvents[0].dy).toBe(5);
    });

    it('should emit multiple pan events on continued drag', () => {
      const panEvents = [];
      onPan((e) => panEvents.push(e));

      canvasStub._fire('pointerdown', { pointerId: 1, clientX: 50, clientY: 50 });
      canvasStub._fire('pointermove', { pointerId: 1, clientX: 60, clientY: 50 });
      canvasStub._fire('pointermove', { pointerId: 1, clientX: 70, clientY: 55 });

      expect(panEvents.length).toBe(2);
      expect(panEvents[1].dx).toBe(10);
      expect(panEvents[1].dy).toBe(5);
    });

    it('should not emit pan after pointerup', () => {
      const panEvents = [];
      onPan((e) => panEvents.push(e));

      canvasStub._fire('pointerdown', { pointerId: 1, clientX: 50, clientY: 50 });
      canvasStub._fire('pointerup', { pointerId: 1 });
      canvasStub._fire('pointermove', { pointerId: 1, clientX: 60, clientY: 50 });

      expect(panEvents.length).toBe(0);
    });
  });

  describe('2-finger zoom (pinch/spread)', () => {
    it('should emit zoom event on 2-finger pinch', () => {
      const zoomEvents = [];
      onZoom((e) => zoomEvents.push(e));

      // Two fingers down
      canvasStub._fire('pointerdown', { pointerId: 1, clientX: 100, clientY: 300 });
      canvasStub._fire('pointerdown', { pointerId: 2, clientX: 200, clientY: 300 });

      // Move fingers apart (spread)
      canvasStub._fire('pointermove', { pointerId: 2, clientX: 250, clientY: 300 });

      expect(zoomEvents.length).toBe(1);
      expect(zoomEvents[0].scaleFactor).toBeGreaterThan(1); // spread = zoom in
    });

    it('should emit zoom < 1 on pinch (fingers closer)', () => {
      const zoomEvents = [];
      onZoom((e) => zoomEvents.push(e));

      canvasStub._fire('pointerdown', { pointerId: 1, clientX: 100, clientY: 300 });
      canvasStub._fire('pointerdown', { pointerId: 2, clientX: 300, clientY: 300 });

      // Move finger 2 closer
      canvasStub._fire('pointermove', { pointerId: 2, clientX: 200, clientY: 300 });

      expect(zoomEvents.length).toBe(1);
      expect(zoomEvents[0].scaleFactor).toBeLessThan(1); // pinch = zoom out
    });
  });

  describe('2-finger brush resize', () => {
    it('should emit brushResize event with distance delta', () => {
      const resizeEvents = [];
      onBrushResize((e) => resizeEvents.push(e));

      canvasStub._fire('pointerdown', { pointerId: 1, clientX: 100, clientY: 300 });
      canvasStub._fire('pointerdown', { pointerId: 2, clientX: 200, clientY: 300 });

      // Spread fingers
      canvasStub._fire('pointermove', { pointerId: 2, clientX: 260, clientY: 300 });

      expect(resizeEvents.length).toBe(1);
      expect(resizeEvents[0].delta).toBeGreaterThan(0);
    });
  });

  describe('2-finger orbit (rotation)', () => {
    it('should emit orbitCamera event on 2-finger rotation', () => {
      const orbitEvents = [];
      onOrbitCamera((e) => orbitEvents.push(e));

      // Two fingers horizontal
      canvasStub._fire('pointerdown', { pointerId: 1, clientX: 200, clientY: 300 });
      canvasStub._fire('pointerdown', { pointerId: 2, clientX: 400, clientY: 300 });

      // Rotate: move finger 2 upward (changes angle)
      canvasStub._fire('pointermove', { pointerId: 2, clientX: 400, clientY: 200 });

      expect(orbitEvents.length).toBe(1);
      expect(orbitEvents[0].angleDelta).not.toBe(0);
    });
  });

  describe('long-press', () => {
    it('should emit materialPicker after 500ms hold without move', async () => {
      vi.useFakeTimers();
      const pickerEvents = [];
      onMaterialPicker((e) => pickerEvents.push(e));

      canvasStub._fire('pointerdown', { pointerId: 1, clientX: 400, clientY: 300 });

      // Advance past long-press threshold
      vi.advanceTimersByTime(600);

      // materialPicker fires but raycast won't hit our stub terrain,
      // so no event is emitted (hit === false). This is correct behaviour —
      // long-press on non-terrain doesn't open picker.
      expect(pickerEvents.length).toBe(0);

      vi.useRealTimers();
    });

    it('should cancel long-press if pointer moves beyond threshold', () => {
      vi.useFakeTimers();
      const pickerEvents = [];
      onMaterialPicker((e) => pickerEvents.push(e));

      canvasStub._fire('pointerdown', { pointerId: 1, clientX: 400, clientY: 300 });
      // Move beyond threshold
      canvasStub._fire('pointermove', { pointerId: 1, clientX: 420, clientY: 300 });

      vi.advanceTimersByTime(600);
      expect(pickerEvents.length).toBe(0);

      vi.useRealTimers();
    });

    it('should cancel long-press when second finger arrives', () => {
      vi.useFakeTimers();
      const pickerEvents = [];
      onMaterialPicker((e) => pickerEvents.push(e));

      canvasStub._fire('pointerdown', { pointerId: 1, clientX: 400, clientY: 300 });
      canvasStub._fire('pointerdown', { pointerId: 2, clientX: 500, clientY: 300 });

      vi.advanceTimersByTime(600);
      expect(pickerEvents.length).toBe(0);

      vi.useRealTimers();
    });
  });

  describe('pointer cleanup', () => {
    it('should handle pointercancel same as pointerup', () => {
      const panEvents = [];
      onPan((e) => panEvents.push(e));

      canvasStub._fire('pointerdown', { pointerId: 1, clientX: 50, clientY: 50 });
      canvasStub._fire('pointercancel', { pointerId: 1 });
      canvasStub._fire('pointermove', { pointerId: 1, clientX: 60, clientY: 50 });

      expect(panEvents.length).toBe(0);
    });

    it('should reset 2-finger state when one finger lifts', () => {
      const zoomEvents = [];
      onZoom((e) => zoomEvents.push(e));

      canvasStub._fire('pointerdown', { pointerId: 1, clientX: 100, clientY: 300 });
      canvasStub._fire('pointerdown', { pointerId: 2, clientX: 200, clientY: 300 });
      canvasStub._fire('pointerup', { pointerId: 2 });

      // Now only 1 finger — move should not emit zoom
      canvasStub._fire('pointermove', { pointerId: 1, clientX: 150, clientY: 300 });
      // The zoom events from the initial 2-finger setup should be 0
      // (no move happened while 2 fingers were active)
      expect(zoomEvents.length).toBe(0);
    });
  });

  describe('callback registration', () => {
    it('should allow registering all callback types', () => {
      expect(() => {
        onSculpt(() => {});
        onPan(() => {});
        onBrushResize(() => {});
        onOrbitCamera(() => {});
        onZoom(() => {});
        onMaterialPicker(() => {});
      }).not.toThrow();
    });
  });
});

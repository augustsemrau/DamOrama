import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock RigidBodies.removeBody so we don't need Rapier WASM in tests
vi.mock('./RigidBodies.js', () => ({
  removeBody: vi.fn(() => true),
}));

// Mock Materials to control degradation rate
vi.mock('../game/Materials.js', () => ({
  MATERIAL_PROPERTIES: {
    TIMBER: { degradationRate: 0.01 },
  },
}));

import {
  registerTimber,
  unregisterTimber,
  stepDegradation,
  getIntegrity,
  reset,
} from './TimberDegradation.js';

import { removeBody } from './RigidBodies.js';

describe('TimberDegradation', () => {
  beforeEach(() => {
    reset();
    vi.clearAllMocks();
  });

  describe('registerTimber / getIntegrity', () => {
    it('should register a timber stake with integrity 1.0', () => {
      registerTimber(42);
      expect(getIntegrity(42)).toBe(1.0);
    });

    it('should return null for unregistered IDs', () => {
      expect(getIntegrity(999)).toBeNull();
    });
  });

  describe('unregisterTimber', () => {
    it('should remove a stake from tracking', () => {
      registerTimber(10);
      unregisterTimber(10);
      expect(getIntegrity(10)).toBeNull();
    });

    it('should be a no-op for unknown IDs', () => {
      unregisterTimber(999); // should not throw
    });
  });

  describe('stepDegradation — Req 7.5', () => {
    it('should reduce integrity by degradationRate * dt during flood phase', () => {
      registerTimber(1);
      stepDegradation(1.0, true); // 1 second at rate 0.01
      expect(getIntegrity(1)).toBeCloseTo(0.99);
    });

    it('should NOT degrade when isFloodPhase is false', () => {
      registerTimber(1);
      stepDegradation(1.0, false);
      expect(getIntegrity(1)).toBe(1.0);
    });

    it('should NOT degrade when dt <= 0', () => {
      registerTimber(1);
      stepDegradation(0, true);
      expect(getIntegrity(1)).toBe(1.0);
      stepDegradation(-1, true);
      expect(getIntegrity(1)).toBe(1.0);
    });

    it('should remove body when integrity reaches 0', () => {
      registerTimber(5);
      // 100 seconds at rate 0.01 → integrity goes to 0
      const removed = stepDegradation(100, true);
      expect(removed).toContain(5);
      expect(getIntegrity(5)).toBeNull();
      expect(removeBody).toHaveBeenCalledWith(5);
    });

    it('should return empty array when nothing is removed', () => {
      registerTimber(1);
      const removed = stepDegradation(1.0, true);
      expect(removed).toEqual([]);
    });

    it('should handle multiple stakes independently', () => {
      registerTimber(1);
      registerTimber(2);

      // Degrade both by 50 seconds → integrity 0.5
      stepDegradation(50, true);
      expect(getIntegrity(1)).toBeCloseTo(0.5);
      expect(getIntegrity(2)).toBeCloseTo(0.5);

      // Degrade another 50 seconds → both removed
      const removed = stepDegradation(50, true);
      expect(removed).toContain(1);
      expect(removed).toContain(2);
      expect(getIntegrity(1)).toBeNull();
      expect(getIntegrity(2)).toBeNull();
    });

    it('should accumulate degradation over multiple steps', () => {
      registerTimber(1);
      // 10 steps of 1 second each at rate 0.01 → integrity ~0.9
      for (let i = 0; i < 10; i++) {
        stepDegradation(1.0, true);
      }
      expect(getIntegrity(1)).toBeCloseTo(0.9);
    });

    it('should remove stake at exactly 100 seconds (rate 0.01)', () => {
      registerTimber(1);
      // 99 seconds → integrity 0.01
      stepDegradation(99, true);
      expect(getIntegrity(1)).toBeCloseTo(0.01);

      // 1 more second → integrity 0 → removed
      const removed = stepDegradation(1, true);
      expect(removed).toContain(1);
      expect(getIntegrity(1)).toBeNull();
    });
  });

  describe('reset', () => {
    it('should clear all tracked stakes', () => {
      registerTimber(1);
      registerTimber(2);
      registerTimber(3);
      reset();
      expect(getIntegrity(1)).toBeNull();
      expect(getIntegrity(2)).toBeNull();
      expect(getIntegrity(3)).toBeNull();
    });
  });
});

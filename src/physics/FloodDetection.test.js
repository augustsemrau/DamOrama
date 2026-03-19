import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Mock Houses module so we don't pull in Rapier.js WASM.
 * We control the house list and track setFlooded calls.
 */
const mockHouses = [];
const mockSetFlooded = vi.fn((id, flooded) => {
  const h = mockHouses.find(h => h.id === id);
  if (h) h.flooded = flooded;
});

vi.mock('../game/Houses.js', () => ({
  getHouses: () => mockHouses,
  setFlooded: (...args) => mockSetFlooded(...args),
}));

import {
  updateFloodDetection,
  reset,
  FLOOD_THRESHOLD,
  UNFLOOD_THRESHOLD,
  FLOOD_FRAMES,
  UNFLOOD_FRAMES,
} from './FloodDetection.js';

/** Helper: create a house entry in the mock list */
function addHouse(id, pos = { x: 0, y: 0, z: 0 }, scale = { x: 0.5, y: 0.5, z: 0.5 }) {
  const house = { id, position: pos, scale, flooded: false };
  mockHouses.push(house);
  return house;
}

/** Helper: run N frames with a constant waterDepthFn */
function runFrames(n, waterDepthFn) {
  for (let i = 0; i < n; i++) {
    updateFloodDetection(waterDepthFn);
  }
}

describe('FloodDetection', () => {
  beforeEach(() => {
    mockHouses.length = 0;
    mockSetFlooded.mockClear();
    reset();
  });

  it('should export correct threshold constants', () => {
    expect(FLOOD_THRESHOLD).toBe(0.1);
    expect(UNFLOOD_THRESHOLD).toBe(0.05);
    expect(FLOOD_FRAMES).toBe(60);
    expect(UNFLOOD_FRAMES).toBe(30);
  });

  describe('Req 9.2: house becomes flooded after 60 consecutive high-water frames', () => {
    it('should mark house flooded after exactly 60 frames of depth > 0.1', () => {
      addHouse(1);
      const highWater = () => 0.2; // well above FLOOD_THRESHOLD

      // 59 frames — not yet flooded
      runFrames(59, highWater);
      expect(mockHouses[0].flooded).toBe(false);

      // 60th frame — now flooded
      runFrames(1, highWater);
      expect(mockHouses[0].flooded).toBe(true);
      expect(mockSetFlooded).toHaveBeenCalledWith(1, true);
    });

    it('should NOT flood if depth is exactly at threshold (not exceeding)', () => {
      addHouse(2);
      // depth === 0.1 does NOT exceed threshold (must be > 0.1)
      runFrames(100, () => FLOOD_THRESHOLD);
      expect(mockHouses[0].flooded).toBe(false);
    });
  });

  describe('Req 9.4: house becomes dry after 30 consecutive low-water frames', () => {
    it('should mark house dry after 30 frames of depth < 0.05', () => {
      const house = addHouse(3);
      house.flooded = true; // start flooded

      const lowWater = () => 0.01; // well below UNFLOOD_THRESHOLD

      // 29 frames — still flooded
      runFrames(29, lowWater);
      expect(house.flooded).toBe(true);

      // 30th frame — now dry
      runFrames(1, lowWater);
      expect(house.flooded).toBe(false);
      expect(mockSetFlooded).toHaveBeenCalledWith(3, false);
    });

    it('should NOT unflood if depth is at or above unflood threshold', () => {
      const house = addHouse(4);
      house.flooded = true;

      // depth === 0.05 is NOT below threshold (must be < 0.05)
      runFrames(60, () => UNFLOOD_THRESHOLD);
      expect(house.flooded).toBe(true);
    });
  });

  describe('counter resets when condition is interrupted', () => {
    it('should reset flood counter when high water is interrupted', () => {
      addHouse(5);
      const highWater = () => 0.2;
      const noWater = () => 0.0;

      // 50 frames of high water
      runFrames(50, highWater);
      expect(mockHouses[0].flooded).toBe(false);

      // 1 frame of no water — resets counter
      runFrames(1, noWater);

      // 50 more frames of high water — total only 50 consecutive, not 60
      runFrames(50, highWater);
      expect(mockHouses[0].flooded).toBe(false);

      // Need 10 more to reach 60 consecutive
      runFrames(10, highWater);
      expect(mockHouses[0].flooded).toBe(true);
    });

    it('should reset unflood counter when low water is interrupted', () => {
      const house = addHouse(6);
      house.flooded = true;

      const lowWater = () => 0.01;
      const highWater = () => 0.2;

      // 20 frames of low water
      runFrames(20, lowWater);
      expect(house.flooded).toBe(true);

      // 1 frame of high water — resets unflood counter
      runFrames(1, highWater);

      // 20 more frames of low water — only 20 consecutive, not 30
      runFrames(20, lowWater);
      expect(house.flooded).toBe(true);

      // 10 more to reach 30 consecutive
      runFrames(10, lowWater);
      expect(house.flooded).toBe(false);
    });
  });

  describe('Req 9.6: hysteresis prevents flickering', () => {
    it('should not toggle state when water oscillates between thresholds', () => {
      addHouse(7);
      // Oscillate between 0.08 (below flood threshold) and 0.12 (above flood threshold)
      // every frame — never 60 consecutive frames above threshold.
      // We control the depth per-frame (not per-sample-call).
      let frameDepth = 0.08;
      const oscillating = () => frameDepth;

      for (let i = 0; i < 200; i++) {
        frameDepth = i % 2 === 0 ? 0.12 : 0.08;
        updateFloodDetection(oscillating);
      }
      // Should never become flooded because condition is never sustained for 60 frames
      expect(mockHouses[0].flooded).toBe(false);
    });

    it('should not unflood when water oscillates in the hysteresis band', () => {
      const house = addHouse(8);
      house.flooded = true;

      // Oscillate between 0.03 (below unflood) and 0.07 (above unflood but below flood)
      // The 0.07 frames break the unflood counter.
      // Control depth per-frame, not per-sample-call.
      let frameDepth = 0.03;
      const oscillating = () => frameDepth;

      for (let i = 0; i < 200; i++) {
        frameDepth = i % 2 === 0 ? 0.03 : 0.07;
        updateFloodDetection(oscillating);
      }
      // Should stay flooded because unflood condition is never sustained for 30 frames
      expect(house.flooded).toBe(true);
    });
  });

  describe('footprint sampling', () => {
    it('should check multiple points across the house footprint', () => {
      const house = addHouse(9, { x: 2, y: 0, z: 3 }, { x: 1, y: 0.5, z: 1 });
      const queriedPoints = [];

      const trackingFn = (wx, wz) => {
        queriedPoints.push({ wx, wz });
        return 0.0;
      };

      updateFloodDetection(trackingFn);

      // Should sample centre + 4 corners = 5 points
      expect(queriedPoints.length).toBe(5);
      // Centre
      expect(queriedPoints).toContainEqual({ wx: 2, wz: 3 });
      // Corners
      expect(queriedPoints).toContainEqual({ wx: 1, wz: 2 });
      expect(queriedPoints).toContainEqual({ wx: 3, wz: 2 });
      expect(queriedPoints).toContainEqual({ wx: 1, wz: 4 });
      expect(queriedPoints).toContainEqual({ wx: 3, wz: 4 });
    });
  });

  describe('reset', () => {
    it('should clear all counters so detection starts fresh', () => {
      addHouse(10);
      // Build up 50 frames of flood counter
      runFrames(50, () => 0.2);
      expect(mockHouses[0].flooded).toBe(false);

      // Reset counters
      reset();

      // Now need full 60 frames again
      runFrames(59, () => 0.2);
      expect(mockHouses[0].flooded).toBe(false);

      runFrames(1, () => 0.2);
      expect(mockHouses[0].flooded).toBe(true);
    });
  });
});

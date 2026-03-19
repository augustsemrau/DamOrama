import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock subsystem modules before importing Level
vi.mock('./UnifiedGrid.js', () => {
  const heights = {};
  return {
    GRID_SIZE: 512,
    init: vi.fn(() => { Object.keys(heights).forEach(k => delete heights[k]); }),
    setTerrainHeight: vi.fn((x, y, h) => { heights[`${x},${y}`] = h; }),
    getTerrainHeight: vi.fn((x, y) => heights[`${x},${y}`] ?? 0),
    __heights: heights,
  };
});

vi.mock('./Houses.js', () => ({
  reset: vi.fn(),
  placeHouse: vi.fn(() => 1),
}));

vi.mock('./ResourceBudget.js', () => ({
  reset: vi.fn(),
  init: vi.fn(),
}));

vi.mock('./GameLoop.js', () => ({
  setFloodDuration: vi.fn(),
}));

import { loadLevel, getWaterSources, isPartialCreditEnabled } from './Level.js';
import * as UnifiedGrid from './UnifiedGrid.js';
import * as Houses from './Houses.js';
import * as ResourceBudget from './ResourceBudget.js';
import { setFloodDuration } from './GameLoop.js';

/** Minimal valid level data for reuse across tests. */
const baseLevelData = () => ({
  terrain: { type: 'valley', params: { width: 128, depth: 0.3, direction: 'east-west' } },
  waterSources: [{ gridX: 256, gridY: 256, radius: 10, rate: 0.018 }],
  houses: [
    { x: 3, y: 0, z: 5, scaleX: 0.5, scaleY: 0.5, scaleZ: 0.5 },
    { x: -3, y: 0, z: 5, scaleX: 0.5, scaleY: 0.5, scaleZ: 0.5 },
  ],
  budget: { sand: 20, clay: 10, stone: 6, timber: 4 },
  floodDuration: 90,
  partialCredit: true,
});

describe('Level — JSON level loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Subsystem reset (Req 16.1) ──────────────────────────────────

  describe('subsystem reset', () => {
    it('resets Houses and ResourceBudget before loading', () => {
      loadLevel(baseLevelData());
      expect(Houses.reset).toHaveBeenCalled();
      expect(ResourceBudget.reset).toHaveBeenCalled();
    });

    it('initialises UnifiedGrid', () => {
      loadLevel(baseLevelData());
      expect(UnifiedGrid.init).toHaveBeenCalled();
    });
  });

  // ── Terrain profile (Req 16.2) ──────────────────────────────────

  describe('terrain profile', () => {
    it('applies valley terrain — centre cells are depressed', () => {
      loadLevel(baseLevelData());
      // Centre of grid (256, 256) should be the deepest point
      const centreCall = UnifiedGrid.setTerrainHeight.mock.calls.find(
        ([x, y]) => x === 256 && y === 256,
      );
      expect(centreCall).toBeDefined();
      expect(centreCall[2]).toBeCloseTo(-0.3, 5);
    });

    it('applies valley terrain — edge cells are at zero height', () => {
      loadLevel(baseLevelData());
      // Cell at y=0 is far from centre (256), outside the 128-wide valley
      const edgeCall = UnifiedGrid.setTerrainHeight.mock.calls.find(
        ([x, y]) => x === 0 && y === 0,
      );
      expect(edgeCall).toBeDefined();
      expect(edgeCall[2]).toBe(0);
    });

    it('handles missing terrain gracefully', () => {
      const data = baseLevelData();
      delete data.terrain;
      loadLevel(data);
      // init still called, no setTerrainHeight calls for terrain profile
      expect(UnifiedGrid.init).toHaveBeenCalled();
    });
  });

  // ── Water sources (Req 16.3) ────────────────────────────────────

  describe('water sources', () => {
    it('stores water sources from level data', () => {
      loadLevel(baseLevelData());
      const sources = getWaterSources();
      expect(sources).toHaveLength(1);
      expect(sources[0]).toEqual({ x: 256, y: 256, rate: 0.018, radius: 10 });
    });

    it('clears previous water sources on reload', () => {
      loadLevel(baseLevelData());
      loadLevel({ ...baseLevelData(), waterSources: [] });
      expect(getWaterSources()).toHaveLength(0);
    });

    it('handles missing waterSources array', () => {
      const data = baseLevelData();
      delete data.waterSources;
      loadLevel(data);
      expect(getWaterSources()).toHaveLength(0);
    });
  });

  // ── House placement (Req 16.4) ──────────────────────────────────

  describe('house placement', () => {
    it('places houses at specified positions and scales', () => {
      loadLevel(baseLevelData());
      expect(Houses.placeHouse).toHaveBeenCalledTimes(2);
      expect(Houses.placeHouse).toHaveBeenCalledWith(
        { x: 3, y: 0, z: 5 },
        { x: 0.5, y: 0.5, z: 0.5 },
      );
      expect(Houses.placeHouse).toHaveBeenCalledWith(
        { x: -3, y: 0, z: 5 },
        { x: 0.5, y: 0.5, z: 0.5 },
      );
    });

    it('handles missing houses array', () => {
      const data = baseLevelData();
      delete data.houses;
      loadLevel(data);
      expect(Houses.placeHouse).not.toHaveBeenCalled();
    });
  });

  // ── Resource budget (Req 16.5) ──────────────────────────────────

  describe('resource budget', () => {
    it('initialises ResourceBudget with level budget', () => {
      loadLevel(baseLevelData());
      expect(ResourceBudget.init).toHaveBeenCalledWith({
        sand: 20, clay: 10, stone: 6, timber: 4,
      });
    });

    it('handles missing budget gracefully', () => {
      const data = baseLevelData();
      delete data.budget;
      loadLevel(data);
      expect(ResourceBudget.init).not.toHaveBeenCalled();
    });
  });

  // ── Flood parameters ────────────────────────────────────────────

  describe('flood parameters', () => {
    it('sets flood duration from level data', () => {
      loadLevel(baseLevelData());
      expect(setFloodDuration).toHaveBeenCalledWith(90);
    });

    it('does not set flood duration when missing', () => {
      const data = baseLevelData();
      delete data.floodDuration;
      loadLevel(data);
      expect(setFloodDuration).not.toHaveBeenCalled();
    });
  });

  // ── Partial credit ──────────────────────────────────────────────

  describe('partial credit', () => {
    it('returns true when enabled in level data', () => {
      loadLevel(baseLevelData());
      expect(isPartialCreditEnabled()).toBe(true);
    });

    it('defaults to false when not specified', () => {
      const data = baseLevelData();
      delete data.partialCredit;
      loadLevel(data);
      expect(isPartialCreditEnabled()).toBe(false);
    });
  });

  // ── Null/undefined input ────────────────────────────────────────

  describe('null input', () => {
    it('handles null levelData without throwing', () => {
      expect(() => loadLevel(null)).not.toThrow();
    });

    it('handles undefined levelData without throwing', () => {
      expect(() => loadLevel(undefined)).not.toThrow();
    });
  });
});

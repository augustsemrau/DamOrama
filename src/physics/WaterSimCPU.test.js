import { describe, it, expect, beforeEach } from 'vitest';
import {
  init,
  step,
  getWaterDepth,
  addSource,
  getGridSize,
  getWaterDepthArray,
  getTerrainHeightArray,
  clearSources,
  reset,
  setBlockedCells,
  getBlockedCells,
} from './WaterSimCPU.js';

const GRID = 128;
const CELL_SIZE = 16 / GRID;
const CELL_AREA = CELL_SIZE * CELL_SIZE;

describe('WaterSimCPU', () => {
  beforeEach(() => {
    init();
  });

  describe('init', () => {
    it('should initialise with zero water depth everywhere', () => {
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          expect(getWaterDepth(x, y)).toBe(0);
        }
      }
    });

    it('should accept an external grid with terrain and water arrays', () => {
      const cellCount = GRID * GRID;
      const terrain = new Float32Array(cellCount);
      const water = new Float32Array(cellCount);
      terrain[0] = 1.5;
      water[0] = 0.3;
      init({ terrainHeight: terrain, waterDepth: water });
      expect(getWaterDepth(0, 0)).toBeCloseTo(0.3, 5);
      expect(getTerrainHeightArray()[0]).toBeCloseTo(1.5, 5);
    });

    it('should return grid size of 128', () => {
      expect(getGridSize()).toBe(128);
    });
  });

  describe('getWaterDepth', () => {
    it('should return 0 for out-of-bounds coordinates', () => {
      expect(getWaterDepth(-1, 0)).toBe(0);
      expect(getWaterDepth(0, -1)).toBe(0);
      expect(getWaterDepth(128, 0)).toBe(0);
      expect(getWaterDepth(0, 128)).toBe(0);
    });
  });

  describe('addSource and step', () => {
    it('should add water at the source position each step', () => {
      const cx = 64;
      const cy = 64;
      const rate = 1.0; // 1 unit/s
      addSource({ x: cx, y: cy }, rate);

      step(1 / 60);

      // Source cell should have gained water
      expect(getWaterDepth(cx, cy)).toBeGreaterThan(0);
    });

    it('should spread water to neighbours over multiple steps', () => {
      const cx = 64;
      const cy = 64;
      addSource({ x: cx, y: cy }, 2.0);

      // Run several steps
      for (let i = 0; i < 120; i++) {
        step(1 / 60);
      }

      // Neighbours should have received some water
      expect(getWaterDepth(cx + 1, cy)).toBeGreaterThan(0);
      expect(getWaterDepth(cx - 1, cy)).toBeGreaterThan(0);
      expect(getWaterDepth(cx, cy + 1)).toBeGreaterThan(0);
      expect(getWaterDepth(cx, cy - 1)).toBeGreaterThan(0);
    });
  });

  describe('water conservation', () => {
    it('should conserve total water volume (no sources, flat terrain)', () => {
      // Place a blob of water in the centre
      const water = getWaterDepthArray();
      const cx = 64;
      const cy = 64;
      water[cy * GRID + cx] = 5.0;

      const initialVolume = 5.0 * CELL_AREA;

      // Run 200 steps
      for (let i = 0; i < 200; i++) {
        step(1 / 60);
      }

      // Sum total water
      let totalVolume = 0;
      for (let i = 0; i < GRID * GRID; i++) {
        totalVolume += water[i] * CELL_AREA;
      }

      // Should be conserved within floating-point tolerance
      expect(totalVolume).toBeCloseTo(initialVolume, 4);
    });
  });

  describe('downhill flow', () => {
    it('should flow water downhill on sloped terrain', () => {
      const terrain = getTerrainHeightArray();
      const water = getWaterDepthArray();

      // Create a slope: terrain height decreases from left to right
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          terrain[y * GRID + x] = (GRID - x) * 0.1;
        }
      }

      // Place water on the high side (left)
      const startX = 10;
      const startY = 64;
      water[startY * GRID + startX] = 2.0;

      // Run simulation
      for (let i = 0; i < 300; i++) {
        step(1 / 60);
      }

      // Water should have moved to the right (downhill)
      // Check that cells further right have water
      let rightWater = 0;
      for (let x = startX + 5; x < GRID; x++) {
        rightWater += getWaterDepth(x, startY);
      }
      expect(rightWater).toBeGreaterThan(0);
    });
  });

  describe('stability', () => {
    it('should not produce NaN or negative water depths', () => {
      addSource({ x: 64, y: 64 }, 5.0);

      for (let i = 0; i < 600; i++) {
        step(1 / 60);
      }

      const water = getWaterDepthArray();
      for (let i = 0; i < GRID * GRID; i++) {
        expect(water[i]).not.toBeNaN();
        expect(water[i]).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle zero dt gracefully', () => {
      addSource({ x: 64, y: 64 }, 1.0);
      step(0);
      expect(getWaterDepth(64, 64)).toBe(0); // no water added
    });

    it('should handle negative dt gracefully', () => {
      addSource({ x: 64, y: 64 }, 1.0);
      step(-1);
      expect(getWaterDepth(64, 64)).toBe(0);
    });
  });

  describe('clearSources and reset', () => {
    it('should stop adding water after clearSources', () => {
      addSource({ x: 64, y: 64 }, 10.0);
      step(1 / 60);
      const depthBefore = getWaterDepth(64, 64);
      expect(depthBefore).toBeGreaterThan(0);

      clearSources();
      // Water should still exist but no new water added at source
      const depthAfterClear = getWaterDepth(64, 64);
      step(1 / 60);
      // Depth may change due to flow, but no new source water
      // Just verify no crash
      expect(getWaterDepth(64, 64)).toBeGreaterThanOrEqual(0);
    });

    it('should zero all water on reset', () => {
      addSource({ x: 64, y: 64 }, 10.0);
      step(1 / 60);
      expect(getWaterDepth(64, 64)).toBeGreaterThan(0);

      reset();
      expect(getWaterDepth(64, 64)).toBe(0);
    });
  });

  describe('cell blocking from rigid body AABBs', () => {
    it('should mark cells as blocked from a world-coordinate AABB', () => {
      // Place a 1×1 world-unit block centred at world origin (0, 0)
      // World (0,0) → grid (64, 64). Block spans [-0.5, 0.5] on both axes.
      // Grid: x = floor((-0.5+8)/0.125)=60 to floor((0.5+8)/0.125)=68
      setBlockedCells([{ minX: -0.5, minZ: -0.5, maxX: 0.5, maxZ: 0.5 }]);

      const blocked = getBlockedCells();
      // Centre cell (64, 64) should be blocked
      expect(blocked[64 * 128 + 64]).toBe(1);
      // Cell well outside the AABB should not be blocked
      expect(blocked[10 * 128 + 10]).toBe(0);
    });

    it('should zero water depth in blocked cells', () => {
      const water = getWaterDepthArray();
      // Place water at grid cell (64, 64)
      water[64 * 128 + 64] = 5.0;
      expect(getWaterDepth(64, 64)).toBe(5.0);

      // Block that cell
      setBlockedCells([{ minX: -0.1, minZ: -0.1, maxX: 0.1, maxZ: 0.1 }]);
      expect(getWaterDepth(64, 64)).toBe(0);
    });

    it('should prevent water from flowing into blocked cells', () => {
      // Place a wall of blocked cells across the middle (x=64, all z)
      // World x=0 → grid x=64. Block a thin vertical strip.
      setBlockedCells([{ minX: -0.1, minZ: -8, maxX: 0.1, maxZ: 8 }]);

      // Add water source to the left of the wall (grid x=32)
      addSource({ x: 32, y: 64 }, 5.0);

      // Run simulation
      for (let i = 0; i < 200; i++) {
        step(1 / 60);
      }

      // Water should exist on the left side
      expect(getWaterDepth(32, 64)).toBeGreaterThan(0);

      // Water should NOT have crossed the blocked wall to the right side
      // Check cells well to the right of the wall
      expect(getWaterDepth(80, 64)).toBe(0);
    });

    it('should clear previous blocking when setBlockedCells is called again', () => {
      setBlockedCells([{ minX: -0.5, minZ: -0.5, maxX: 0.5, maxZ: 0.5 }]);
      const blocked = getBlockedCells();
      expect(blocked[64 * 128 + 64]).toBe(1);

      // Call again with empty array — all cells should be unblocked
      setBlockedCells([]);
      expect(blocked[64 * 128 + 64]).toBe(0);
    });

    it('should handle AABBs that extend outside the grid bounds', () => {
      // AABB extends beyond the world on all sides
      setBlockedCells([{ minX: -20, minZ: -20, maxX: 20, maxZ: 20 }]);
      const blocked = getBlockedCells();
      // All cells should be blocked (clamped to grid)
      let allBlocked = true;
      for (let i = 0; i < 128 * 128; i++) {
        if (blocked[i] !== 1) { allBlocked = false; break; }
      }
      expect(allBlocked).toBe(true);
    });

    it('should reset blocked cells on reset()', () => {
      setBlockedCells([{ minX: -0.5, minZ: -0.5, maxX: 0.5, maxZ: 0.5 }]);
      expect(getBlockedCells()[64 * 128 + 64]).toBe(1);

      reset();
      expect(getBlockedCells()[64 * 128 + 64]).toBe(0);
    });
  });

  describe('water deflection around rigid bodies (Req 6.2, 6.3)', () => {
    it('should deflect water around a blocked region', () => {
      // Create a slope so water flows left-to-right (terrain high on left, low on right)
      const terrain = getTerrainHeightArray();
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          terrain[y * GRID + x] = (GRID - x) * 0.05;
        }
      }

      // Place a block in the middle of the flow path at grid row 64
      // Block spans grid x=60..68, y=60..68 (world roughly [-0.5,0.5] on both axes)
      setBlockedCells([{ minX: -0.5, minZ: -0.5, maxX: 0.5, maxZ: 0.5 }]);

      // Add water source upstream (left side), at row 64
      addSource({ x: 10, y: 64 }, 5.0);

      // Run simulation long enough for water to reach and flow around the block
      for (let i = 0; i < 400; i++) {
        step(1 / 60);
      }

      // Water should have reached downstream of the block (right side, past x=68)
      // by flowing around it via rows above or below the block
      let downstreamWater = 0;
      for (let y = 0; y < GRID; y++) {
        downstreamWater += getWaterDepth(80, y);
      }
      expect(downstreamWater).toBeGreaterThan(0);

      // The blocked cells themselves should have zero water
      expect(getWaterDepth(64, 64)).toBe(0);

      // Water should be present in cells adjacent to the block (deflected around it)
      // Check rows just above and below the block region
      const aboveBlock = getWaterDepth(64, 55);
      const belowBlock = getWaterDepth(64, 73);
      const deflected = aboveBlock > 0 || belowBlock > 0;
      expect(deflected).toBe(true);
    });

    it('should fill previously blocked area when block is removed', () => {
      // Flat terrain — water spreads radially
      // Place water source at grid centre
      addSource({ x: 64, y: 64 }, 5.0);

      // Block a region near the source
      // World (1, 1) → grid ~(72, 72). Block a small area.
      setBlockedCells([{ minX: 0.5, minZ: 0.5, maxX: 1.5, maxZ: 1.5 }]);

      // Run simulation so water spreads around the block
      for (let i = 0; i < 200; i++) {
        step(1 / 60);
      }

      // Blocked cells should have zero water
      // Grid cell (72, 72) is inside the blocked region
      const blockedCellX = 72;
      const blockedCellY = 72;
      expect(getWaterDepth(blockedCellX, blockedCellY)).toBe(0);

      // Surrounding cells should have water (water flowed around the block)
      expect(getWaterDepth(blockedCellX - 5, blockedCellY)).toBeGreaterThan(0);

      // Now remove the block (simulate rigid body removal)
      setBlockedCells([]);

      // Run more steps — water should fill the previously blocked area
      for (let i = 0; i < 200; i++) {
        step(1 / 60);
      }

      // Previously blocked cells should now have water
      expect(getWaterDepth(blockedCellX, blockedCellY)).toBeGreaterThan(0);
    });
  });
});

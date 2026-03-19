/**
 * WaterSimCPU — CPU fallback water simulation using the Virtual Pipes method.
 *
 * Implements shallow water equations on a 128×128 grid for browsers
 * without WebGPU support. Uses pressure-driven flow between adjacent
 * cells via virtual pipes (N, S, E, W).
 *
 * API:
 *   init(grid)            — initialise internal state (optionally from a UnifiedGrid)
 *   step(dt)              — advance simulation by dt seconds
 *   getWaterDepth(x, y)   — return water depth at grid cell (x, y)
 *   addSource(pos, rate)  — register a continuous water source
 *
 * Requirements: 4.1, 4.2
 */

const GRID_SIZE = 128;
const CELL_SIZE = 16 / GRID_SIZE; // 0.125 world units
const CELL_AREA = CELL_SIZE * CELL_SIZE;
const GRAVITY = 9.81;
const PIPE_AREA = CELL_AREA; // cross-section area = cell_size²
const PIPE_LENGTH = CELL_SIZE;

// Basin half-size for world→grid coordinate mapping
const BASIN_HALF = 8; // 16 / 2

// Internal state
let terrainHeight = null; // Float32Array[GRID_SIZE * GRID_SIZE]
let waterDepth = null;    // Float32Array[GRID_SIZE * GRID_SIZE]
let fluxN = null;         // Float32Array — flow to north neighbour
let fluxS = null;         // Float32Array — flow to south neighbour
let fluxE = null;         // Float32Array — flow to east neighbour
let fluxW = null;         // Float32Array — flow to west neighbour
let blockedCells = null;  // Uint8Array — 1 = blocked by rigid body, 0 = open
let sources = [];         // Array of { x, y, rate }
let initialised = false;

/**
 * Flat index into 1D arrays from (x, y) grid coordinates.
 */
function idx(x, y) {
  return y * GRID_SIZE + x;
}

/**
 * Initialise the water simulation.
 * @param {object} [grid] — optional UnifiedGrid-compatible object with
 *   `terrainHeight` and `waterDepth` Float32Arrays. If omitted, creates
 *   flat internal arrays.
 */
export function init(grid) {
  const cellCount = GRID_SIZE * GRID_SIZE;

  if (grid && grid.terrainHeight) {
    terrainHeight = grid.terrainHeight;
  } else {
    terrainHeight = new Float32Array(cellCount);
  }

  if (grid && grid.waterDepth) {
    waterDepth = grid.waterDepth;
  } else {
    waterDepth = new Float32Array(cellCount);
  }

  fluxN = new Float32Array(cellCount);
  fluxS = new Float32Array(cellCount);
  fluxE = new Float32Array(cellCount);
  fluxW = new Float32Array(cellCount);
  blockedCells = new Uint8Array(cellCount);

  sources = [];
  initialised = true;
}

/**
 * Advance the simulation by dt seconds.
 *
 * Steps:
 *   1. Add water from active sources
 *   2. Compute flux updates (pressure-driven Virtual Pipes)
 *   3. Apply CFL scaling to prevent instability
 *   4. Update water depths from net flux
 *   5. Clamp water depth >= 0
 *
 * @param {number} dt — time step in seconds
 */
export function step(dt) {
  if (!initialised) return;
  if (dt <= 0) return;

  // --- 1. Add water from sources ---
  for (const src of sources) {
    const ix = Math.floor(src.x);
    const iy = Math.floor(src.y);
    if (ix >= 0 && ix < GRID_SIZE && iy >= 0 && iy < GRID_SIZE) {
      waterDepth[idx(ix, iy)] += src.rate * dt;
    }
  }

  // --- 2. Compute flux updates ---
  // Precompute constant: dt * g * A / L
  const fluxFactor = dt * GRAVITY * PIPE_AREA / PIPE_LENGTH;

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const i = idx(x, y);

      // Blocked cells act as walls — zero all flux in/out
      if (blockedCells[i]) {
        fluxN[i] = 0;
        fluxS[i] = 0;
        fluxE[i] = 0;
        fluxW[i] = 0;
        continue;
      }

      const hSelf = terrainHeight[i] + waterDepth[i]; // water surface height

      // North (y - 1) — also block flux toward blocked neighbours
      if (y > 0 && !blockedCells[idx(x, y - 1)]) {
        const iN = idx(x, y - 1);
        const hN = terrainHeight[iN] + waterDepth[iN];
        fluxN[i] = Math.max(0, fluxN[i] + fluxFactor * (hSelf - hN));
      } else {
        fluxN[i] = 0;
      }

      // South (y + 1)
      if (y < GRID_SIZE - 1 && !blockedCells[idx(x, y + 1)]) {
        const iS = idx(x, y + 1);
        const hS = terrainHeight[iS] + waterDepth[iS];
        fluxS[i] = Math.max(0, fluxS[i] + fluxFactor * (hSelf - hS));
      } else {
        fluxS[i] = 0;
      }

      // East (x + 1)
      if (x < GRID_SIZE - 1 && !blockedCells[idx(x + 1, y)]) {
        const iE = idx(x + 1, y);
        const hE = terrainHeight[iE] + waterDepth[iE];
        fluxE[i] = Math.max(0, fluxE[i] + fluxFactor * (hSelf - hE));
      } else {
        fluxE[i] = 0;
      }

      // West (x - 1)
      if (x > 0 && !blockedCells[idx(x - 1, y)]) {
        const iW = idx(x - 1, y);
        const hW = terrainHeight[iW] + waterDepth[iW];
        fluxW[i] = Math.max(0, fluxW[i] + fluxFactor * (hSelf - hW));
      } else {
        fluxW[i] = 0;
      }
    }
  }

  // --- 3. CFL scaling ---
  // Scale all outgoing fluxes so no cell loses more water than it has.
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const i = idx(x, y);
      const totalOut = fluxN[i] + fluxS[i] + fluxE[i] + fluxW[i];
      if (totalOut > 0) {
        const maxOut = waterDepth[i] * CELL_AREA / dt;
        if (totalOut > maxOut) {
          const scale = maxOut / totalOut;
          fluxN[i] *= scale;
          fluxS[i] *= scale;
          fluxE[i] *= scale;
          fluxW[i] *= scale;
        }
      }
    }
  }

  // --- 4. Update water depths from net flux ---
  const dtOverArea = dt / CELL_AREA;

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const i = idx(x, y);

      // Outflow from this cell
      const outflow = fluxN[i] + fluxS[i] + fluxE[i] + fluxW[i];

      // Inflow from neighbours
      let inflow = 0;
      if (y > 0) inflow += fluxS[idx(x, y - 1)];       // north neighbour's south flux
      if (y < GRID_SIZE - 1) inflow += fluxN[idx(x, y + 1)]; // south neighbour's north flux
      if (x > 0) inflow += fluxE[idx(x - 1, y)];       // west neighbour's east flux
      if (x < GRID_SIZE - 1) inflow += fluxW[idx(x + 1, y)]; // east neighbour's west flux

      waterDepth[i] += (inflow - outflow) * dtOverArea;

      // --- 5. Clamp ---
      if (waterDepth[i] < 0) waterDepth[i] = 0;
    }
  }
}

/**
 * Get the water depth at grid cell (x, y).
 * @param {number} x — column index (0..127)
 * @param {number} y — row index (0..127)
 * @returns {number} water depth, or 0 if out of bounds
 */
export function getWaterDepth(x, y) {
  if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return 0;
  if (!initialised) return 0;
  return waterDepth[idx(x, y)];
}

/**
 * Register a continuous water source.
 * @param {{ x: number, y: number }} pos — grid cell position
 * @param {number} rate — water volume added per second
 */
export function addSource(pos, rate) {
  sources.push({ x: pos.x, y: pos.y, rate });
}

/**
 * Get the grid size (useful for consumers).
 * @returns {number}
 */
export function getGridSize() {
  return GRID_SIZE;
}

/**
 * Get a reference to the internal water depth array (for rendering).
 * @returns {Float32Array|null}
 */
export function getWaterDepthArray() {
  return waterDepth;
}

/**
 * Get a reference to the internal terrain height array.
 * @returns {Float32Array|null}
 */
export function getTerrainHeightArray() {
  return terrainHeight;
}

/**
 * Remove all active water sources.
 */
export function clearSources() {
  sources = [];
}

/**
 * Reset the simulation to initial state (zero water, zero flux).
 * Terrain is preserved.
 */
export function reset() {
  if (!initialised) return;
  const cellCount = GRID_SIZE * GRID_SIZE;
  waterDepth.fill(0);
  fluxN.fill(0);
  fluxS.fill(0);
  fluxE.fill(0);
  fluxW.fill(0);
  blockedCells.fill(0);
  sources = [];
}

/**
 * Convert a world-coordinate AABB to grid cell range on the 128×128 CPU grid.
 * World origin is at grid centre (64, 64). World range [-8, 8].
 * @param {{ minX: number, minZ: number, maxX: number, maxZ: number }} aabb
 * @returns {{ x0: number, y0: number, x1: number, y1: number }}
 */
function worldAABBToGridRange(aabb) {
  const x0 = Math.max(0, Math.floor((aabb.minX + BASIN_HALF) / CELL_SIZE));
  const y0 = Math.max(0, Math.floor((aabb.minZ + BASIN_HALF) / CELL_SIZE));
  const x1 = Math.min(GRID_SIZE - 1, Math.floor((aabb.maxX + BASIN_HALF) / CELL_SIZE));
  const y1 = Math.min(GRID_SIZE - 1, Math.floor((aabb.maxZ + BASIN_HALF) / CELL_SIZE));
  return { x0, y0, x1, y1 };
}

/**
 * Update blocked cells from an array of world-coordinate AABBs.
 * Clears previous blocking, then marks all cells overlapping any AABB.
 * Blocked cells have their water depth zeroed and act as walls in flux computation.
 * @param {Array<{ minX: number, minZ: number, maxX: number, maxZ: number }>} aabbs
 */
export function setBlockedCells(aabbs) {
  if (!initialised) return;
  blockedCells.fill(0);

  for (const aabb of aabbs) {
    const { x0, y0, x1, y1 } = worldAABBToGridRange(aabb);
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        const i = idx(gx, gy);
        blockedCells[i] = 1;
        waterDepth[i] = 0;
      }
    }
  }
}

/**
 * Get a reference to the internal blocked cells array (for testing/inspection).
 * @returns {Uint8Array|null}
 */
export function getBlockedCells() {
  return blockedCells;
}

/**
 * Set the number of simulation substeps per frame.
 * Used by AdaptiveQuality to reduce work when frame budget is exceeded.
 * On CPU backend this is a no-op since CPU runs a single step per call,
 * but the API is provided for facade compatibility.
 * @param {number} _n
 */
export function setSubsteps(_n) {
  // CPU backend runs one step per call; substep count is managed by caller
}

/**
 * WaterSim — facade that delegates to WaterSimGPU or WaterSimCPU.
 *
 * Detects WebGPU availability via `navigator.gpu`. If WebGPU is present
 * and WaterSimGPU can be loaded, delegates to the GPU implementation.
 * Otherwise falls back to WaterSimCPU (128×128 grid).
 *
 * All consumers import from this module and get a unified API regardless
 * of which backend is active.
 *
 * Requirements: 4.2
 */

let impl = null;
let gpuMode = false;

/**
 * Initialise the water simulation.
 * Attempts GPU backend first (if WebGPU available), falls back to CPU.
 * @param {object} [grid] — optional UnifiedGrid-compatible object
 */
export async function init(grid) {
  gpuMode = false;
  impl = null;

  if (typeof navigator !== 'undefined' && navigator.gpu) {
    try {
      const gpu = await import('./WaterSimGPU.js');
      await gpu.init(grid);
      impl = gpu;
      gpuMode = true;
      console.log('[WaterSim] Using GPU implementation (512×512)');
    } catch {
      // WaterSimGPU not available yet — fall back to CPU
      console.log('[WaterSim] GPU module not available, falling back to CPU');
    }
  }

  if (!gpuMode) {
    const cpu = await import('./WaterSimCPU.js');
    cpu.init(grid);
    impl = cpu;
    console.log('[WaterSim] Using CPU implementation (128×128)');
  }
}

/**
 * Advance the simulation by dt seconds.
 * Async because GPU backend requires buffer mapping.
 * @param {number} dt
 */
export async function step(dt) {
  if (impl) await impl.step(dt);
}

/**
 * Get water depth at grid cell (x, y).
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function getWaterDepth(x, y) {
  if (!impl) return 0;
  return impl.getWaterDepth(x, y);
}

/**
 * Register a continuous water source.
 * @param {{ x: number, y: number }} pos
 * @param {number} rate
 */
export function addSource(pos, rate) {
  if (impl) impl.addSource(pos, rate);
}

/**
 * Get the grid size (512 for GPU, 128 for CPU).
 * @returns {number}
 */
export function getGridSize() {
  if (!impl) return 0;
  return impl.getGridSize();
}

/**
 * Get a reference to the internal water depth array.
 * @returns {Float32Array|null}
 */
export function getWaterDepthArray() {
  if (!impl) return null;
  return impl.getWaterDepthArray();
}

/**
 * Get a reference to the internal terrain height array.
 * @returns {Float32Array|null}
 */
export function getTerrainHeightArray() {
  if (!impl) return null;
  return impl.getTerrainHeightArray();
}

/**
 * Remove all active water sources.
 */
export function clearSources() {
  if (impl) impl.clearSources();
}

/**
 * Reset the simulation (zero water/flux, terrain preserved).
 */
export function reset() {
  if (impl) impl.reset();
}

/**
 * Returns true if using the GPU implementation.
 * @returns {boolean}
 */
export function isGPU() {
  return gpuMode;
}

/**
 * Update blocked cells from rigid body AABBs.
 * Delegates to the active backend.
 * @param {Array<{ minX: number, minZ: number, maxX: number, maxZ: number }>} aabbs
 */
export function setBlockedCells(aabbs) {
  if (impl && impl.setBlockedCells) impl.setBlockedCells(aabbs);
}

/**
 * Set the number of simulation substeps per frame.
 * Used by AdaptiveQuality to reduce work when frame budget is exceeded.
 * @param {number} n
 */
export function setSubsteps(n) {
  if (impl && impl.setSubsteps) impl.setSubsteps(n);
}

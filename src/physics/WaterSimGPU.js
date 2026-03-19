/**
 * WaterSimGPU — WebGPU compute shader water simulation.
 *
 * Runs the SWE Virtual Pipes method on a 512×512 grid using WebGPU
 * compute shaders defined in `src/shaders/water-sim.wgsl`.
 *
 * Two compute pipelines per substep:
 *   1. fluxUpdate  — pressure-driven flux between adjacent cells + CFL scaling
 *   2. depthUpdate — net flux → water depth change, clamp >= 0
 *
 * API matches WaterSimCPU:
 *   init(grid)            — async, sets up GPU device, buffers, pipelines
 *   step(dt)              — async, runs substeps on GPU, reads back water depth
 *   getWaterDepth(x, y)   — read from CPU-side array (updated after readback)
 *   addSource(pos, rate)  — register a continuous water source
 *   getGridSize()         — returns 512
 *   getWaterDepthArray()  — reference to CPU-side water depth Float32Array
 *   getTerrainHeightArray() — reference to CPU-side terrain height Float32Array
 *   clearSources()        — remove all active sources
 *   reset()               — zero water and flux, preserve terrain
 *
 * Requirements: 3.1, 3.2, 3.6
 */

import shaderSource from '../shaders/water-sim.wgsl?raw';

const GRID_SIZE = 512;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;
const CELL_SIZE = 16 / GRID_SIZE; // 0.03125
const GRAVITY = 9.81;
let substeps = 4;
const WORKGROUPS = Math.ceil(GRID_SIZE / 16); // 32

// GPU handles
let device = null;
let terrainHeightBuffer = null;
let waterDepthBuffer = null;
let fluxNBuffer = null;
let fluxSBuffer = null;
let fluxEBuffer = null;
let fluxWBuffer = null;
let paramsBuffer = null;
let readbackBuffer = null;
let fluxUpdatePipeline = null;
let depthUpdatePipeline = null;
let bindGroup = null;

// CPU-side arrays
let terrainHeight = null;
let waterDepth = null;
let sources = [];
let initialised = false;

/**
 * Flat index from grid coordinates.
 */
function idx(x, y) {
  return y * GRID_SIZE + x;
}

/**
 * Initialise the GPU water simulation.
 * Requests adapter/device, creates buffers, pipelines, and bind group.
 * @param {object} [grid] — optional UnifiedGrid-compatible object
 */
export async function init(grid) {
  // 1. Get GPU adapter and device
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('WebGPU adapter not available');
  device = await adapter.requestDevice();

  // 2. Initialise CPU-side arrays
  if (grid && grid.terrainHeight) {
    terrainHeight = grid.terrainHeight;
  } else {
    terrainHeight = new Float32Array(CELL_COUNT);
  }

  if (grid && grid.waterDepth) {
    waterDepth = grid.waterDepth;
  } else {
    waterDepth = new Float32Array(CELL_COUNT);
  }

  sources = [];

  const bufferSize = CELL_COUNT * 4; // Float32 = 4 bytes

  // 3. Create GPU buffers
  terrainHeightBuffer = device.createBuffer({
    size: bufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  waterDepthBuffer = device.createBuffer({
    size: bufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });

  fluxNBuffer = device.createBuffer({ size: bufferSize, usage: GPUBufferUsage.STORAGE });
  fluxSBuffer = device.createBuffer({ size: bufferSize, usage: GPUBufferUsage.STORAGE });
  fluxEBuffer = device.createBuffer({ size: bufferSize, usage: GPUBufferUsage.STORAGE });
  fluxWBuffer = device.createBuffer({ size: bufferSize, usage: GPUBufferUsage.STORAGE });

  // SimParams: u32 gridSize (4), f32 dt (4), f32 gravity (4), f32 cellSize (4) = 16 bytes
  paramsBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  readbackBuffer = device.createBuffer({
    size: bufferSize,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  // 4. Create shader module and compute pipelines
  const shaderModule = device.createShaderModule({ code: shaderSource });

  fluxUpdatePipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: shaderModule, entryPoint: 'fluxUpdate' },
  });

  depthUpdatePipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: shaderModule, entryPoint: 'depthUpdate' },
  });

  // 5. Create bind group (all 7 bindings matching WGSL layout)
  bindGroup = device.createBindGroup({
    layout: fluxUpdatePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: terrainHeightBuffer } },
      { binding: 1, resource: { buffer: waterDepthBuffer } },
      { binding: 2, resource: { buffer: fluxNBuffer } },
      { binding: 3, resource: { buffer: fluxSBuffer } },
      { binding: 4, resource: { buffer: fluxEBuffer } },
      { binding: 5, resource: { buffer: fluxWBuffer } },
      { binding: 6, resource: { buffer: paramsBuffer } },
    ],
  });

  // 6. Upload initial terrain data to GPU
  device.queue.writeBuffer(terrainHeightBuffer, 0, terrainHeight);
  device.queue.writeBuffer(waterDepthBuffer, 0, waterDepth);

  initialised = true;
}

/**
 * Advance the simulation by dt seconds (async — GPU readback requires mapping).
 *
 * Steps:
 *   1. Add water from sources to CPU-side waterDepth, upload to GPU
 *   2. Run SUBSTEPS compute passes (fluxUpdate + depthUpdate each)
 *   3. Copy waterDepthBuffer to readbackBuffer, map and read back to CPU
 *
 * @param {number} dt — time step in seconds
 */
export async function step(dt) {
  if (!initialised || !device) return;
  if (dt <= 0) return;

  // 1. Add water from sources on CPU side
  for (const src of sources) {
    const ix = Math.floor(src.x);
    const iy = Math.floor(src.y);
    if (ix >= 0 && ix < GRID_SIZE && iy >= 0 && iy < GRID_SIZE) {
      waterDepth[idx(ix, iy)] += src.rate * dt;
    }
  }

  // Upload updated water depth to GPU
  device.queue.writeBuffer(waterDepthBuffer, 0, waterDepth);

  // Upload terrain (in case it changed externally)
  device.queue.writeBuffer(terrainHeightBuffer, 0, terrainHeight);

  // 2. Run substeps
  const substepDt = dt / substeps;
  const paramsData = new ArrayBuffer(16);
  const paramsView = new DataView(paramsData);

  for (let s = 0; s < substeps; s++) {
    // Write params uniform
    paramsView.setUint32(0, GRID_SIZE, true);   // gridSize
    paramsView.setFloat32(4, substepDt, true);   // dt
    paramsView.setFloat32(8, GRAVITY, true);     // gravity
    paramsView.setFloat32(12, CELL_SIZE, true);  // cellSize
    device.queue.writeBuffer(paramsBuffer, 0, paramsData);

    // Encode compute pass
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();

    // Pass 1: fluxUpdate
    pass.setPipeline(fluxUpdatePipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(WORKGROUPS, WORKGROUPS);

    // Pass 2: depthUpdate
    pass.setPipeline(depthUpdatePipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(WORKGROUPS, WORKGROUPS);

    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  // 3. Read back water depth from GPU to CPU
  const copyEncoder = device.createCommandEncoder();
  copyEncoder.copyBufferToBuffer(waterDepthBuffer, 0, readbackBuffer, 0, CELL_COUNT * 4);
  device.queue.submit([copyEncoder.finish()]);

  await readbackBuffer.mapAsync(GPUMapMode.READ);
  const mappedRange = readbackBuffer.getMappedRange();
  waterDepth.set(new Float32Array(mappedRange));
  readbackBuffer.unmap();
}

/**
 * Get the water depth at grid cell (x, y).
 * Reads from CPU-side array (updated after each step's readback).
 * @param {number} x — column index (0..511)
 * @param {number} y — row index (0..511)
 * @returns {number}
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

/** @returns {number} */
export function getGridSize() {
  return GRID_SIZE;
}

/** @returns {Float32Array|null} */
export function getWaterDepthArray() {
  return waterDepth;
}

/** @returns {Float32Array|null} */
export function getTerrainHeightArray() {
  return terrainHeight;
}

/** Remove all active water sources. */
export function clearSources() {
  sources = [];
}

/**
 * Set the number of simulation substeps per frame.
 * Used by AdaptiveQuality to reduce work when frame budget is exceeded.
 * @param {number} n
 */
export function setSubsteps(n) {
  substeps = Math.max(1, Math.floor(n));
}

/**
 * Reset the simulation to initial state (zero water, zero flux).
 * Terrain is preserved.
 */
export function reset() {
  if (!initialised || !device) return;
  waterDepth.fill(0);
  sources = [];

  // Zero out GPU buffers for water depth and flux
  device.queue.writeBuffer(waterDepthBuffer, 0, waterDepth);
  const zeros = new Float32Array(CELL_COUNT);
  device.queue.writeBuffer(fluxNBuffer, 0, zeros);
  device.queue.writeBuffer(fluxSBuffer, 0, zeros);
  device.queue.writeBuffer(fluxEBuffer, 0, zeros);
  device.queue.writeBuffer(fluxWBuffer, 0, zeros);
}

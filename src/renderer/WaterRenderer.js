import * as THREE from 'three/webgpu';

/**
 * WaterRenderer — Water surface PlaneGeometry with per-vertex displacement
 * and depth-based vertex colours.
 *
 * The water surface sits on top of the terrain. Each vertex's Y position is
 * terrainHeight + waterDepth. Vertices with negligible water depth are hidden
 * by pushing Y far below the terrain.
 *
 * Exports:
 *   create(gridSize)                                — create and return a Three.js Mesh
 *   update(terrainHeightArray, waterDepthArray)      — sync vertices and colours each frame
 *
 * Requirements: 18.2, 18.3
 */

const BASIN_SIZE = 16; // world units

// Water depth threshold — below this, vertex is hidden
const DEPTH_THRESHOLD = 0.001;

// Depth at which colour is fully "deep"
const DEEP_DEPTH = 1.0;

// Shallow colour (light blue)
const SHALLOW_R = 0.4, SHALLOW_G = 0.7, SHALLOW_B = 0.9;
// Deep colour (dark blue)
const DEEP_R = 0.1, DEEP_G = 0.3, DEEP_B = 0.6;

let mesh = null;
let geometry = null;
let colorAttr = null;
let positionAttr = null;
let gridSize = 0;

/**
 * Create the water surface mesh.
 * @param {number} size — grid resolution (e.g. 128 or 512)
 * @returns {THREE.Mesh}
 */
export function create(size) {
  gridSize = size;
  const segments = size - 1;

  geometry = new THREE.PlaneGeometry(BASIN_SIZE, BASIN_SIZE, segments, segments);

  // Rotate from XY to XZ (lie flat, same as terrain)
  geometry.rotateX(-Math.PI / 2);

  // Initialise vertex colours (all shallow blue by default)
  const vertexCount = size * size;
  const colors = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount; i++) {
    colors[i * 3] = SHALLOW_R;
    colors[i * 3 + 1] = SHALLOW_G;
    colors[i * 3 + 2] = SHALLOW_B;
  }

  colorAttr = new THREE.BufferAttribute(colors, 3);
  geometry.setAttribute('color', colorAttr);

  positionAttr = geometry.getAttribute('position');

  // Start all vertices hidden below terrain
  for (let i = 0; i < vertexCount; i++) {
    positionAttr.setY(i, -100);
  }

  const material = new THREE.MeshPhysicalMaterial({
    color: 0x2288cc,
    vertexColors: true,
    transmission: 0.6,
    roughness: 0.05,
    metalness: 0.0,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
    thickness: 0.5,
    ior: 1.33,
  });

  mesh = new THREE.Mesh(geometry, material);
  return mesh;
}

/**
 * Update water surface vertex heights and colours from simulation data.
 *
 * For each vertex:
 *   - If waterDepth > DEPTH_THRESHOLD: Y = terrainHeight + waterDepth
 *   - Otherwise: Y = -100 (hidden below terrain)
 *
 * Vertex colours lerp from shallow (light blue) to deep (dark blue) based
 * on water depth.
 *
 * @param {Float32Array} terrainHeightArray — gridSize×gridSize terrain heights
 * @param {Float32Array} waterDepthArray    — gridSize×gridSize water depths
 */
export function update(terrainHeightArray, waterDepthArray) {
  if (!mesh || !positionAttr || !colorAttr) return;

  const count = gridSize * gridSize;

  for (let i = 0; i < count; i++) {
    const depth = waterDepthArray[i];

    if (depth > DEPTH_THRESHOLD) {
      // Place water surface at terrain + water depth
      positionAttr.setY(i, terrainHeightArray[i] + depth);

      // Depth-based colour: lerp shallow → deep
      const t = Math.min(depth / DEEP_DEPTH, 1.0);
      colorAttr.setXYZ(
        i,
        SHALLOW_R + (DEEP_R - SHALLOW_R) * t,
        SHALLOW_G + (DEEP_G - SHALLOW_G) * t,
        SHALLOW_B + (DEEP_B - SHALLOW_B) * t,
      );
    } else {
      // Hide vertex below terrain
      positionAttr.setY(i, -100);
    }
  }

  positionAttr.needsUpdate = true;
  colorAttr.needsUpdate = true;
  geometry.computeVertexNormals();
}

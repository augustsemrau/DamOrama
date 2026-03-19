import * as THREE from 'three/webgpu';

/**
 * TerrainMesh — Terrain PlaneGeometry with vertex displacement and vertex colours.
 *
 * The basin is 16×16 world units. The terrain mesh is a PlaneGeometry whose
 * vertices are displaced vertically based on terrain height data from the
 * UnifiedGrid. Vertex colours transition between warm earth tones (dry) and
 * dark olive-charcoal (wet) based on water depth.
 *
 * Exports:
 *   create(gridSize)                          — create and return a Three.js Mesh
 *   update(terrainHeightArray, waterDepthArray) — sync vertices and colours each frame
 *
 * Requirements: 2.2, 2.3, 18.1
 */

const BASIN_SIZE = 16; // world units

// Colour constants
const DRY_R = 0.76, DRY_G = 0.60, DRY_B = 0.42;
const WET_R = 0.25, WET_G = 0.28, WET_B = 0.22;

// Water depth threshold for full wet colour transition
const WET_DEPTH_MAX = 0.5;

let mesh = null;
let geometry = null;
let colorAttr = null;
let positionAttr = null;
let gridSize = 0;

/**
 * Create the terrain mesh.
 * @param {number} size — grid resolution (e.g. 128 or 512)
 * @returns {THREE.Mesh}
 */
export function create(size) {
  gridSize = size;
  const segments = size - 1;

  geometry = new THREE.PlaneGeometry(BASIN_SIZE, BASIN_SIZE, segments, segments);

  // Rotate from XY to XZ (lie flat)
  geometry.rotateX(-Math.PI / 2);

  // Initialise vertex colours (all dry by default)
  const vertexCount = size * size;
  const colors = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount; i++) {
    colors[i * 3] = DRY_R;
    colors[i * 3 + 1] = DRY_G;
    colors[i * 3 + 2] = DRY_B;
  }

  colorAttr = new THREE.BufferAttribute(colors, 3);
  geometry.setAttribute('color', colorAttr);

  positionAttr = geometry.getAttribute('position');

  // Material with vertex colours
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.0,
    flatShading: true,
  });

  mesh = new THREE.Mesh(geometry, material);
  return mesh;
}

/**
 * Update terrain vertex heights and colours from simulation data.
 *
 * PlaneGeometry after rotateX(-π/2) has vertices in XZ plane.
 * The position attribute Y component is the height axis.
 * Vertices are in row-major order matching the grid layout.
 *
 * @param {Float32Array} terrainHeightArray — gridSize×gridSize terrain heights
 * @param {Float32Array} waterDepthArray — gridSize×gridSize water depths
 */
export function update(terrainHeightArray, waterDepthArray) {
  if (!mesh || !positionAttr || !colorAttr) return;

  const count = gridSize * gridSize;

  for (let i = 0; i < count; i++) {
    // Update vertex Y (height) from terrain data
    positionAttr.setY(i, terrainHeightArray[i]);

    // Compute wet blend factor: 0 = fully dry, 1 = fully wet
    const depth = waterDepthArray[i];
    const t = Math.min(depth / WET_DEPTH_MAX, 1.0);

    // Lerp between dry and wet colours
    colorAttr.setXYZ(
      i,
      DRY_R + (WET_R - DRY_R) * t,
      DRY_G + (WET_G - DRY_G) * t,
      DRY_B + (WET_B - DRY_B) * t,
    );
  }

  // Mark attributes for GPU upload
  positionAttr.needsUpdate = true;
  colorAttr.needsUpdate = true;
  geometry.computeVertexNormals();
}

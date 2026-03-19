// water-render.wgsl — Water surface vertex/fragment shader for Dam-Orama
//
// Renders the water surface by displacing a PlaneGeometry from terrain height
// and water depth storage buffers. Fragment shader applies depth-based blue
// colouring with semi-transparency.
//
// This is a supplementary WGSL shader for future use with a custom
// ShaderMaterial. The current WaterRenderer.js uses Three.js
// MeshPhysicalMaterial with vertex colours.
//
// Requirements: 18.2, 18.3

// ─── Uniforms ───────────────────────────────────────────────────────────────

struct Uniforms {
  viewProjection: mat4x4<f32>,
  gridSize:       u32,
  cellSize:       f32,
  basinSize:      f32,
  _pad:           f32,
};

@group(0) @binding(0) var<uniform>       uniforms:      Uniforms;
@group(0) @binding(1) var<storage, read> terrainHeight:  array<f32>;
@group(0) @binding(2) var<storage, read> waterDepth:     array<f32>;

// ─── Vertex I/O ─────────────────────────────────────────────────────────────

struct VertexInput {
  @builtin(vertex_index) vertexIndex: u32,
  @location(0)           position:    vec3<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0)       depth:    f32,
};

// ─── Constants ──────────────────────────────────────────────────────────────

const DEPTH_THRESHOLD: f32 = 0.001;
const HIDE_Y:          f32 = -100.0;

// ─── Vertex Shader ──────────────────────────────────────────────────────────
//
// Maps the vertex index to a grid cell (x, y), reads terrain height and water
// depth from storage buffers, and displaces the vertex Y position.
// Vertices with negligible water depth are pushed far below the basin to hide
// them from rendering.

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  let gs = uniforms.gridSize;

  // Map vertex index to grid coordinates (row-major)
  let cellX = input.vertexIndex % gs;
  let cellY = input.vertexIndex / gs;
  let cellIndex = cellY * gs + cellX;

  let terrain = terrainHeight[cellIndex];
  let water   = waterDepth[cellIndex];

  // Displace Y: terrain + water, or hide if depth is negligible
  var worldPos = input.position;
  if (water < DEPTH_THRESHOLD) {
    worldPos.y = HIDE_Y;
  } else {
    worldPos.y = terrain + water;
  }

  var output: VertexOutput;
  output.position = uniforms.viewProjection * vec4<f32>(worldPos, 1.0);
  output.depth    = water;
  return output;
}

// ─── Fragment Shader ────────────────────────────────────────────────────────
//
// Computes depth-based colour by lerping between shallow (light blue) and
// deep (dark blue). Alpha is fixed at 0.8 for semi-transparency.

const SHALLOW_COLOR: vec3<f32> = vec3<f32>(0.4, 0.7, 0.9);
const DEEP_COLOR:    vec3<f32> = vec3<f32>(0.1, 0.3, 0.6);
const DEEP_DEPTH:    f32       = 1.0;
const WATER_ALPHA:   f32       = 0.8;

@fragment
fn fragmentMain(@location(0) depth: f32) -> @location(0) vec4<f32> {
  // Lerp factor: 0 at surface, 1 at DEEP_DEPTH or beyond
  let t = clamp(depth / DEEP_DEPTH, 0.0, 1.0);

  let color = mix(SHALLOW_COLOR, DEEP_COLOR, t);

  return vec4<f32>(color, WATER_ALPHA);
}

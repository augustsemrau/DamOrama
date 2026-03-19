/**
 * ParticleSystem — cosmetic particle effects for Dam-Orama.
 *
 * Three emitter types:
 *   splash: blue-white particles at high water velocity cells
 *   spray:  fine droplet particles at water source positions
 *   debris: brown/grey particles at rigid body collapse positions
 *
 * Uses Three.js Points geometry with BufferGeometry and a billboard
 * ShaderMaterial (vertex shader sizes particles, fragment shader draws
 * soft circles).
 *
 * Purely cosmetic — no physics feedback.
 *
 * Requirements: 19.1, 19.2, 19.3, 19.4, 19.5
 */

import {
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  ShaderMaterial,
  AdditiveBlending,
  Color,
} from 'three/webgpu';

// ── Pool configuration ──────────────────────────────────────────────
const MAX_PARTICLES = 2048;

// ── Per-particle data (SoA layout) ──────────────────────────────────
const positions  = new Float32Array(MAX_PARTICLES * 3);
const velocities = new Float32Array(MAX_PARTICLES * 3);
const colors     = new Float32Array(MAX_PARTICLES * 4); // RGBA
const sizes      = new Float32Array(MAX_PARTICLES);
const lives      = new Float32Array(MAX_PARTICLES);
const maxLives   = new Float32Array(MAX_PARTICLES);

let aliveCount = 0;

// ── Three.js objects ────────────────────────────────────────────────
let geometry   = null;
let material   = null;
let pointsMesh = null;

// ── Shader source ───────────────────────────────────────────────────
const vertexShader = /* glsl */ `
  attribute float size;
  attribute vec4 particleColor;
  attribute float life;
  attribute float maxLife;
  varying vec4 vColor;
  varying float vLifeFrac;
  void main() {
    vColor = particleColor;
    vLifeFrac = clamp(life / max(maxLife, 0.001), 0.0, 1.0);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec4 vColor;
  varying float vLifeFrac;
  void main() {
    // Soft circle
    vec2 uv = gl_PointCoord - vec2(0.5);
    float dist = length(uv);
    if (dist > 0.5) discard;
    float alpha = smoothstep(0.5, 0.2, dist) * vColor.a * vLifeFrac;
    gl_FragColor = vec4(vColor.rgb, alpha);
  }
`;

// ── Emitter colour presets ──────────────────────────────────────────
const SPLASH_COLOR = { r: 0.7, g: 0.85, b: 1.0, a: 0.9 };
const SPRAY_COLOR  = { r: 0.5, g: 0.7, b: 0.95, a: 0.7 };
const DEBRIS_COLOR_A = { r: 0.55, g: 0.4, b: 0.25, a: 0.85 }; // brown
const DEBRIS_COLOR_B = { r: 0.5, g: 0.5, b: 0.5, a: 0.85 };   // grey

// ── Helpers ─────────────────────────────────────────────────────────

function rand(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Allocate a particle slot. Returns index or -1 if pool is full.
 */
function allocate() {
  if (aliveCount >= MAX_PARTICLES) return -1;
  return aliveCount++;
}

/**
 * Set particle data at index.
 */
function setParticle(i, px, py, pz, vx, vy, vz, r, g, b, a, sz, life_) {
  const i3 = i * 3;
  const i4 = i * 4;
  positions[i3]     = px;
  positions[i3 + 1] = py;
  positions[i3 + 2] = pz;
  velocities[i3]     = vx;
  velocities[i3 + 1] = vy;
  velocities[i3 + 2] = vz;
  colors[i4]     = r;
  colors[i4 + 1] = g;
  colors[i4 + 2] = b;
  colors[i4 + 3] = a;
  sizes[i] = sz;
  lives[i] = life_;
  maxLives[i] = life_;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Initialise the particle system and add the Points mesh to the scene.
 * @param {THREE.Scene} scene
 */
export function init(scene) {
  aliveCount = 0;

  // Zero out all buffers
  positions.fill(0);
  velocities.fill(0);
  colors.fill(0);
  sizes.fill(0);
  lives.fill(0);
  maxLives.fill(0);

  geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('particleColor', new Float32BufferAttribute(colors, 4));
  geometry.setAttribute('size', new Float32BufferAttribute(sizes, 1));
  geometry.setAttribute('life', new Float32BufferAttribute(lives, 1));
  geometry.setAttribute('maxLife', new Float32BufferAttribute(maxLives, 1));

  // Draw range limits rendering to alive particles only
  geometry.setDrawRange(0, 0);

  material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  pointsMesh = new Points(geometry, material);
  pointsMesh.frustumCulled = false; // particles can be anywhere
  scene.add(pointsMesh);
}

/**
 * Advance all particles by dt. Dead particles are recycled via swap-remove.
 * @param {number} dt — seconds
 */
export function update(dt) {
  let i = 0;
  while (i < aliveCount) {
    lives[i] -= dt;
    if (lives[i] <= 0) {
      // Swap with last alive particle and shrink pool
      aliveCount--;
      if (i < aliveCount) {
        const src = aliveCount;
        const i3 = i * 3, s3 = src * 3;
        const i4 = i * 4, s4 = src * 4;
        positions[i3] = positions[s3];
        positions[i3 + 1] = positions[s3 + 1];
        positions[i3 + 2] = positions[s3 + 2];
        velocities[i3] = velocities[s3];
        velocities[i3 + 1] = velocities[s3 + 1];
        velocities[i3 + 2] = velocities[s3 + 2];
        colors[i4] = colors[s4];
        colors[i4 + 1] = colors[s4 + 1];
        colors[i4 + 2] = colors[s4 + 2];
        colors[i4 + 3] = colors[s4 + 3];
        sizes[i] = sizes[src];
        lives[i] = lives[src];
        maxLives[i] = maxLives[src];
      }
      continue; // re-check same index (now holds swapped particle)
    }

    // Integrate position
    const i3 = i * 3;
    positions[i3]     += velocities[i3]     * dt;
    positions[i3 + 1] += velocities[i3 + 1] * dt;
    positions[i3 + 2] += velocities[i3 + 2] * dt;

    // Gravity on Y
    velocities[i3 + 1] -= 2.0 * dt;

    i++;
  }

  // Sync GPU buffers
  if (geometry) {
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.particleColor.needsUpdate = true;
    geometry.attributes.size.needsUpdate = true;
    geometry.attributes.life.needsUpdate = true;
    geometry.attributes.maxLife.needsUpdate = true;
    geometry.setDrawRange(0, aliveCount);
  }
}

/**
 * Emit splash particles at a position (high water velocity).
 * @param {{ x: number, y: number, z: number }} position — world position
 * @param {number} intensity — 0..1 controls count and size
 */
export function emitSplash(position, intensity = 0.5) {
  const count = Math.floor(3 + intensity * 8);
  for (let n = 0; n < count; n++) {
    const idx = allocate();
    if (idx === -1) break;
    setParticle(
      idx,
      position.x + rand(-0.1, 0.1),
      position.y + rand(0, 0.05),
      position.z + rand(-0.1, 0.1),
      rand(-0.3, 0.3),
      rand(0.5, 1.5) * intensity,
      rand(-0.3, 0.3),
      SPLASH_COLOR.r, SPLASH_COLOR.g, SPLASH_COLOR.b, SPLASH_COLOR.a,
      rand(0.08, 0.18),
      rand(0.4, 0.9),
    );
  }
}

/**
 * Emit spray particles at a water source position.
 * @param {{ x: number, y: number, z: number }} position — world position
 */
export function emitSpray(position) {
  const count = 2;
  for (let n = 0; n < count; n++) {
    const idx = allocate();
    if (idx === -1) break;
    setParticle(
      idx,
      position.x + rand(-0.05, 0.05),
      position.y + rand(0, 0.02),
      position.z + rand(-0.05, 0.05),
      rand(-0.15, 0.15),
      rand(0.2, 0.6),
      rand(-0.15, 0.15),
      SPRAY_COLOR.r, SPRAY_COLOR.g, SPRAY_COLOR.b, SPRAY_COLOR.a,
      rand(0.03, 0.08),
      rand(0.3, 0.6),
    );
  }
}

/**
 * Emit debris particles at a rigid body collapse position.
 * @param {{ x: number, y: number, z: number }} position — world position
 */
export function emitDebris(position) {
  const count = 12;
  for (let n = 0; n < count; n++) {
    const idx = allocate();
    if (idx === -1) break;
    // Alternate brown and grey
    const c = n % 2 === 0 ? DEBRIS_COLOR_A : DEBRIS_COLOR_B;
    setParticle(
      idx,
      position.x + rand(-0.2, 0.2),
      position.y + rand(0, 0.1),
      position.z + rand(-0.2, 0.2),
      rand(-0.8, 0.8),
      rand(0.5, 2.0),
      rand(-0.8, 0.8),
      c.r, c.g, c.b, c.a,
      rand(0.1, 0.25),
      rand(0.6, 1.2),
    );
  }
}

/**
 * Remove the Points mesh from the scene and dispose GPU resources.
 */
export function destroy() {
  if (pointsMesh && pointsMesh.parent) {
    pointsMesh.parent.remove(pointsMesh);
  }
  if (geometry) geometry.dispose();
  if (material) material.dispose();
  geometry = null;
  material = null;
  pointsMesh = null;
  aliveCount = 0;
}

// ── Test-only accessors ─────────────────────────────────────────────
export function _getAliveCount() { return aliveCount; }
export function _getPositions() { return positions; }
export function _getVelocities() { return velocities; }
export function _getColors() { return colors; }
export function _getSizes() { return sizes; }
export function _getLives() { return lives; }
export function _getMaxLives() { return maxLives; }
export function _getPointsMesh() { return pointsMesh; }

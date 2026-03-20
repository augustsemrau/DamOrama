import * as THREE from 'three';

const MAX_PARTICLES = 200;
const GRAVITY = -9.81;
const SPAWN_HEIGHT = 1.8;  // drop from above
const PARTICLE_SIZE = 0.04;

/**
 * Simple particle system for water source splash effect.
 * Particles fall from above the source position, hit the terrain, and fade.
 */
export class WaterParticles {
  constructor(scene) {
    this._scene = scene;
    this._active = false;
    this._sourcePos = null;
    this._sourceRadius = 0;
    this._time = 0;

    // Particle state arrays
    this._positions = new Float32Array(MAX_PARTICLES * 3);
    this._velocities = new Float32Array(MAX_PARTICLES * 3);
    this._ages = new Float32Array(MAX_PARTICLES);
    this._lifetimes = new Float32Array(MAX_PARTICLES);
    this._alive = new Uint8Array(MAX_PARTICLES);

    // Three.js points
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this._positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x66bbee,
      size: PARTICLE_SIZE,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending
    });

    this._points = new THREE.Points(geo, mat);
    this._points.frustumCulled = false;
    scene.add(this._points);
  }

  /**
   * Start emitting particles from a source.
   * @param {object} source — { position: {x,y}, radius } in grid coords
   * @param {number} cellSize
   * @param {number} baseY — terrain height at source
   */
  start(source, cellSize, baseY) {
    this._active = true;
    this._sourcePos = {
      x: source.position.x * cellSize,
      y: baseY,
      z: source.position.y * cellSize
    };
    this._sourceRadius = source.radius * cellSize;
    this._baseY = baseY;

    // Reset all particles
    this._alive.fill(0);
    this._ages.fill(0);
  }

  stop() {
    this._active = false;
  }

  update(dt) {
    if (!this._active && !this._hasAlive()) {
      return;
    }

    this._time += dt;
    const pos = this._positions;
    const vel = this._velocities;
    const ages = this._ages;
    const lifetimes = this._lifetimes;
    const alive = this._alive;
    const src = this._sourcePos;

    // Spawn new particles
    if (this._active) {
      const spawnRate = 60; // particles per second
      const toSpawn = Math.min(Math.floor(spawnRate * dt + Math.random()), 5);
      for (let s = 0; s < toSpawn; s++) {
        const slot = this._findDeadSlot();
        if (slot === -1) break;

        // Random position within source radius
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * this._sourceRadius;
        const i3 = slot * 3;

        pos[i3] = src.x + Math.cos(angle) * r;
        pos[i3 + 1] = src.y + SPAWN_HEIGHT + Math.random() * 0.3;
        pos[i3 + 2] = src.z + Math.sin(angle) * r;

        // Slight horizontal spread + downward velocity
        vel[i3] = (Math.random() - 0.5) * 0.3;
        vel[i3 + 1] = -Math.random() * 1.0 - 0.5;
        vel[i3 + 2] = (Math.random() - 0.5) * 0.3;

        ages[slot] = 0;
        lifetimes[slot] = 0.6 + Math.random() * 0.6;
        alive[slot] = 1;
      }
    }

    // Update existing particles
    for (let p = 0; p < MAX_PARTICLES; p++) {
      if (!alive[p]) continue;

      ages[p] += dt;
      if (ages[p] >= lifetimes[p]) {
        alive[p] = 0;
        // Move off-screen
        pos[p * 3 + 1] = -100;
        continue;
      }

      const i3 = p * 3;

      // Apply gravity
      vel[i3 + 1] += GRAVITY * dt;

      // Update position
      pos[i3] += vel[i3] * dt;
      pos[i3 + 1] += vel[i3 + 1] * dt;
      pos[i3 + 2] += vel[i3 + 2] * dt;

      // Bounce off terrain (approximate)
      if (pos[i3 + 1] < this._baseY + 0.02) {
        pos[i3 + 1] = this._baseY + 0.02;
        vel[i3 + 1] *= -0.2; // damped bounce
        vel[i3] *= 0.5;
        vel[i3 + 2] *= 0.5;
      }
    }

    this._points.geometry.attributes.position.needsUpdate = true;
  }

  _findDeadSlot() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (!this._alive[i]) return i;
    }
    return -1;
  }

  _hasAlive() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this._alive[i]) return true;
    }
    return false;
  }
}

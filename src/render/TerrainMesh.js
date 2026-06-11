import * as THREE from 'three';
import { WORLD_SIZE, CELL, MAT_SAND, MAT_CLAY, MAT_STONE } from '../core/Constants.js';
import { COLORS } from './SceneBuilder.js';

const cEarthLow = new THREE.Color(COLORS.earthLow);
const cEarthHigh = new THREE.Color(COLORS.earthHigh);
const cSand = new THREE.Color(COLORS.sand);
const cClay = new THREE.Color(COLORS.clay);
const cStone = new THREE.Color(COLORS.stone);
const cTmp = new THREE.Color();

// Event-driven heightfield mesh: re-uploads only on terrain-changed events,
// never per frame (spec §10.4).
export class TerrainMesh {
  constructor(grid, bus, scene) {
    this.grid = grid;
    const n = grid.cellCount;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const i = grid.index(x, y);
        pos[i * 3] = -WORLD_SIZE / 2 + (x + 0.5) * CELL;
        pos[i * 3 + 2] = -WORLD_SIZE / 2 + (y + 0.5) * CELL;
      }
    }
    const idx = [];
    for (let y = 0; y < grid.height - 1; y++) {
      for (let x = 0; x < grid.width - 1; x++) {
        const a = y * grid.width + x, b = a + 1, c = a + grid.width, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    this.geometry = geo;
    this.mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    scene.add(this.mesh);

    this.wetMax = new Float32Array(n); // persistent wet-darkening memory
    this.update();
    bus.on('terrain-changed', () => this.update());
    bus.on('phase-changed', ({ phase }) => {
      if (phase === 'flood') this.wetMax.fill(0);
      this.update();
    });
  }

  update() {
    const { grid } = this;
    const pos = this.geometry.attributes.position.array;
    const col = this.geometry.attributes.color.array;
    for (let i = 0; i < grid.cellCount; i++) {
      const h = grid.terrainHeight[i] + grid.materialHeight[i];
      pos[i * 3 + 1] = h;

      const mat = grid.materialId[i];
      if (mat === MAT_STONE) {
        cTmp.copy(cStone);
      } else if (mat === MAT_SAND && grid.materialHeight[i] > 0.01) {
        cTmp.copy(cSand);
      } else if (mat === MAT_CLAY && grid.materialHeight[i] > 0.01) {
        cTmp.copy(cClay);
      } else {
        const t = Math.min(1, Math.max(0, (grid.terrainHeight[i] + 0.25) / 1.0));
        cTmp.lerpColors(cEarthLow, cEarthHigh, t);
      }
      const wet = Math.min(1, this.wetMax[i] * 18);
      if (wet > 0) cTmp.multiplyScalar(1 - 0.35 * wet);
      col[i * 3] = cTmp.r;
      col[i * 3 + 1] = cTmp.g;
      col[i * 3 + 2] = cTmp.b;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }

  // Cheap wet-memory tick during flood; recolors at the caller's cadence.
  absorbWetness() {
    const { grid, wetMax } = this;
    for (let i = 0; i < grid.cellCount; i++) {
      const d = grid.waterDepth[i];
      if (d > wetMax[i]) wetMax[i] = d;
    }
  }
}

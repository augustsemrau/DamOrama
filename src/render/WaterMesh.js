import * as THREE from 'three';
import { WORLD_SIZE, CELL } from '../core/Constants.js';
import { COLORS } from './SceneBuilder.js';

const cShallow = new THREE.Color(COLORS.waterShallow);
const cDeep = new THREE.Color(COLORS.waterDeep);
const cFoam = new THREE.Color(0xe8f4f8);
const cTmp = new THREE.Color();

const VISIBLE_DEPTH = 0.004; // hide the racing millimetre film

// Frame-driven during flood only (spec §10.4).
export class WaterMesh {
  constructor(grid, sim, scene) {
    this.grid = grid;
    this.sim = sim;
    const n = grid.cellCount;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const i = grid.index(x, y);
        pos[i * 3] = -WORLD_SIZE / 2 + (x + 0.5) * CELL;
        pos[i * 3 + 1] = -1;
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
    this.mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      shininess: 90,
      specular: new THREE.Color(0x99ccdd),
      depthWrite: false,
    }));
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  update() {
    const { grid, sim } = this;
    const pos = this.geometry.attributes.position.array;
    const col = this.geometry.attributes.color.array;
    for (let i = 0; i < grid.cellCount; i++) {
      const d = grid.waterDepth[i];
      if (d > VISIBLE_DEPTH) {
        pos[i * 3 + 1] = grid.terrainHeight[i] + grid.materialHeight[i] + d;
        const t = Math.min(1, d / 0.22);
        cTmp.lerpColors(cShallow, cDeep, t);
        // White-water tint where the flow runs fast.
        const foam = Math.min(1, Math.max(0, (sim.speed[i] - 0.7) / 2.5));
        if (foam > 0) cTmp.lerp(cFoam, foam * 0.6);
        col[i * 3] = cTmp.r;
        col[i * 3 + 1] = cTmp.g;
        col[i * 3 + 2] = cTmp.b;
      } else {
        // Tuck dry vertices under the terrain so edges form a waterline.
        pos[i * 3 + 1] = grid.terrainHeight[i] + grid.materialHeight[i] - 0.045;
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  setVisible(v) {
    this.mesh.visible = v;
  }
}

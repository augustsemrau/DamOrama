import * as THREE from 'three';
import { HOUSE_BIT } from '../core/Constants.js';

const DRY_COLOR = 0xe8a547;    // warm, saturated
const FLOODED_COLOR = 0x666666; // desaturated gray

export class HouseVisuals {
  /**
   * @param {THREE.Scene} scene
   * @param {Grid} grid
   * @param {number} cellSize
   * @param {Array} housesConfig — from level JSON
   * @param {EventBus} eventBus
   */
  constructor(scene, grid, cellSize, housesConfig, eventBus) {
    this._houses = [];

    for (const hc of housesConfig) {
      const worldX = (hc.position.x + hc.footprint.w / 2) * cellSize;
      const worldZ = (hc.position.y + hc.footprint.h / 2) * cellSize;
      const worldW = hc.footprint.w * cellSize;
      const worldH = hc.footprint.h * cellSize;
      const height = 0.3;

      // Get terrain height at house center for Y position
      const centerI = grid.index(
        Math.min(hc.position.x + Math.floor(hc.footprint.w / 2), grid.width - 1),
        Math.min(hc.position.y + Math.floor(hc.footprint.h / 2), grid.height - 1)
      );
      const baseY = grid.terrainHeight[centerI];

      const geo = new THREE.BoxGeometry(worldW, height, worldH);
      const mat = new THREE.MeshStandardMaterial({ color: DRY_COLOR });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(worldX, baseY + height / 2, worldZ);
      scene.add(mesh);

      // Mark footprint cells in grid
      for (let dy = 0; dy < hc.footprint.h; dy++) {
        for (let dx = 0; dx < hc.footprint.w; dx++) {
          const gx = hc.position.x + dx;
          const gy = hc.position.y + dy;
          if (grid.inBounds(gx, gy)) {
            grid.occupancy[grid.index(gx, gy)] |= HOUSE_BIT;
          }
        }
      }

      this._houses.push({ id: hc.id, mesh, mat, config: hc, flooded: false });
    }

    // Listen for flood state changes
    eventBus.on('house-flooded', (data) => {
      const house = this._houses.find(h => h.id === data.houseId);
      if (house && !house.flooded) {
        house.flooded = true;
        house.mat.color.setHex(FLOODED_COLOR);
      }
    });

    eventBus.on('phase-changed', (data) => {
      if (data.phase === 'construction') {
        // Reset all houses to dry
        for (const h of this._houses) {
          h.flooded = false;
          h.mat.color.setHex(DRY_COLOR);
        }
      }
    });
  }

  get houses() {
    return this._houses;
  }
}

import * as THREE from 'three';
import { HOUSE_BIT } from '../core/Constants.js';

const DRY_WALL = 0xf5e6c8;    // warm cream walls
const DRY_ROOF = 0xc0392b;    // red roof
const FLOODED_WALL = 0x777777;
const FLOODED_ROOF = 0x555555;

export class HouseVisuals {
  constructor(scene, grid, cellSize, housesConfig, eventBus) {
    this._houses = [];

    for (const hc of housesConfig) {
      const worldX = (hc.position.x + hc.footprint.w / 2) * cellSize;
      const worldZ = (hc.position.y + hc.footprint.h / 2) * cellSize;
      const worldW = hc.footprint.w * cellSize;
      const worldH = hc.footprint.h * cellSize;
      const wallHeight = 0.25;
      const roofHeight = 0.15;

      const centerI = grid.index(
        Math.min(hc.position.x + Math.floor(hc.footprint.w / 2), grid.width - 1),
        Math.min(hc.position.y + Math.floor(hc.footprint.h / 2), grid.height - 1)
      );
      const baseY = grid.terrainHeight[centerI];

      // House group
      const group = new THREE.Group();
      group.position.set(worldX, baseY, worldZ);

      // Walls
      const wallGeo = new THREE.BoxGeometry(worldW, wallHeight, worldH);
      const wallMat = new THREE.MeshStandardMaterial({ color: DRY_WALL });
      const walls = new THREE.Mesh(wallGeo, wallMat);
      walls.position.y = wallHeight / 2;
      group.add(walls);

      // Roof (pyramid-like using a cone)
      const roofSize = Math.max(worldW, worldH) * 1.15;
      const roofGeo = new THREE.ConeGeometry(roofSize * 0.7, roofHeight, 4);
      const roofMat = new THREE.MeshStandardMaterial({ color: DRY_ROOF });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.y = wallHeight + roofHeight / 2;
      roof.rotation.y = Math.PI / 4;
      group.add(roof);

      scene.add(group);

      // Mark footprint cells
      for (let dy = 0; dy < hc.footprint.h; dy++) {
        for (let dx = 0; dx < hc.footprint.w; dx++) {
          const gx = hc.position.x + dx;
          const gy = hc.position.y + dy;
          if (grid.inBounds(gx, gy)) {
            grid.occupancy[grid.index(gx, gy)] |= HOUSE_BIT;
          }
        }
      }

      this._houses.push({
        id: hc.id, group, wallMat, roofMat,
        config: hc, flooded: false
      });
    }

    eventBus.on('house-flooded', (data) => {
      const house = this._houses.find(h => h.id === data.houseId);
      if (house && !house.flooded) {
        house.flooded = true;
        house.wallMat.color.setHex(FLOODED_WALL);
        house.roofMat.color.setHex(FLOODED_ROOF);
      }
    });

    eventBus.on('phase-changed', (data) => {
      if (data.phase === 'construction') {
        for (const h of this._houses) {
          h.flooded = false;
          h.wallMat.color.setHex(DRY_WALL);
          h.roofMat.color.setHex(DRY_ROOF);
        }
      }
    });
  }

  get houses() {
    return this._houses;
  }
}

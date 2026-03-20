import * as THREE from 'three';

const WATER_THRESHOLD = 0.002;

export class WaterMesh {
  constructor(grid, cellSize) {
    this.grid = grid;
    this.cellSize = cellSize;
    this._width = grid.width;
    this._height = grid.height;

    const worldW = grid.width * cellSize;
    const worldH = grid.height * cellSize;

    this.geometry = new THREE.PlaneGeometry(
      worldW, worldH,
      grid.width - 1, grid.height - 1
    );
    this.geometry.rotateX(-Math.PI / 2);

    // Static up normals
    const normals = this.geometry.attributes.normal;
    for (let i = 0; i < normals.count; i++) {
      normals.setXYZ(i, 0, 1, 0);
    }
    normals.needsUpdate = true;

    this.material = new THREE.MeshPhysicalMaterial({
      color: 0x2288dd,
      transparent: true,
      opacity: 0.72,
      roughness: 0.12,
      metalness: 0.15,
      side: THREE.FrontSide,  // only top face — no underside leak
      depthWrite: false
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.set(worldW / 2, 0, worldH / 2);

    // Smoothed water height buffer (avoids per-cell "bar chart" look)
    this._smoothed = new Float32Array(grid.cellCount);
  }

  update() {
    const pos = this.geometry.attributes.position;
    const { grid, _smoothed: smoothed, _width: w, _height: h } = this;
    const { waterDepth, terrainHeight, materialHeight } = grid;

    // Pass 1: compute smoothed water surface with 3x3 neighbor averaging
    // This blurs the sharp per-cell steps into a flowing surface
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (waterDepth[i] <= WATER_THRESHOLD) {
          smoothed[i] = 0;
          continue;
        }

        let sum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            const ni = ny * w + nx;
            if (waterDepth[ni] > WATER_THRESHOLD) {
              sum += terrainHeight[ni] + materialHeight[ni] + waterDepth[ni];
              count++;
            }
          }
        }

        smoothed[i] = count > 0 ? sum / count : 0;
      }
    }

    // Pass 2: write to geometry, hiding dry cells at terrain level (not below basin)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const vi = y * w + x;
        const i = y * w + x;

        if (smoothed[i] > 0) {
          pos.setY(vi, smoothed[i]);
        } else {
          // Hide at terrain surface level — not below the basin
          pos.setY(vi, terrainHeight[i] + materialHeight[i] - 0.01);
        }
      }
    }

    pos.needsUpdate = true;
  }
}

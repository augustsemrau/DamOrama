import * as THREE from 'three';

const WATER_THRESHOLD = 0.001;
const HIDE_Y = -10;

export class WaterMesh {
  constructor(grid, cellSize) {
    this.grid = grid;
    this.cellSize = cellSize;

    const worldW = grid.width * cellSize;
    const worldH = grid.height * cellSize;

    this.geometry = new THREE.PlaneGeometry(
      worldW, worldH,
      grid.width - 1, grid.height - 1
    );
    this.geometry.rotateX(-Math.PI / 2);

    // Set all normals to face up — no per-frame recomputation needed
    const normals = this.geometry.attributes.normal;
    for (let i = 0; i < normals.count; i++) {
      normals.setXYZ(i, 0, 1, 0);
    }
    normals.needsUpdate = true;

    this.material = new THREE.MeshPhysicalMaterial({
      color: 0x3388cc,
      transparent: true,
      opacity: 0.6,
      roughness: 0.1,
      metalness: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.set(worldW / 2, 0, worldH / 2);
  }

  update() {
    const pos = this.geometry.attributes.position;
    const { grid } = this;
    const { width, height } = grid;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const vi = y * width + x;
        const gi = grid.index(x, y);

        if (grid.waterDepth[gi] > WATER_THRESHOLD) {
          pos.setY(vi, grid.getWaterSurfaceHeight(gi));
        } else {
          pos.setY(vi, HIDE_Y);
        }
      }
    }

    pos.needsUpdate = true;
    // Normals are static (0,1,0) — no recomputation needed per frame
  }
}

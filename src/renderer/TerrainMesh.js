import * as THREE from 'three';

export class TerrainMesh {
  constructor(grid, cellSize, eventBus) {
    this.grid = grid;
    this.cellSize = cellSize;

    const worldW = grid.width * cellSize;
    const worldH = grid.height * cellSize;

    this.geometry = new THREE.PlaneGeometry(
      worldW, worldH,
      grid.width - 1, grid.height - 1
    );
    this.geometry.rotateX(-Math.PI / 2);

    const colors = new Float32Array(this.geometry.attributes.position.count * 3);
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.set(worldW / 2, 0, worldH / 2);

    this.updateGeometry();

    eventBus.on('terrain-changed', () => this.updateGeometry());
  }

  updateGeometry() {
    const pos = this.geometry.attributes.position;
    const col = this.geometry.attributes.color;
    const { grid } = this;
    const { width, height } = grid;

    // Find height range for color normalization
    let minH = Infinity, maxH = -Infinity;
    for (let i = 0; i < grid.cellCount; i++) {
      const h = grid.getSurfaceHeight(i);
      if (h < minH) minH = h;
      if (h > maxH) maxH = h;
    }
    const range = maxH - minH || 1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const vi = y * width + x;
        const gi = grid.index(x, y);
        const h = grid.getSurfaceHeight(gi);

        pos.setY(vi, h);

        const t = (h - minH) / range; // 0=valley floor, 1=rim
        const hasMat = grid.materialHeight[gi] > 0;
        const matId = grid.materialId[gi];

        if (hasMat && matId === 1) {
          // Sand: warm golden
          col.setXYZ(vi, 0.82, 0.68, 0.35);
        } else if (hasMat && matId === 2) {
          // Clay: reddish brown
          col.setXYZ(vi, 0.62, 0.42, 0.28);
        } else if (hasMat && matId === 3) {
          // Stone: gray
          col.setXYZ(vi, 0.55, 0.55, 0.52);
        } else {
          // Natural terrain: dark olive valley → warm brown rim
          const r = 0.28 + t * 0.30;
          const g = 0.26 + t * 0.16;
          const b = 0.12 + t * 0.10;
          col.setXYZ(vi, r, g, b);
        }
      }
    }

    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }
}

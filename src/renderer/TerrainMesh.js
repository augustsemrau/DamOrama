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

        // Normalize to 0–1 across actual terrain range
        const t = (h - minH) / range;
        // Low terrain (valley floor): darker green-brown
        // High terrain (rims): lighter sandy brown
        // Player material: slightly lighter to distinguish
        const hasMat = grid.materialHeight[gi] > 0;
        if (hasMat) {
          // Player-placed material: distinct tan/gold
          col.setXYZ(vi, 0.72, 0.60, 0.35);
        } else {
          const r = 0.35 + t * 0.25;
          const g = 0.30 + t * 0.18;
          const b = 0.15 + t * 0.08;
          col.setXYZ(vi, r, g, b);
        }
      }
    }

    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }
}

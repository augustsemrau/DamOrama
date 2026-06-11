import * as THREE from 'three';
import { WORLD_SIZE, CELL } from '../core/Constants.js';
import { COLORS } from './SceneBuilder.js';

function gridToWorld(gx, gy) {
  return [-WORLD_SIZE / 2 + (gx + 0.5) * CELL, -WORLD_SIZE / 2 + (gy + 0.5) * CELL];
}

// The emotional objective: warm, saturated, lit. Each house latches a
// visible flooded state (darkened, lights out).
export class Houses {
  constructor(level, grid, bus, scene) {
    this.items = [];
    for (const h of level.houses) {
      const cx = h.x + h.w / 2 - 0.5, cy = h.y + h.h / 2 - 0.5;
      const [wx, wz] = gridToWorld(cx, cy);
      const ground = grid.terrainHeight[grid.index(Math.round(cx), Math.round(cy))];

      const group = new THREE.Group();
      const wallMat = new THREE.MeshLambertMaterial({ color: COLORS.houseWall });
      const roofMat = new THREE.MeshLambertMaterial({ color: COLORS.houseRoof });
      const winMat = new THREE.MeshBasicMaterial({ color: COLORS.window });

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.42), wallMat);
      body.position.y = 0.15;
      group.add(body);

      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.24, 4), roofMat);
      roof.position.y = 0.42;
      roof.rotation.y = Math.PI / 4;
      group.add(roof);

      const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.07), wallMat);
      chimney.position.set(0.12, 0.5, 0.12);
      group.add(chimney);

      for (const [dx, dz, ry] of [[0, 0.212, 0], [0.212, 0, Math.PI / 2]]) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.12), winMat);
        win.position.set(dx, 0.16, dz);
        win.rotation.y = ry;
        group.add(win);
      }

      group.position.set(wx, ground, wz);
      group.rotation.y = (h.x * 7 + h.y * 13) % 7 * 0.12; // varied, deterministic
      scene.add(group);
      this.items.push({ id: h.id, group, wallMat, roofMat, winMat });
    }

    bus.on('house-flooded', ({ id }) => this.setFlooded(id));
    bus.on('phase-changed', ({ phase }) => {
      if (phase === 'build') this.resetAll();
    });
  }

  setFlooded(id) {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;
    item.wallMat.color.set(0x6b7585);
    item.roofMat.color.set(0x5d4a42);
    item.winMat.color.set(0x33404d);
  }

  resetAll() {
    for (const item of this.items) {
      item.wallMat.color.set(COLORS.houseWall);
      item.roofMat.color.set(COLORS.houseRoof);
      item.winMat.color.set(COLORS.window);
    }
  }
}

// Visual stone blocks synced from the EditTools block list.
export class StoneBlocks {
  constructor(grid, bus, scene) {
    this.grid = grid;
    this.group = new THREE.Group();
    scene.add(this.group);
    bus.on('stones-changed', (stones) => this.sync(stones));
  }

  sync(stones) {
    this.group.clear();
    for (const b of stones) {
      const sizeW = 6 * CELL;
      const cx = b.x + 3 - 0.5, cy = b.y + 3 - 0.5;
      const [wx, wz] = gridToWorld(cx, cy);
      const ground = this.grid.terrainHeight[this.grid.index(Math.round(cx), Math.round(cy))];
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(sizeW * 0.96, 0.45, sizeW * 0.96),
        new THREE.MeshLambertMaterial({ color: COLORS.stone }),
      );
      mesh.position.set(wx, ground + 0.225, wz);
      this.group.add(mesh);
    }
  }
}

// Postmortem breach beacon: a pulsing column at the named spot.
export class Beacon {
  constructor(grid, scene) {
    this.grid = grid;
    const mat = new THREE.MeshBasicMaterial({ color: 0xff5a36, transparent: true, opacity: 0.55 });
    this.column = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.4, 12), mat);
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.03, 10, 32),
      new THREE.MeshBasicMaterial({ color: 0xff5a36 }),
    );
    this.ring.rotation.x = Math.PI / 2;
    this.group = new THREE.Group();
    this.group.add(this.column, this.ring);
    this.group.visible = false;
    scene.add(this.group);
    this._t = 0;
  }

  showAtCell(i) {
    if (i == null || i < 0) { this.hide(); return; }
    const x = i % this.grid.width, y = Math.floor(i / this.grid.width);
    const [wx, wz] = gridToWorld(x, y);
    const h = this.grid.terrainHeight[i] + this.grid.materialHeight[i];
    this.group.position.set(wx, h + 0.1, wz);
    this.group.visible = true;
  }

  hide() {
    this.group.visible = false;
  }

  update(dt) {
    if (!this.group.visible) return;
    this._t += dt;
    const pulse = 1 + 0.18 * Math.sin(this._t * 4);
    this.ring.scale.setScalar(pulse);
    this.column.material.opacity = 0.4 + 0.2 * Math.sin(this._t * 4);
  }
}

// The threat, legible before it exists: a pipe mouth at the source.
export class SourceMarker {
  constructor(level, grid, scene) {
    const s = level.source;
    const [wx, wz] = gridToWorld(s.x, s.y);
    const ground = grid.terrainHeight[grid.index(s.x, s.y)];
    const group = new THREE.Group();

    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.5, 14),
      new THREE.MeshLambertMaterial({ color: 0x46525a }),
    );
    pipe.rotation.z = Math.PI / 2;
    pipe.position.y = 0.16;
    group.add(pipe);

    const mouth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.17, 0.06, 14),
      new THREE.MeshBasicMaterial({ color: 0x16262e }),
    );
    mouth.rotation.z = Math.PI / 2;
    mouth.position.set(0.25, 0.16, 0);
    group.add(mouth);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(s.radius * CELL, 0.02, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0x5e93a8, transparent: true, opacity: 0.7 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.03;
    group.add(ring);

    group.position.set(wx, ground, wz);
    scene.add(group);
  }
}

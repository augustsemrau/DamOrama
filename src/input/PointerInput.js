import * as THREE from 'three';
import { WORLD_SIZE, CELL, STONE_SIZE } from '../core/Constants.js';

// LMB build input: raycast against the flat ground plane (not the terrain
// mesh — stable under your own edits), drive the active tool per frame.
export class PointerInput {
  constructor({ camera, domElement, tools, undo, scene }) {
    this.camera = camera;
    this.dom = domElement;
    this.tools = tools;
    this.undo = undo;
    this.enabled = true;
    this.activeTool = 'sand'; // sand | clay | stone | smooth | remove
    this.brushRadius = 5;     // grid cells

    this._raycaster = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._pointerNdc = new THREE.Vector2();
    this._hit = new THREE.Vector3();
    this._painting = false;
    this.hoverCell = null;

    this._ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1, 40),
      new THREE.MeshBasicMaterial({ color: 0xfff3d0, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    this._ring.rotation.x = -Math.PI / 2;
    this._ring.visible = false;
    scene.add(this._ring);

    domElement.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !this.enabled) return;
      this._updatePointer(e);
      if (this.activeTool === 'stone') {
        const c = this.hoverCell;
        if (!c) return;
        if (this.tools.stoneAt(c.x, c.y)) this.tools.removeStoneAt(c.x, c.y);
        else this.tools.placeStone(c.x, c.y);
      } else {
        this._painting = true;
        this.undo.beginStroke();
      }
    });
    const stop = () => {
      if (this._painting) {
        this._painting = false;
        this.undo.endStroke();
      }
    };
    domElement.addEventListener('pointerup', stop);
    domElement.addEventListener('pointerleave', stop);
    domElement.addEventListener('pointermove', (e) => this._updatePointer(e));
  }

  _updatePointer(e) {
    const rect = this.dom.getBoundingClientRect();
    this._pointerNdc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this._raycaster.setFromCamera(this._pointerNdc, this.camera);
    if (this._raycaster.ray.intersectPlane(this._plane, this._hit)) {
      const gx = (this._hit.x + WORLD_SIZE / 2) / CELL - 0.5;
      const gy = (this._hit.z + WORLD_SIZE / 2) / CELL - 0.5;
      this.hoverCell = { x: gx, y: gy };
    } else {
      this.hoverCell = null;
    }
  }

  // Called once per render frame from the main loop.
  tick(dt, grid) {
    const c = this.hoverCell;
    if (!this.enabled || !c) {
      this._ring.visible = false;
      return;
    }
    // Brush preview ring sits on the terrain.
    const gx = Math.round(Math.min(grid.width - 1, Math.max(0, c.x)));
    const gy = Math.round(Math.min(grid.height - 1, Math.max(0, c.y)));
    const h = grid.terrainHeight[grid.index(gx, gy)] + grid.materialHeight[grid.index(gx, gy)];
    this._ring.position.set(this._hit.x, h + 0.03, this._hit.z);
    const r = this.activeTool === 'stone' ? (STONE_SIZE / 2) * CELL : this.brushRadius * CELL;
    this._ring.scale.setScalar(r);
    this._ring.visible = true;

    if (!this._painting) return;
    if (this.activeTool === 'sand') this.tools.paint(c.x, c.y, this.brushRadius, 1, dt);
    else if (this.activeTool === 'clay') this.tools.paint(c.x, c.y, this.brushRadius, 2, dt);
    else if (this.activeTool === 'smooth') this.tools.smooth(c.x, c.y, this.brushRadius, dt);
    else if (this.activeTool === 'remove') this.tools.remove(c.x, c.y, this.brushRadius, dt);
  }

  setEnabled(v) {
    this.enabled = v;
    if (!v && this._painting) {
      this._painting = false;
      this.undo.endStroke();
    }
    if (!v) this._ring.visible = false;
  }
}

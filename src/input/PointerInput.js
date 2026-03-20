import * as THREE from 'three';

export class PointerInput {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {THREE.PerspectiveCamera} camera
   * @param {Grid} grid
   * @param {number} cellSize
   * @param {EditTools} editTools
   * @param {ResourceBudget} budget
   * @param {UndoSystem} undoSystem
   * @param {EventBus} eventBus
   */
  constructor(canvas, camera, grid, cellSize, editTools, budget, undoSystem, eventBus) {
    this._canvas = canvas;
    this._camera = camera;
    this._grid = grid;
    this._cellSize = cellSize;
    this._tools = editTools;
    this._budget = budget;
    this._undo = undoSystem;

    this._raycaster = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Y=0 horizontal plane
    this._mouse = new THREE.Vector2();
    this._intersection = new THREE.Vector3();

    this._active = true; // disabled during flood/resolution
    this._dragging = false;
    this._currentTool = { mode: 'paint', materialId: 1, brushSize: 2 };
    this._budgetDelta = {};

    // Listen for tool changes
    eventBus.on('tool-changed', (data) => {
      this._currentTool = data;
    });

    // Disable during non-construction phases
    eventBus.on('phase-changed', (d) => {
      this._active = d.phase === 'construction';
      if (!this._active && this._dragging) {
        this._endStroke();
      }
    });

    // Pointer events — LMB only (button 0)
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !this._active) return;
      this._startStroke(e);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!this._dragging || !this._active) return;
      this._continueStroke(e);
    });

    canvas.addEventListener('pointerup', (e) => {
      if (e.button !== 0) return;
      this._endStroke();
    });

    // Undo shortcut
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && this._active) {
        e.preventDefault();
        if (this._undo.undo(this._grid, this._budget)) {
          eventBus.emit('terrain-changed');
        }
      }
    });
  }

  _getGridCoords(e) {
    const rect = this._canvas.getBoundingClientRect();
    this._mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this._raycaster.setFromCamera(this._mouse, this._camera);
    const hit = this._raycaster.ray.intersectPlane(this._plane, this._intersection);
    if (!hit) return null;

    const gx = Math.floor(hit.x / this._cellSize);
    const gy = Math.floor(hit.z / this._cellSize);

    if (!this._grid.inBounds(gx, gy)) return null;
    return { x: gx, y: gy };
  }

  _startStroke(e) {
    this._dragging = true;
    this._budgetDelta = {};
    this._undo.beginStroke();
    this._continueStroke(e);
  }

  _continueStroke(e) {
    const coords = this._getGridCoords(e);
    if (!coords) return;

    const { mode, materialId, brushSize } = this._currentTool;

    switch (mode) {
      case 'paint':
        this._tools.paint(coords.x, coords.y, brushSize, materialId, this._budget, this._undo);
        break;
      case 'smooth':
        this._tools.smooth(coords.x, coords.y, brushSize, this._undo);
        break;
      case 'remove':
        this._tools.remove(coords.x, coords.y, brushSize, this._budget, this._undo);
        break;
    }
  }

  _endStroke() {
    if (!this._dragging) return;
    this._dragging = false;
    this._undo.endStroke(this._budgetDelta);
  }
}

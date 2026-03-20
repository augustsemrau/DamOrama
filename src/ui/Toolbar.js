import { MAT_SAND, MAT_CLAY, MAT_STONE } from '../core/Constants.js';

const TOOLS = [
  { id: 'sand', label: 'Sand', materialId: MAT_SAND, mode: 'paint' },
  { id: 'clay', label: 'Clay', materialId: MAT_CLAY, mode: 'paint' },
  { id: 'stone', label: 'Stone', materialId: MAT_STONE, mode: 'paint' },
  { id: 'smooth', label: 'Smooth', materialId: null, mode: 'smooth' },
  { id: 'remove', label: 'Remove', materialId: null, mode: 'remove' },
];

export class Toolbar {
  constructor(container, eventBus) {
    this._bus = eventBus;
    this._activeTool = TOOLS[0];
    this._brushSize = 4;

    this._el = document.createElement('div');
    this._el.style.cssText =
      'position:absolute;top:8px;left:50%;transform:translateX(-50%);z-index:10;' +
      'display:flex;gap:6px;align-items:center;background:rgba(0,0,0,0.6);' +
      'padding:6px 12px;border-radius:8px;';
    container.appendChild(this._el);

    this._buttons = [];
    for (const tool of TOOLS) {
      const btn = document.createElement('button');
      btn.textContent = tool.label;
      btn.dataset.toolId = tool.id;
      btn.style.cssText =
        'padding:6px 12px;font:13px sans-serif;border:2px solid transparent;' +
        'border-radius:4px;cursor:pointer;background:#444;color:#eee;';
      btn.addEventListener('click', () => this._selectTool(tool));
      this._el.appendChild(btn);
      this._buttons.push({ btn, tool });
    }

    // Brush size label
    const sizeLabel = document.createElement('span');
    sizeLabel.style.cssText = 'color:#ccc;font:12px sans-serif;margin-left:8px;';
    sizeLabel.textContent = `Brush: ${this._brushSize}`;
    this._el.appendChild(sizeLabel);
    this._sizeLabel = sizeLabel;

    // Keyboard shortcuts for brush size
    window.addEventListener('keydown', (e) => {
      if (e.key === '[') this._setBrushSize(this._brushSize - 1);
      if (e.key === ']') this._setBrushSize(this._brushSize + 1);
    });

    this._updateHighlight();
    this._emitChange();

    // Hide during non-construction phases
    eventBus.on('phase-changed', (d) => {
      this._el.style.display = d.phase === 'construction' ? '' : 'none';
    });
  }

  _selectTool(tool) {
    this._activeTool = tool;
    this._updateHighlight();
    this._emitChange();
  }

  _setBrushSize(size) {
    this._brushSize = Math.max(0, Math.min(10, size));
    this._sizeLabel.textContent = `Brush: ${this._brushSize}`;
    this._emitChange();
  }

  _updateHighlight() {
    for (const { btn, tool } of this._buttons) {
      btn.style.borderColor = tool === this._activeTool ? '#e8c547' : 'transparent';
      btn.style.background = tool === this._activeTool ? '#666' : '#444';
    }
  }

  _emitChange() {
    this._bus.emit('tool-changed', {
      mode: this._activeTool.mode,
      materialId: this._activeTool.materialId,
      brushSize: this._brushSize
    });
  }

  get activeTool() { return this._activeTool; }
  get brushSize() { return this._brushSize; }
}

import {
  MAT_NONE, MAT_SAND, MAT_CLAY, MAT_STONE,
  OCC_STONE, OCC_HOUSE, STONE_SIZE, STONE_HEIGHT,
} from '../core/Constants.js';

const MAT_NAME = { [MAT_SAND]: 'sand', [MAT_CLAY]: 'clay' };
const PAINT_RATE = 1.2;   // height units/second at brush center
const SMOOTH_RATE = 6;    // blend strength per second
const REMOVE_RATE = 2.4;  // height units/second at brush center

// Paint / smooth / remove / stone-stamp operators. All construction-phase
// mutations of the grid go through here so budget, undo, and the
// terrain-changed event stay consistent.
export class EditTools {
  constructor(grid, budget, undo, bus) {
    this.grid = grid;
    this.budget = budget;
    this.undo = undo;
    this.bus = bus;
    this.stones = []; // {id, x, y} grid coords of block min corner
    this._nextStoneId = 1;
  }

  _cellEditable(i) {
    return (this.grid.occupancy[i] & (OCC_STONE | OCC_HOUSE)) === 0;
  }

  // Gaussian-ish falloff brush. Returns volume actually placed.
  paint(cx, cy, radius, materialId, dt) {
    const matName = MAT_NAME[materialId];
    if (!matName) return 0;
    const { grid, budget, undo } = this;
    let want = 0;
    const adds = [];
    const r2 = radius * radius;
    for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(grid.height - 1, Math.ceil(cy + radius)); y++) {
      for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(grid.width - 1, Math.ceil(cx + radius)); x++) {
        const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if (d2 > r2) continue;
        const i = grid.index(x, y);
        if (!this._cellEditable(i)) continue;
        const falloff = 1 - d2 / r2;
        const add = PAINT_RATE * dt * falloff * falloff;
        if (add <= 0) continue;
        adds.push([i, add]);
        want += add;
      }
    }
    if (want === 0) return 0;
    const granted = budget.spend(matName, want);
    if (granted === 0) return 0;
    const scale = granted / want;
    for (const [i, add] of adds) {
      undo.touch(i);
      grid.materialHeight[i] += add * scale;
      grid.materialId[i] = materialId;
    }
    undo.recordSpend(matName, granted);
    this.bus?.emit('terrain-changed', { reason: 'paint' });
    return granted;
  }

  // Volume-conserving blur of placed material within the brush.
  smooth(cx, cy, radius, dt) {
    const { grid, undo } = this;
    const k = Math.min(1, SMOOTH_RATE * dt);
    const r2 = radius * radius;
    const cells = [];
    for (let y = Math.max(1, Math.floor(cy - radius)); y <= Math.min(grid.height - 2, Math.ceil(cy + radius)); y++) {
      for (let x = Math.max(1, Math.floor(cx - radius)); x <= Math.min(grid.width - 2, Math.ceil(cx + radius)); x++) {
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > r2) continue;
        const i = grid.index(x, y);
        if (!this._cellEditable(i)) continue;
        cells.push(i);
      }
    }
    if (cells.length < 2) return;

    const before = cells.reduce((s, i) => s + grid.materialHeight[i], 0);
    if (before <= 0) return;
    const blurred = new Map();
    for (const i of cells) {
      // 4-neighbour average of total surface, then take the material part.
      let sum = 0, n = 0;
      for (const j of [i - 1, i + 1, i - grid.width, i + grid.width]) {
        if (this._cellEditable(j)) { sum += grid.materialHeight[j]; n++; }
      }
      if (n === 0) continue;
      blurred.set(i, grid.materialHeight[i] * (1 - k) + (sum / n) * k);
    }
    let after = 0;
    for (const v of blurred.values()) after += v;
    if (after <= 0) return;
    const renorm = before / after;
    for (const [i, v] of blurred) {
      undo.touch(i);
      grid.materialHeight[i] = v * renorm;
      if (grid.materialHeight[i] > 1e-4 && grid.materialId[i] === MAT_NONE) {
        grid.materialId[i] = MAT_SAND; // smoothing spread onto a bare cell
      }
    }
    this.bus?.emit('terrain-changed', { reason: 'smooth' });
  }

  // Erase placed material, refunding by the cell's material.
  remove(cx, cy, radius, dt) {
    const { grid, budget, undo } = this;
    const r2 = radius * radius;
    const refunds = { sand: 0, clay: 0 };
    for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(grid.height - 1, Math.ceil(cy + radius)); y++) {
      for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(grid.width - 1, Math.ceil(cx + radius)); x++) {
        const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if (d2 > r2) continue;
        const i = grid.index(x, y);
        if (!this._cellEditable(i)) continue;
        const h = grid.materialHeight[i];
        if (h <= 0) continue;
        const matName = MAT_NAME[grid.materialId[i]];
        if (!matName) continue;
        const falloff = 1 - d2 / r2;
        const take = Math.min(h, REMOVE_RATE * dt * falloff * falloff);
        if (take <= 0) continue;
        undo.touch(i);
        grid.materialHeight[i] -= take;
        refunds[matName] += take;
        if (grid.materialHeight[i] < 1e-4) {
          grid.materialHeight[i] = 0;
          grid.materialId[i] = MAT_NONE;
        }
      }
    }
    let any = false;
    for (const matName of ['sand', 'clay']) {
      if (refunds[matName] > 0) {
        budget.refund(matName, refunds[matName]);
        undo.recordSpend(matName, -refunds[matName]);
        any = true;
      }
    }
    if (any) this.bus?.emit('terrain-changed', { reason: 'remove' });
  }

  canPlaceStone(cx, cy) {
    const { grid } = this;
    const half = STONE_SIZE / 2;
    const x0 = Math.round(cx - half), y0 = Math.round(cy - half);
    if (x0 < 0 || y0 < 0 || x0 + STONE_SIZE > grid.width || y0 + STONE_SIZE > grid.height) return null;
    for (let y = y0; y < y0 + STONE_SIZE; y++) {
      for (let x = x0; x < x0 + STONE_SIZE; x++) {
        if (!this._cellEditable(grid.index(x, y))) return null;
      }
    }
    return { x: x0, y: y0 };
  }

  placeStone(cx, cy) {
    const spot = this.canPlaceStone(cx, cy);
    if (!spot || this.budget.available('stone') < 1) return null;
    const { grid, undo } = this;
    undo.beginStroke();
    for (let y = spot.y; y < spot.y + STONE_SIZE; y++) {
      for (let x = spot.x; x < spot.x + STONE_SIZE; x++) {
        const i = grid.index(x, y);
        undo.touch(i);
        grid.materialHeight[i] = STONE_HEIGHT;
        grid.materialId[i] = MAT_STONE;
        grid.occupancy[i] |= OCC_STONE;
      }
    }
    this.budget.spend('stone', 1);
    undo.recordSpend('stone', 1);
    undo.endStroke();
    const block = { id: this._nextStoneId++, ...spot };
    this.stones.push(block);
    this.bus?.emit('terrain-changed', { reason: 'stone' });
    this.bus?.emit('stones-changed', this.stones);
    return block;
  }

  // Remove the stone block covering grid cell (gx, gy), if any.
  removeStoneAt(gx, gy) {
    const idx = this.stones.findIndex((b) =>
      gx >= b.x && gx < b.x + STONE_SIZE && gy >= b.y && gy < b.y + STONE_SIZE);
    if (idx < 0) return false;
    const b = this.stones[idx];
    const { grid, undo } = this;
    undo.beginStroke();
    for (let y = b.y; y < b.y + STONE_SIZE; y++) {
      for (let x = b.x; x < b.x + STONE_SIZE; x++) {
        const i = grid.index(x, y);
        undo.touch(i);
        grid.materialHeight[i] = 0;
        grid.materialId[i] = MAT_NONE;
        grid.occupancy[i] &= ~OCC_STONE;
      }
    }
    this.budget.refund('stone', 1);
    undo.recordSpend('stone', -1);
    undo.endStroke();
    this.stones.splice(idx, 1);
    this.bus?.emit('terrain-changed', { reason: 'stone' });
    this.bus?.emit('stones-changed', this.stones);
    return true;
  }

  stoneAt(gx, gy) {
    return this.stones.some((b) =>
      gx >= b.x && gx < b.x + STONE_SIZE && gy >= b.y && gy < b.y + STONE_SIZE);
  }

  clearAll() {
    const { grid } = this;
    for (let i = 0; i < grid.cellCount; i++) {
      if ((grid.occupancy[i] & OCC_HOUSE) !== 0) continue;
      grid.materialHeight[i] = 0;
      grid.materialId[i] = MAT_NONE;
      grid.occupancy[i] &= ~OCC_STONE;
    }
    this.stones.length = 0;
    this.budget.reset();
    this.undo.clear();
    this.bus?.emit('terrain-changed', { reason: 'clear' });
    this.bus?.emit('stones-changed', this.stones);
  }
}

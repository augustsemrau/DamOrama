// Per-stroke sparse diffs: each undo entry stores only the cells a stroke
// touched, with their prior height/material/occupancy and the budget delta.
export class UndoSystem {
  constructor(grid, budget, bus = null) {
    this.grid = grid;
    this.budget = budget;
    this.bus = bus;
    this.stack = [];
    this._open = null;
  }

  beginStroke() {
    if (this._open) this.endStroke();
    this._open = {
      cells: new Map(), // i -> {h, m, o}
      budgetDelta: { sand: 0, clay: 0, stone: 0 }, // positive = spent
    };
  }

  // Must be called BEFORE the cell is mutated.
  touch(i) {
    const s = this._open;
    if (!s || s.cells.has(i)) return;
    s.cells.set(i, {
      h: this.grid.materialHeight[i],
      m: this.grid.materialId[i],
      o: this.grid.occupancy[i],
    });
  }

  recordSpend(mat, amount) {
    if (this._open) this._open.budgetDelta[mat] += amount;
  }

  endStroke() {
    const s = this._open;
    this._open = null;
    if (!s || s.cells.size === 0) return;
    this.stack.push(s);
    if (this.stack.length > 100) this.stack.shift();
  }

  undo() {
    if (this._open) this.endStroke();
    const s = this.stack.pop();
    if (!s) return false;
    for (const [i, prev] of s.cells) {
      this.grid.materialHeight[i] = prev.h;
      this.grid.materialId[i] = prev.m;
      this.grid.occupancy[i] = prev.o;
    }
    for (const mat of ['sand', 'clay', 'stone']) {
      const d = s.budgetDelta[mat];
      if (d > 0) this.budget.refund(mat, d);
      else if (d < 0) this.budget.spend(mat, -d);
    }
    this.bus?.emit('terrain-changed', { reason: 'undo' });
    return true;
  }

  clear() {
    this.stack.length = 0;
    this._open = null;
  }
}

export class UndoSystem {
  constructor() {
    this._stack = [];
    this._recording = null;
  }

  beginStroke() {
    this._recording = { cells: new Map(), budgetDelta: null };
  }

  recordCell(index, grid) {
    if (!this._recording) return;
    if (this._recording.cells.has(index)) return; // already recorded
    this._recording.cells.set(index, {
      materialHeight: grid.materialHeight[index],
      materialId: grid.materialId[index],
      occupancy: grid.occupancy[index]
    });
  }

  endStroke(budgetDelta) {
    if (!this._recording) return;
    this._recording.budgetDelta = budgetDelta || null;
    if (this._recording.cells.size > 0) {
      this._stack.push(this._recording);
    }
    this._recording = null;
  }

  undo(grid, budget) {
    if (this._stack.length === 0) return false;
    const stroke = this._stack.pop();

    for (const [index, prev] of stroke.cells) {
      grid.materialHeight[index] = prev.materialHeight;
      grid.materialId[index] = prev.materialId;
      grid.occupancy[index] = prev.occupancy;
    }

    if (stroke.budgetDelta && budget) {
      // Reverse the budget delta
      for (const [matId, amount] of Object.entries(stroke.budgetDelta)) {
        budget.refund(Number(matId), amount);
      }
    }

    return true;
  }

  clear() {
    this._stack = [];
    this._recording = null;
  }

  get canUndo() {
    return this._stack.length > 0;
  }
}

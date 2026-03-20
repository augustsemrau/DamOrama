import { MAT_NONE, MAT_STONE, STONE_BIT } from '../core/Constants.js';
import { MATERIAL_PROPS } from './Materials.js';

export class EditTools {
  constructor(grid, eventBus) {
    this.grid = grid;
    this._bus = eventBus;
  }

  /**
   * Paint material within brush radius.
   * @returns {number} volume spent (for budget tracking)
   */
  paint(cx, cy, radius, materialId, budget, undoSystem) {
    const { grid } = this;
    const props = MATERIAL_PROPS[materialId];
    if (!props) return 0;

    const r2 = radius * radius;
    let totalSpent = 0;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        const x = cx + dx, y = cy + dy;
        if (!grid.inBounds(x, y)) continue;
        const i = grid.index(x, y);

        // Skip stone cells (can't paint over stone)
        if (grid.materialId[i] === MAT_STONE) continue;

        if (materialId === MAT_STONE) {
          // Stone: place discrete block
          if (!budget.canAfford(MAT_STONE, 1)) continue;
          if (undoSystem) undoSystem.recordCell(i, grid);
          grid.materialHeight[i] = props.placementHeight;
          grid.materialId[i] = MAT_STONE;
          grid.occupancy[i] |= STONE_BIT;
          budget.spend(MAT_STONE, 1);
          totalSpent += 1;
        } else {
          // Sand/Clay: add height, spend volume, cap at maxHeight
          if (grid.materialHeight[i] >= (props.maxHeight || 1.0)) continue;
          const amount = 1;
          if (!budget.canAfford(materialId, amount)) continue;
          if (undoSystem) undoSystem.recordCell(i, grid);
          grid.materialHeight[i] = Math.min(
            grid.materialHeight[i] + props.placementHeight,
            props.maxHeight || 1.0
          );
          grid.materialId[i] = materialId;
          budget.spend(materialId, amount);
          totalSpent += amount;
        }
      }
    }

    if (totalSpent > 0) {
      this._bus.emit('terrain-changed');
    }
    return totalSpent;
  }

  /**
   * Smooth: average materialHeight in brush radius. Volume-conserving.
   * Skips stone cells.
   */
  smooth(cx, cy, radius, undoSystem) {
    const { grid } = this;
    const r2 = radius * radius;
    const cells = [];

    // Collect eligible cells and compute average
    let totalHeight = 0;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        const x = cx + dx, y = cy + dy;
        if (!grid.inBounds(x, y)) continue;
        const i = grid.index(x, y);
        if (grid.materialId[i] === MAT_STONE) continue;
        if (grid.materialHeight[i] <= 0) continue;
        cells.push(i);
        totalHeight += grid.materialHeight[i];
      }
    }

    if (cells.length === 0) return;

    const avgHeight = totalHeight / cells.length;

    // Blend toward average (50% blend factor for gentle smoothing)
    const blend = 0.5;
    for (const i of cells) {
      if (undoSystem) undoSystem.recordCell(i, grid);
      grid.materialHeight[i] = grid.materialHeight[i] * (1 - blend) + avgHeight * blend;
    }

    this._bus.emit('terrain-changed');
  }

  /**
   * Remove: clear material within brush radius. Returns budget delta for refund.
   * @returns {{ [materialId]: amount }} amounts to refund
   */
  remove(cx, cy, radius, budget, undoSystem) {
    const { grid } = this;
    const r2 = radius * radius;
    const refunds = {};

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        const x = cx + dx, y = cy + dy;
        if (!grid.inBounds(x, y)) continue;
        const i = grid.index(x, y);

        const matId = grid.materialId[i];
        if (matId === MAT_NONE) continue;

        if (undoSystem) undoSystem.recordCell(i, grid);

        if (matId === MAT_STONE) {
          refunds[MAT_STONE] = (refunds[MAT_STONE] || 0) + 1;
          grid.occupancy[i] &= ~STONE_BIT;
        } else {
          // Refund volume proportional to height / placement height
          const props = MATERIAL_PROPS[matId];
          const units = Math.round(grid.materialHeight[i] / props.placementHeight);
          refunds[matId] = (refunds[matId] || 0) + units;
        }

        grid.materialHeight[i] = 0;
        grid.materialId[i] = MAT_NONE;
      }
    }

    // Apply refunds
    for (const [matId, amount] of Object.entries(refunds)) {
      budget.refund(Number(matId), amount);
    }

    if (Object.keys(refunds).length > 0) {
      this._bus.emit('terrain-changed');
    }
    return refunds;
  }
}

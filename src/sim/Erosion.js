import {
  SIM_DT, MAT_SAND, MAT_CLAY, MAT_NONE,
  EROSION_THRESHOLD_SAND, EROSION_THRESHOLD_CLAY,
  EROSION_RATE_SAND, EROSION_RATE_CLAY, EROSION_MIN_DEPTH,
} from '../core/Constants.js';

// Removes placed sand/clay under fast flow, and records the per-cell flood
// statistics the postmortem reads (max speed, max overtop depth, total
// erosion). Eroded material vanishes — no sediment transport in MVP.
export class Erosion {
  constructor(grid, sim) {
    this.grid = grid;
    this.sim = sim;
    const n = grid.cellCount;
    this.erosionTotal = new Float32Array(n);
    this.maxSpeed = new Float32Array(n);
    this.maxOvertop = new Float32Array(n);
  }

  // One SIM_DT of erosion + stat tracking. Returns true if any material moved
  // (the terrain mesh only re-uploads when this is true).
  step() {
    const { grid, sim } = this;
    const { materialHeight, materialId, waterDepth } = grid;
    const { speed } = sim;
    const { erosionTotal, maxSpeed, maxOvertop } = this;
    let dirty = false;

    for (let i = 0; i < grid.cellCount; i++) {
      const d = waterDepth[i];
      if (d <= 0) continue;

      const v = speed[i];
      if (v > maxSpeed[i]) maxSpeed[i] = v;
      if (materialHeight[i] > 0.02 && d > maxOvertop[i]) maxOvertop[i] = d;

      if (d < EROSION_MIN_DEPTH) continue;
      const mat = materialId[i];
      if (mat !== MAT_SAND && mat !== MAT_CLAY) continue;

      const sand = mat === MAT_SAND;
      const excess = v - (sand ? EROSION_THRESHOLD_SAND : EROSION_THRESHOLD_CLAY);
      if (excess <= 0) continue;

      const rate = sand ? EROSION_RATE_SAND : EROSION_RATE_CLAY;
      const removed = Math.min(materialHeight[i], rate * excess * SIM_DT);
      if (removed <= 0) continue;

      materialHeight[i] -= removed;
      erosionTotal[i] += removed;
      if (materialHeight[i] < 1e-5) {
        materialHeight[i] = 0;
        materialId[i] = MAT_NONE;
      }
      dirty = true;
    }
    return dirty;
  }

  resetStats() {
    this.erosionTotal.fill(0);
    this.maxSpeed.fill(0);
    this.maxOvertop.fill(0);
  }
}

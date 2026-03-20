import { MAT_NONE, MAT_STONE } from '../core/Constants.js';

export class Erosion {
  constructor(grid, eventBus, simConfig) {
    this.grid = grid;
    this._bus = eventBus;
    this._threshold = simConfig.erosionThreshold;
    this._rates = {
      1: simConfig.erosionRateSand,  // MAT_SAND
      2: simConfig.erosionRateClay   // MAT_CLAY
    };
  }

  step(velocity, dt) {
    const { grid, _threshold, _rates } = this;
    const { materialHeight, materialId } = grid;
    let changed = false;

    for (let i = 0; i < grid.cellCount; i++) {
      if (materialHeight[i] <= 0) continue;
      if (materialId[i] === MAT_STONE) continue;

      const vx = velocity[i * 2];
      const vy = velocity[i * 2 + 1];
      const speed = Math.sqrt(vx * vx + vy * vy);

      if (speed <= _threshold) continue;

      const rate = _rates[materialId[i]];
      if (!rate) continue;

      const erosion = rate * speed * dt;
      materialHeight[i] -= erosion;
      changed = true;

      if (materialHeight[i] <= 0) {
        materialHeight[i] = 0;
        materialId[i] = MAT_NONE;
      }
    }

    if (changed) {
      this._bus.emit('terrain-changed');
    }
  }
}

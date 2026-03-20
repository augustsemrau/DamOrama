import { HOUSE_BIT } from '../core/Constants.js';
import { MAT_NONE } from '../core/Constants.js';

export class WinLoss {
  constructor(grid, eventBus, housesConfig) {
    this._grid = grid;
    this._bus = eventBus;
    this._houses = housesConfig.map(h => ({
      ...h,
      flooded: false
    }));
    this._firstFloodedHouse = null;
    this._breachRegion = [];
  }

  checkFlooding() {
    const { _grid: grid, _houses: houses, _bus: bus } = this;

    for (const house of houses) {
      if (house.flooded) continue;

      // Compute average water depth over footprint
      let totalDepth = 0;
      let cellCount = 0;
      for (let dy = 0; dy < house.footprint.h; dy++) {
        for (let dx = 0; dx < house.footprint.w; dx++) {
          const x = house.position.x + dx;
          const y = house.position.y + dy;
          if (!grid.inBounds(x, y)) continue;
          totalDepth += grid.waterDepth[grid.index(x, y)];
          cellCount++;
        }
      }

      const avgDepth = cellCount > 0 ? totalDepth / cellCount : 0;

      if (avgDepth > house.floodThreshold) {
        house.flooded = true;
        if (!this._firstFloodedHouse) {
          this._firstFloodedHouse = house.id;
          this._captureBreachRegion(house);
        }
        bus.emit('house-flooded', { houseId: house.id });
      }
    }
  }

  _captureBreachRegion(house) {
    const grid = this._grid;
    const region = [];

    // Search area west of house (where defense likely was)
    const searchMinX = Math.max(0, house.position.x - 20);
    const searchMaxX = house.position.x;
    const searchMinY = Math.max(0, house.position.y - 5);
    const searchMaxY = Math.min(grid.height - 1, house.position.y + house.footprint.h + 5);

    let maxDepth = 0;
    for (let y = searchMinY; y <= searchMaxY; y++) {
      for (let x = searchMinX; x <= searchMaxX; x++) {
        const i = grid.index(x, y);
        const depth = grid.waterDepth[i];
        if (depth > maxDepth) maxDepth = depth;
      }
    }

    // Collect cells with depth > 50% of max
    const threshold = maxDepth * 0.5;
    for (let y = searchMinY; y <= searchMaxY; y++) {
      for (let x = searchMinX; x <= searchMaxX; x++) {
        if (grid.waterDepth[grid.index(x, y)] > threshold) {
          region.push({ x, y });
        }
      }
    }

    this._breachRegion = region;
  }

  evaluate() {
    if (!this._firstFloodedHouse) {
      return { won: true, breachRegion: [], firstFloodedHouse: null, failureCause: null };
    }

    // Determine failure cause from breach region
    let hasIntactMaterial = false;

    for (const cell of this._breachRegion) {
      const i = this._grid.index(cell.x, cell.y);
      if (this._grid.materialId[i] !== MAT_NONE) {
        hasIntactMaterial = true;
        break;
      }
    }

    // If material is still present in breach area, water went over it (overtopped)
    // If material is absent in breach area, it was eroded away
    const failureCause = hasIntactMaterial ? 'overtopped' : 'eroded';

    return {
      won: false,
      breachRegion: this._breachRegion,
      firstFloodedHouse: this._firstFloodedHouse,
      failureCause
    };
  }

  reset() {
    for (const house of this._houses) {
      house.flooded = false;
    }
    this._firstFloodedHouse = null;
    this._breachRegion = [];
  }
}

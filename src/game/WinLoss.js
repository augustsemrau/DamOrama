import { HOUSE_FLOOD_DEPTH } from '../core/Constants.js';

// House flood sensing: averaged footprint depth, latched once wet.
export class WinLoss {
  constructor(grid, houses, bus = null) {
    this.grid = grid;
    this.bus = bus;
    this.houses = houses.map((h) => {
      const cells = [];
      for (let y = h.y; y < h.y + h.h; y++) {
        for (let x = h.x; x < h.x + h.w; x++) {
          if (grid.inBounds(x, y)) cells.push(grid.index(x, y));
        }
      }
      return { ...h, cells, flooded: false, floodedAt: -1 };
    });
  }

  // Latches newly flooded houses; returns ids flooded by this check.
  check(simTime = 0) {
    const { waterDepth } = this.grid;
    const newly = [];
    for (const house of this.houses) {
      if (house.flooded) continue;
      let sum = 0;
      for (const i of house.cells) sum += waterDepth[i];
      if (sum / house.cells.length > HOUSE_FLOOD_DEPTH) {
        house.flooded = true;
        house.floodedAt = simTime;
        newly.push(house.id);
        this.bus?.emit('house-flooded', { id: house.id, simTime });
      }
    }
    return newly;
  }

  floodedIds() {
    return this.houses.filter((h) => h.flooded).map((h) => h.id);
  }

  allDry() {
    return this.houses.every((h) => !h.flooded);
  }

  firstFlooded() {
    let first = null;
    for (const h of this.houses) {
      if (h.flooded && (first === null || h.floodedAt < first.floodedAt)) first = h;
    }
    return first;
  }

  reset() {
    for (const h of this.houses) {
      h.flooded = false;
      h.floodedAt = -1;
    }
  }
}

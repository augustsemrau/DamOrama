import { STONE_BIT, HOUSE_BIT, DEV_MODE } from './Constants.js';

export class Grid {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.cellCount = width * height;

    this.terrainHeight = new Float32Array(this.cellCount);
    this.materialHeight = new Float32Array(this.cellCount);
    this.waterDepth = new Float32Array(this.cellCount);
    this.materialId = new Uint8Array(this.cellCount);
    this.occupancy = new Uint8Array(this.cellCount);
  }

  index(x, y) {
    if (DEV_MODE && !this.inBounds(x, y)) {
      throw new RangeError(`Grid index out of bounds: (${x}, ${y})`);
    }
    return y * this.width + x;
  }

  inBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  getSurfaceHeight(i) {
    return this.terrainHeight[i] + this.materialHeight[i];
  }

  getWaterSurfaceHeight(i) {
    return this.getSurfaceHeight(i) + this.waterDepth[i];
  }

  getRemainingMaterial(i) {
    return this.materialHeight[i];
  }

  isBlocked(i) {
    return (this.occupancy[i] & STONE_BIT) !== 0;
  }

  isHouse(i) {
    return (this.occupancy[i] & HOUSE_BIT) !== 0;
  }

  reset() {
    this.materialHeight.fill(0);
    this.waterDepth.fill(0);
    this.materialId.fill(0);
    this.occupancy.fill(0);
  }
}

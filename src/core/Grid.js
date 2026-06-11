import { CELL_AREA, MAT_NONE, OCC_STONE } from './Constants.js';

// Single source of truth for the world state. Flat typed arrays, row-major.
export class Grid {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.cellCount = width * height;
    this.terrainHeight = new Float32Array(this.cellCount);
    this.materialHeight = new Float32Array(this.cellCount);
    this.materialId = new Uint8Array(this.cellCount);
    this.waterDepth = new Float32Array(this.cellCount);
    this.occupancy = new Uint8Array(this.cellCount);
  }

  index(x, y) {
    return y * this.width + x;
  }

  inBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  // Ground the water sits on: base terrain + everything the player placed.
  surfaceHeight(i) {
    return this.terrainHeight[i] + this.materialHeight[i];
  }

  waterSurface(i) {
    return this.terrainHeight[i] + this.materialHeight[i] + this.waterDepth[i];
  }

  isStone(i) {
    return (this.occupancy[i] & OCC_STONE) !== 0;
  }

  totalWaterVolume() {
    let v = 0;
    for (let i = 0; i < this.cellCount; i++) v += this.waterDepth[i];
    return v * CELL_AREA;
  }

  totalMaterialVolume() {
    let v = 0;
    for (let i = 0; i < this.cellCount; i++) v += this.materialHeight[i];
    return v * CELL_AREA;
  }

  clearWater() {
    this.waterDepth.fill(0);
  }

  clearMaterial() {
    this.materialHeight.fill(0);
    this.materialId.fill(MAT_NONE);
  }

  snapshotBuild() {
    return {
      materialHeight: this.materialHeight.slice(),
      materialId: this.materialId.slice(),
      occupancy: this.occupancy.slice(),
    };
  }

  restoreBuild(snap) {
    this.materialHeight.set(snap.materialHeight);
    this.materialId.set(snap.materialId);
    this.occupancy.set(snap.occupancy);
  }
}

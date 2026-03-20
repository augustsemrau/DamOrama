import { MAT_SAND, MAT_CLAY, MAT_STONE } from '../core/Constants.js';

export class ResourceBudget {
  constructor(eventBus, resources) {
    this._bus = eventBus;
    this._initial = { ...resources };
    this.sandVolume = resources.sandVolume;
    this.clayVolume = resources.clayVolume;
    this.stoneBlocks = resources.stoneBlocks;
  }

  canAfford(materialId, amount) {
    switch (materialId) {
      case MAT_SAND: return this.sandVolume >= amount;
      case MAT_CLAY: return this.clayVolume >= amount;
      case MAT_STONE: return this.stoneBlocks >= amount;
      default: return false;
    }
  }

  spend(materialId, amount) {
    switch (materialId) {
      case MAT_SAND: this.sandVolume -= amount; break;
      case MAT_CLAY: this.clayVolume -= amount; break;
      case MAT_STONE: this.stoneBlocks -= amount; break;
    }
    this._bus.emit('budget-changed', this.snapshot());
  }

  refund(materialId, amount) {
    switch (materialId) {
      case MAT_SAND: this.sandVolume += amount; break;
      case MAT_CLAY: this.clayVolume += amount; break;
      case MAT_STONE: this.stoneBlocks += amount; break;
    }
    this._bus.emit('budget-changed', this.snapshot());
  }

  snapshot() {
    return {
      sandVolume: this.sandVolume,
      clayVolume: this.clayVolume,
      stoneBlocks: this.stoneBlocks
    };
  }

  reset() {
    this.sandVolume = this._initial.sandVolume;
    this.clayVolume = this._initial.clayVolume;
    this.stoneBlocks = this._initial.stoneBlocks;
    this._bus.emit('budget-changed', this.snapshot());
  }
}

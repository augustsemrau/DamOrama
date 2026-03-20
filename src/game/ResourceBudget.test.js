import { describe, it, expect, beforeEach } from 'vitest';
import { ResourceBudget } from './ResourceBudget.js';
import { EventBus } from '../core/EventBus.js';
import { MAT_SAND, MAT_CLAY, MAT_STONE } from '../core/Constants.js';

describe('ResourceBudget', () => {
  let budget, bus;

  beforeEach(() => {
    bus = new EventBus();
    budget = new ResourceBudget(bus, {
      sandVolume: 100,
      clayVolume: 50,
      stoneBlocks: 3
    });
  });

  it('initializes with given resources', () => {
    expect(budget.sandVolume).toBe(100);
    expect(budget.clayVolume).toBe(50);
    expect(budget.stoneBlocks).toBe(3);
  });

  it('canAfford checks available resources', () => {
    expect(budget.canAfford(MAT_SAND, 50)).toBe(true);
    expect(budget.canAfford(MAT_SAND, 150)).toBe(false);
    expect(budget.canAfford(MAT_STONE, 1)).toBe(true);
    expect(budget.canAfford(MAT_STONE, 5)).toBe(false);
  });

  it('spend reduces resources', () => {
    budget.spend(MAT_SAND, 30);
    expect(budget.sandVolume).toBe(70);
  });

  it('refund increases resources', () => {
    budget.spend(MAT_CLAY, 20);
    budget.refund(MAT_CLAY, 20);
    expect(budget.clayVolume).toBe(50);
  });

  it('emits budget-changed on spend and refund', () => {
    const events = [];
    bus.on('budget-changed', (d) => events.push(d));
    budget.spend(MAT_SAND, 10);
    budget.refund(MAT_SAND, 5);
    expect(events).toHaveLength(2);
    expect(events[0].sandVolume).toBe(90);
    expect(events[1].sandVolume).toBe(95);
  });

  it('reset restores initial values', () => {
    budget.spend(MAT_SAND, 50);
    budget.spend(MAT_STONE, 2);
    budget.reset();
    expect(budget.sandVolume).toBe(100);
    expect(budget.stoneBlocks).toBe(3);
  });
});

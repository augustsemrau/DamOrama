import { describe, it, expect, beforeEach } from 'vitest';
import { Erosion } from './Erosion.js';
import { Grid } from '../core/Grid.js';
import { EventBus } from '../core/EventBus.js';
import { MAT_SAND, MAT_CLAY, MAT_STONE, MAT_NONE } from '../core/Constants.js';

describe('Erosion', () => {
  let grid, bus, erosion, velocity;
  const W = 8, H = 8;

  beforeEach(() => {
    grid = new Grid(W, H);
    grid.terrainHeight.fill(0.1);
    bus = new EventBus();
    velocity = new Float32Array(W * H * 2);
    erosion = new Erosion(grid, bus, {
      erosionThreshold: 0.1,
      erosionRateSand: 0.01,
      erosionRateClay: 0.003
    });
  });

  it('erodes sand when flow speed exceeds threshold', () => {
    const i = grid.index(4, 4);
    grid.materialHeight[i] = 0.5;
    grid.materialId[i] = MAT_SAND;

    // Set high velocity
    velocity[i * 2] = 1.0;     // vx
    velocity[i * 2 + 1] = 0.0; // vy

    erosion.step(velocity, 1.0);

    expect(grid.materialHeight[i]).toBeLessThan(0.5);
  });

  it('does not erode when flow speed is below threshold', () => {
    const i = grid.index(4, 4);
    grid.materialHeight[i] = 0.5;
    grid.materialId[i] = MAT_SAND;

    velocity[i * 2] = 0.05; // below threshold
    erosion.step(velocity, 1.0);

    expect(grid.materialHeight[i]).toBe(0.5);
  });

  it('does not erode stone', () => {
    const i = grid.index(4, 4);
    grid.materialHeight[i] = 0.5;
    grid.materialId[i] = MAT_STONE;

    velocity[i * 2] = 2.0;
    erosion.step(velocity, 1.0);

    expect(grid.materialHeight[i]).toBe(0.5);
  });

  it('sand erodes faster than clay', () => {
    const si = grid.index(2, 4);
    const ci = grid.index(6, 4);
    grid.materialHeight[si] = 0.5;
    grid.materialId[si] = MAT_SAND;
    grid.materialHeight[ci] = 0.5;
    grid.materialId[ci] = MAT_CLAY;

    // Same velocity
    velocity[si * 2] = 1.0;
    velocity[ci * 2] = 1.0;

    erosion.step(velocity, 1.0);

    const sandLoss = 0.5 - grid.materialHeight[si];
    const clayLoss = 0.5 - grid.materialHeight[ci];
    expect(sandLoss).toBeGreaterThan(clayLoss);
  });

  it('clears materialId when fully eroded', () => {
    const i = grid.index(4, 4);
    grid.materialHeight[i] = 0.001; // very thin
    grid.materialId[i] = MAT_SAND;

    velocity[i * 2] = 2.0;
    erosion.step(velocity, 1.0);

    expect(grid.materialHeight[i]).toBe(0);
    expect(grid.materialId[i]).toBe(MAT_NONE);
  });

  it('emits terrain-changed when erosion occurs', () => {
    const events = [];
    bus.on('terrain-changed', () => events.push(true));

    const i = grid.index(4, 4);
    grid.materialHeight[i] = 0.5;
    grid.materialId[i] = MAT_SAND;
    velocity[i * 2] = 1.0;

    erosion.step(velocity, 1.0);
    expect(events.length).toBe(1);
  });

  it('does not emit terrain-changed when no erosion occurs', () => {
    const events = [];
    bus.on('terrain-changed', () => events.push(true));

    // No material placed
    erosion.step(velocity, 1.0);
    expect(events.length).toBe(0);
  });
});

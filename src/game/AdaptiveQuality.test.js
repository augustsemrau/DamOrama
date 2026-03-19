/**
 * AdaptiveQuality tests
 *
 * Requirements: 17.4, 17.5, 17.6
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  init,
  update,
  getSubsteps,
  getGridSize,
  isDowngraded,
} from './AdaptiveQuality.js';

describe('AdaptiveQuality', () => {
  beforeEach(() => {
    init();
    vi.restoreAllMocks();
  });

  it('starts with default substeps (6) and grid size (512)', () => {
    expect(getSubsteps()).toBe(6);
    expect(getGridSize()).toBe(512);
    expect(isDowngraded()).toBe(false);
  });

  it('no downgrade when frame times are under 20ms', () => {
    for (let i = 0; i < 100; i++) {
      update(15);
    }
    expect(getSubsteps()).toBe(6);
    expect(getGridSize()).toBe(512);
    expect(isDowngraded()).toBe(false);
  });

  it('first downgrade after 30 consecutive frames > 20ms', () => {
    const spy = vi.spyOn(console, 'log');

    // 29 frames — no downgrade yet
    for (let i = 0; i < 29; i++) {
      update(25);
    }
    expect(getSubsteps()).toBe(6);
    expect(isDowngraded()).toBe(false);

    // 30th frame triggers first downgrade
    update(25);
    expect(getSubsteps()).toBe(2);
    expect(getGridSize()).toBe(512);
    expect(isDowngraded()).toBe(true);
    expect(spy).toHaveBeenCalledWith('[AdaptiveQuality] Reduced substeps to 2');
  });

  it('second downgrade after another 30 consecutive frames > 20ms', () => {
    const spy = vi.spyOn(console, 'log');

    // Trigger first downgrade
    for (let i = 0; i < 30; i++) {
      update(25);
    }
    expect(getSubsteps()).toBe(2);

    // Another 30 frames over budget → second downgrade
    for (let i = 0; i < 30; i++) {
      update(25);
    }
    expect(getSubsteps()).toBe(2);
    expect(getGridSize()).toBe(256);
    expect(isDowngraded()).toBe(true);
    expect(spy).toHaveBeenCalledWith('[AdaptiveQuality] Halved water grid to 256×256');
  });

  it('counter resets if a frame comes in under 20ms', () => {
    // 29 bad frames
    for (let i = 0; i < 29; i++) {
      update(25);
    }
    // One good frame resets the counter
    update(10);

    // Another 29 bad frames — still no downgrade (counter was reset)
    for (let i = 0; i < 29; i++) {
      update(25);
    }
    expect(getSubsteps()).toBe(6);
    expect(isDowngraded()).toBe(false);

    // 30th bad frame after reset triggers downgrade
    update(25);
    expect(getSubsteps()).toBe(2);
  });

  it('downgrades are permanent (do not revert)', () => {
    // Trigger first downgrade
    for (let i = 0; i < 30; i++) {
      update(25);
    }
    expect(getSubsteps()).toBe(2);

    // Many good frames — substeps stay at 2
    for (let i = 0; i < 200; i++) {
      update(5);
    }
    expect(getSubsteps()).toBe(2);
    expect(isDowngraded()).toBe(true);

    // Trigger second downgrade
    for (let i = 0; i < 30; i++) {
      update(25);
    }
    expect(getGridSize()).toBe(256);

    // Many good frames — grid stays halved
    for (let i = 0; i < 200; i++) {
      update(5);
    }
    expect(getGridSize()).toBe(256);
    expect(getSubsteps()).toBe(2);
    expect(isDowngraded()).toBe(true);
  });

  it('console logging on downgrade', () => {
    const spy = vi.spyOn(console, 'log');

    // First downgrade
    for (let i = 0; i < 30; i++) {
      update(25);
    }
    expect(spy).toHaveBeenCalledWith('[AdaptiveQuality] Reduced substeps to 2');

    // Second downgrade
    for (let i = 0; i < 30; i++) {
      update(25);
    }
    expect(spy).toHaveBeenCalledWith('[AdaptiveQuality] Halved water grid to 256×256');
  });

  it('no further changes after both downgrades applied', () => {
    // Trigger both downgrades
    for (let i = 0; i < 60; i++) {
      update(25);
    }
    expect(getSubsteps()).toBe(2);
    expect(getGridSize()).toBe(256);

    const spy = vi.spyOn(console, 'log');
    // More bad frames — no additional logs or changes
    for (let i = 0; i < 100; i++) {
      update(25);
    }
    expect(spy).not.toHaveBeenCalled();
    expect(getSubsteps()).toBe(2);
    expect(getGridSize()).toBe(256);
  });

  it('frame time exactly at 20ms does not count as over budget', () => {
    for (let i = 0; i < 60; i++) {
      update(20);
    }
    expect(getSubsteps()).toBe(6);
    expect(isDowngraded()).toBe(false);
  });
});

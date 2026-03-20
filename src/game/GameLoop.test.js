import { describe, it, expect, beforeEach } from 'vitest';
import { GameLoop } from './GameLoop.js';
import { EventBus } from '../core/EventBus.js';

describe('GameLoop', () => {
  let loop, bus, config, phaseChanges;

  beforeEach(() => {
    bus = new EventBus();
    config = {
      waterSource: { durationSec: 5, startDelaySec: 0 },
      sim: { settleTimeSec: 3 }
    };
    loop = new GameLoop(bus, config);
    phaseChanges = [];
    bus.on('phase-changed', (d) => phaseChanges.push(d.phase));
  });

  it('starts in construction phase', () => {
    expect(loop.phase).toBe('construction');
  });

  it('transitions to flood on startFlood', () => {
    loop.startFlood();
    expect(loop.phase).toBe('flood');
    expect(phaseChanges).toEqual(['flood']);
  });

  it('startFlood is idempotent during flood', () => {
    loop.startFlood();
    loop.startFlood(); // should be ignored
    expect(phaseChanges).toEqual(['flood']);
  });

  it('startFlood is ignored during resolution', () => {
    loop.startFlood();
    // Fast-forward past flood duration + settle
    for (let i = 0; i < 500; i++) loop.update(1/60);
    expect(loop.phase).toBe('resolution');
    loop.startFlood(); // should be ignored
    expect(loop.phase).toBe('resolution');
  });

  it('source is active during flood within duration', () => {
    loop.startFlood();
    expect(loop.isSourceActive()).toBe(true);
  });

  it('source becomes inactive after durationSec', () => {
    loop.startFlood();
    // Advance past 5 seconds
    for (let i = 0; i < 320; i++) loop.update(1/60); // ~5.3s
    expect(loop.isSourceActive()).toBe(false);
  });

  it('transitions to resolution after source + settle time', () => {
    loop.startFlood();
    // Need 5s source + 3s settle = 8s total
    for (let i = 0; i < 500; i++) loop.update(1/60); // ~8.3s
    expect(loop.phase).toBe('resolution');
    expect(phaseChanges).toContain('resolution');
  });

  it('retry resets to construction and calls resetFn', () => {
    loop.startFlood();
    for (let i = 0; i < 500; i++) loop.update(1/60);
    expect(loop.phase).toBe('resolution');

    let resetCalled = false;
    loop.retry(() => { resetCalled = true; });

    expect(loop.phase).toBe('construction');
    expect(resetCalled).toBe(true);
    expect(phaseChanges).toContain('construction');
  });

  it('retry is idempotent during construction', () => {
    let count = 0;
    loop.retry(() => { count++; });
    expect(count).toBe(0); // no-op in construction
    expect(loop.phase).toBe('construction');
  });

  it('update is no-op during construction and resolution', () => {
    // Construction: update should not change phase
    loop.update(1/60);
    expect(loop.phase).toBe('construction');

    // Resolution: update should not change phase
    loop.startFlood();
    for (let i = 0; i < 500; i++) loop.update(1/60);
    expect(loop.phase).toBe('resolution');
    loop.update(1/60);
    expect(loop.phase).toBe('resolution');
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from './EventBus.js';

describe('EventBus', () => {
  let bus;
  beforeEach(() => { bus = new EventBus(); });

  it('calls subscriber when event is emitted', () => {
    const calls = [];
    bus.on('test', (data) => calls.push(data));
    bus.emit('test', 42);
    expect(calls).toEqual([42]);
  });

  it('supports multiple subscribers', () => {
    const a = [], b = [];
    bus.on('x', (d) => a.push(d));
    bus.on('x', (d) => b.push(d));
    bus.emit('x', 1);
    expect(a).toEqual([1]);
    expect(b).toEqual([1]);
  });

  it('does not call unsubscribed listener', () => {
    const calls = [];
    const fn = (d) => calls.push(d);
    bus.on('x', fn);
    bus.off('x', fn);
    bus.emit('x', 1);
    expect(calls).toEqual([]);
  });

  it('does nothing when emitting event with no subscribers', () => {
    expect(() => bus.emit('nonexistent', 1)).not.toThrow();
  });
});

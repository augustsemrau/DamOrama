import { describe, it, expect, beforeEach } from 'vitest';
import {
  Phase,
  getPhase,
  setOnPhaseChange,
  setFloodDuration,
  triggerFlood,
  update,
  isWaterActive,
  isFloodPhase,
  getFloodTimer,
  reset,
} from './GameLoop.js';

describe('GameLoop', () => {
  beforeEach(() => {
    reset();
  });

  describe('initial state', () => {
    it('should start in CONSTRUCTION phase', () => {
      expect(getPhase()).toBe(Phase.CONSTRUCTION);
    });

    it('should have water inactive initially', () => {
      expect(isWaterActive()).toBe(false);
    });

    it('should not be in flood phase initially', () => {
      expect(isFloodPhase()).toBe(false);
    });

    it('should have flood timer at zero', () => {
      expect(getFloodTimer()).toBe(0);
    });
  });

  describe('Phase enum', () => {
    it('should define three phases', () => {
      expect(Phase.CONSTRUCTION).toBe('construction');
      expect(Phase.FLOOD).toBe('flood');
      expect(Phase.RESOLUTION).toBe('resolution');
    });
  });

  describe('triggerFlood', () => {
    it('should transition from CONSTRUCTION to FLOOD', () => {
      const result = triggerFlood();
      expect(result).toBe(true);
      expect(getPhase()).toBe(Phase.FLOOD);
    });

    it('should return false if not in CONSTRUCTION phase', () => {
      triggerFlood(); // now in FLOOD
      const result = triggerFlood();
      expect(result).toBe(false);
      expect(getPhase()).toBe(Phase.FLOOD);
    });

    it('should reset flood timer on trigger', () => {
      triggerFlood();
      expect(getFloodTimer()).toBe(0);
    });

    it('should fire onPhaseChange callback with FLOOD', () => {
      const phases = [];
      setOnPhaseChange((p) => phases.push(p));
      triggerFlood();
      expect(phases).toEqual([Phase.FLOOD]);
    });

    it('should activate water simulation', () => {
      triggerFlood();
      expect(isWaterActive()).toBe(true);
      expect(isFloodPhase()).toBe(true);
    });
  });

  describe('update — CONSTRUCTION phase', () => {
    it('should remain in CONSTRUCTION when update is called', () => {
      update(1 / 60, { allHousesFlooded: false });
      expect(getPhase()).toBe(Phase.CONSTRUCTION);
    });

    it('should not advance flood timer during CONSTRUCTION', () => {
      update(1, { allHousesFlooded: false });
      expect(getFloodTimer()).toBe(0);
    });
  });

  describe('update — FLOOD phase', () => {
    beforeEach(() => {
      triggerFlood();
    });

    it('should increment flood timer', () => {
      update(1 / 60, { allHousesFlooded: false });
      expect(getFloodTimer()).toBeCloseTo(1 / 60);
    });

    it('should accumulate flood timer over multiple updates', () => {
      for (let i = 0; i < 60; i++) {
        update(1 / 60, { allHousesFlooded: false });
      }
      expect(getFloodTimer()).toBeCloseTo(1.0);
    });

    it('should transition to RESOLUTION when allHousesFlooded', () => {
      update(1 / 60, { allHousesFlooded: true });
      expect(getPhase()).toBe(Phase.RESOLUTION);
    });

    it('should transition to RESOLUTION when flood timer exceeds duration', () => {
      setFloodDuration(10);
      for (let i = 0; i < 600; i++) {
        update(1 / 60, { allHousesFlooded: false });
      }
      expect(getPhase()).toBe(Phase.RESOLUTION);
    });

    it('should fire onPhaseChange callback on transition to RESOLUTION', () => {
      const phases = [];
      setOnPhaseChange((p) => phases.push(p));
      update(1 / 60, { allHousesFlooded: true });
      expect(phases).toEqual([Phase.RESOLUTION]);
    });

    it('should deactivate water when entering RESOLUTION', () => {
      update(1 / 60, { allHousesFlooded: true });
      expect(isWaterActive()).toBe(false);
      expect(isFloodPhase()).toBe(false);
    });
  });

  describe('update — RESOLUTION phase', () => {
    beforeEach(() => {
      triggerFlood();
      update(1 / 60, { allHousesFlooded: true }); // enter RESOLUTION
    });

    it('should remain in RESOLUTION on further updates', () => {
      update(1 / 60, { allHousesFlooded: false });
      expect(getPhase()).toBe(Phase.RESOLUTION);
    });
  });

  describe('setFloodDuration', () => {
    it('should configure the flood duration', () => {
      setFloodDuration(5);
      triggerFlood();
      // Advance 4.9 seconds — should still be in FLOOD
      update(4.9, { allHousesFlooded: false });
      expect(getPhase()).toBe(Phase.FLOOD);
      // Advance past 5 seconds total — should transition to RESOLUTION
      update(0.2, { allHousesFlooded: false });
      expect(getPhase()).toBe(Phase.RESOLUTION);
    });
  });

  describe('reset', () => {
    it('should return to CONSTRUCTION phase', () => {
      triggerFlood();
      reset();
      expect(getPhase()).toBe(Phase.CONSTRUCTION);
    });

    it('should zero the flood timer', () => {
      triggerFlood();
      update(5, { allHousesFlooded: false });
      reset();
      expect(getFloodTimer()).toBe(0);
    });

    it('should clear the onPhaseChange callback', () => {
      const phases = [];
      setOnPhaseChange((p) => phases.push(p));
      reset();
      triggerFlood();
      expect(phases).toHaveLength(0);
    });

    it('should allow a full cycle after reset', () => {
      triggerFlood();
      update(1 / 60, { allHousesFlooded: true });
      expect(getPhase()).toBe(Phase.RESOLUTION);

      reset();
      expect(getPhase()).toBe(Phase.CONSTRUCTION);

      triggerFlood();
      expect(getPhase()).toBe(Phase.FLOOD);

      update(1 / 60, { allHousesFlooded: true });
      expect(getPhase()).toBe(Phase.RESOLUTION);
    });
  });
});

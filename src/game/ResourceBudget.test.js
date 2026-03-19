import { describe, it, expect, beforeEach } from 'vitest';
import {
  init,
  getRemaining,
  getBudget,
  canPlace,
  spend,
  reset,
} from './ResourceBudget.js';

describe('ResourceBudget', () => {
  // ── init (Req 11.1) ──────────────────────────────────────────────

  describe('init', () => {
    it('reads initial budget from level data', () => {
      init({ sand: 20, clay: 10, stone: 6, timber: 4 });
      expect(getBudget()).toEqual({ sand: 20, clay: 10, stone: 6, timber: 4 });
    });

    it('defaults missing types to zero', () => {
      init({ sand: 5 });
      expect(getRemaining('clay')).toBe(0);
      expect(getRemaining('stone')).toBe(0);
      expect(getRemaining('timber')).toBe(0);
    });

    it('handles null/undefined input gracefully', () => {
      init(null);
      expect(getBudget()).toEqual({ sand: 0, clay: 0, stone: 0, timber: 0 });
    });

    it('floors fractional values', () => {
      init({ sand: 3.9, clay: 1.1, stone: 0.5, timber: 2.7 });
      expect(getBudget()).toEqual({ sand: 3, clay: 1, stone: 0, timber: 2 });
    });

    it('clamps negative values to zero', () => {
      init({ sand: -5, clay: 10, stone: 0, timber: -1 });
      expect(getRemaining('sand')).toBe(0);
      expect(getRemaining('timber')).toBe(0);
    });
  });

  // ── getRemaining (Req 11.2) ───────────────────────────────────────

  describe('getRemaining', () => {
    beforeEach(() => {
      init({ sand: 20, clay: 10, stone: 6, timber: 4 });
    });

    it('returns correct count for each material type', () => {
      expect(getRemaining('sand')).toBe(20);
      expect(getRemaining('clay')).toBe(10);
      expect(getRemaining('stone')).toBe(6);
      expect(getRemaining('timber')).toBe(4);
    });

    it('returns 0 for invalid material type', () => {
      expect(getRemaining('gold')).toBe(0);
      expect(getRemaining('')).toBe(0);
    });
  });

  // ── getBudget ─────────────────────────────────────────────────────

  describe('getBudget', () => {
    it('returns a copy, not the internal object', () => {
      init({ sand: 5, clay: 5, stone: 5, timber: 5 });
      const b = getBudget();
      b.sand = 999;
      expect(getRemaining('sand')).toBe(5);
    });
  });

  // ── canPlace (Req 11.4) ───────────────────────────────────────────

  describe('canPlace', () => {
    beforeEach(() => {
      init({ sand: 1, clay: 0, stone: 3, timber: 0 });
    });

    it('returns true when units remain', () => {
      expect(canPlace('sand')).toBe(true);
      expect(canPlace('stone')).toBe(true);
    });

    it('returns false when budget is exhausted', () => {
      expect(canPlace('clay')).toBe(false);
      expect(canPlace('timber')).toBe(false);
    });

    it('returns false for invalid material type', () => {
      expect(canPlace('gold')).toBe(false);
    });
  });

  // ── spend (Req 11.3, 11.4) ───────────────────────────────────────

  describe('spend', () => {
    beforeEach(() => {
      init({ sand: 2, clay: 1, stone: 0, timber: 3 });
    });

    it('decrements count by one and returns true', () => {
      expect(spend('sand')).toBe(true);
      expect(getRemaining('sand')).toBe(1);
    });

    it('returns false and does not decrement when budget exhausted', () => {
      expect(spend('stone')).toBe(false);
      expect(getRemaining('stone')).toBe(0);
    });

    it('blocks placement after spending all units', () => {
      expect(spend('clay')).toBe(true);
      expect(getRemaining('clay')).toBe(0);
      expect(canPlace('clay')).toBe(false);
      expect(spend('clay')).toBe(false);
    });

    it('returns false for invalid material type', () => {
      expect(spend('gold')).toBe(false);
    });

    it('spending one type does not affect others', () => {
      spend('sand');
      expect(getRemaining('timber')).toBe(3);
    });
  });

  // ── reset ─────────────────────────────────────────────────────────

  describe('reset', () => {
    it('sets all material counts to zero', () => {
      init({ sand: 20, clay: 10, stone: 6, timber: 4 });
      reset();
      expect(getBudget()).toEqual({ sand: 0, clay: 0, stone: 0, timber: 0 });
    });
  });
});

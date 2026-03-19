import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Houses module so we don't need Rapier initialisation
vi.mock('./Houses.js', () => ({
  getHouses: vi.fn(() => []),
}));

import { getHouses } from './Houses.js';
import { evaluateResult } from './WinLoss.js';

describe('WinLoss — evaluateResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('victory (all houses dry)', () => {
    it('should return victory when all houses are dry', () => {
      getHouses.mockReturnValue([
        { id: 1, flooded: false },
        { id: 2, flooded: false },
        { id: 3, flooded: false },
      ]);
      const result = evaluateResult(false);
      expect(result).toEqual({ result: 'victory', housesTotal: 3, housesSurvived: 3 });
    });

    it('should return victory with a single dry house', () => {
      getHouses.mockReturnValue([{ id: 1, flooded: false }]);
      const result = evaluateResult(false);
      expect(result).toEqual({ result: 'victory', housesTotal: 1, housesSurvived: 1 });
    });

    it('should return victory even when partial credit is enabled and all survive', () => {
      getHouses.mockReturnValue([
        { id: 1, flooded: false },
        { id: 2, flooded: false },
      ]);
      const result = evaluateResult(true);
      expect(result.result).toBe('victory');
    });
  });

  describe('partial credit', () => {
    it('should return partial when enabled and some houses survive', () => {
      getHouses.mockReturnValue([
        { id: 1, flooded: false },
        { id: 2, flooded: true },
        { id: 3, flooded: true },
      ]);
      const result = evaluateResult(true);
      expect(result).toEqual({ result: 'partial', housesTotal: 3, housesSurvived: 1 });
    });

    it('should return defeat when some survive but partial credit is disabled', () => {
      getHouses.mockReturnValue([
        { id: 1, flooded: false },
        { id: 2, flooded: true },
      ]);
      const result = evaluateResult(false);
      expect(result).toEqual({ result: 'defeat', housesTotal: 2, housesSurvived: 1 });
    });
  });

  describe('defeat', () => {
    it('should return defeat when all houses are flooded', () => {
      getHouses.mockReturnValue([
        { id: 1, flooded: true },
        { id: 2, flooded: true },
        { id: 3, flooded: true },
      ]);
      const result = evaluateResult(false);
      expect(result).toEqual({ result: 'defeat', housesTotal: 3, housesSurvived: 0 });
    });

    it('should return defeat when all flooded even with partial credit enabled', () => {
      getHouses.mockReturnValue([
        { id: 1, flooded: true },
        { id: 2, flooded: true },
      ]);
      const result = evaluateResult(true);
      expect(result).toEqual({ result: 'defeat', housesTotal: 2, housesSurvived: 0 });
    });
  });

  describe('edge cases', () => {
    it('should return victory with zero houses (vacuous truth)', () => {
      getHouses.mockReturnValue([]);
      const result = evaluateResult(false);
      expect(result).toEqual({ result: 'victory', housesTotal: 0, housesSurvived: 0 });
    });

    it('should default partialCreditEnabled to false', () => {
      getHouses.mockReturnValue([
        { id: 1, flooded: false },
        { id: 2, flooded: true },
      ]);
      const result = evaluateResult();
      expect(result.result).toBe('defeat');
    });
  });
});

// @vitest-environment jsdom

/**
 * TouchTargets — verifies all interactive UI elements meet the 48×48px
 * minimum touch target size.
 *
 * Validates: Requirements 13.8
 */

import { describe, it, expect, afterEach } from 'vitest';
import * as UndoButton from './UndoButton.js';
import * as BudgetDisplay from './BudgetDisplay.js';
import * as GameControls from './GameControls.js';

describe('Touch target compliance (Req 13.8)', () => {
  afterEach(() => {
    UndoButton.destroy();
    BudgetDisplay.destroy();
    GameControls.destroy();
  });

  describe('UndoButton', () => {
    it('has minimum 48×48px dimensions', () => {
      UndoButton.create(() => {});
      const btn = document.getElementById('undo-button');
      expect(btn).not.toBeNull();

      expect(parseFloat(btn.style.width)).toBeGreaterThanOrEqual(48);
      expect(parseFloat(btn.style.height)).toBeGreaterThanOrEqual(48);
      expect(parseFloat(btn.style.minWidth)).toBeGreaterThanOrEqual(48);
      expect(parseFloat(btn.style.minHeight)).toBeGreaterThanOrEqual(48);
    });

    it('remains compliant when visible', () => {
      UndoButton.create(() => {});
      UndoButton.setVisible(true);
      const btn = document.getElementById('undo-button');

      expect(parseFloat(btn.style.width)).toBeGreaterThanOrEqual(48);
      expect(parseFloat(btn.style.height)).toBeGreaterThanOrEqual(48);
    });
  });

  describe('BudgetDisplay', () => {
    it('is non-interactive (pointer-events: none)', () => {
      BudgetDisplay.create();
      const el = document.getElementById('budget-display');
      expect(el).not.toBeNull();
      expect(el.style.pointerEvents).toBe('none');
    });
  });

  describe('GameControls', () => {
    it('all buttons meet 48×48px minimum', () => {
      GameControls.create(() => {}, () => {});
      const toolbar = document.getElementById('game-controls');
      const allBtns = toolbar.querySelectorAll('button');

      for (const btn of allBtns) {
        expect(parseFloat(btn.style.minWidth)).toBeGreaterThanOrEqual(48);
        expect(parseFloat(btn.style.minHeight)).toBeGreaterThanOrEqual(48);
      }
    });
  });
});

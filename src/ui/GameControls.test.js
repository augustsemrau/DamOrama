// @vitest-environment jsdom

/**
 * GameControls tests — material selector, flood/drain buttons, touch targets.
 *
 * Validates: Requirements 13.8
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import * as GameControls from './GameControls.js';

describe('GameControls', () => {
  afterEach(() => {
    GameControls.destroy();
  });

  it('creates all expected DOM elements', () => {
    GameControls.create(() => {}, () => {});

    const toolbar = document.getElementById('game-controls');
    expect(toolbar).not.toBeNull();

    const matBtns = toolbar.querySelectorAll('.material-btn');
    expect(matBtns.length).toBe(4);

    expect(document.getElementById('flood-btn')).not.toBeNull();
    expect(document.getElementById('drain-btn')).not.toBeNull();
  });

  it('material buttons have correct background colors', () => {
    GameControls.create(() => {}, () => {});

    // JSDOM normalizes hex to rgb, so compare rgb values
    const expected = {
      sand: 'rgb(232, 193, 112)',
      clay: 'rgb(160, 82, 45)',
      stone: 'rgb(136, 136, 136)',
      timber: 'rgb(139, 105, 20)',
    };

    const toolbar = document.getElementById('game-controls');
    const matBtns = toolbar.querySelectorAll('.material-btn');
    for (const btn of matBtns) {
      const type = btn.dataset.material;
      expect(btn.style.background).toBe(expected[type]);
    }
  });

  it('selected material changes on click', () => {
    GameControls.create(() => {}, () => {});
    expect(GameControls.getSelectedMaterial()).toBe('sand');

    const toolbar = document.getElementById('game-controls');
    const stoneBtn = toolbar.querySelector('[data-material="stone"]');
    stoneBtn.click();
    expect(GameControls.getSelectedMaterial()).toBe('stone');

    const clayBtn = toolbar.querySelector('[data-material="clay"]');
    clayBtn.click();
    expect(GameControls.getSelectedMaterial()).toBe('clay');
  });

  it('setSelectedMaterial updates selection programmatically', () => {
    GameControls.create(() => {}, () => {});
    GameControls.setSelectedMaterial('timber');
    expect(GameControls.getSelectedMaterial()).toBe('timber');
  });

  it('flood button calls callback', () => {
    const onFlood = vi.fn();
    GameControls.create(onFlood, () => {});

    document.getElementById('flood-btn').click();
    expect(onFlood).toHaveBeenCalledTimes(1);
  });

  it('drain button calls callback', () => {
    const onDrain = vi.fn();
    GameControls.create(() => {}, onDrain);

    // Drain is hidden in construction phase, make it visible first
    GameControls.setPhase('flood');
    document.getElementById('drain-btn').click();
    expect(onDrain).toHaveBeenCalledTimes(1);
  });

  it('all buttons meet 48×48px minimum', () => {
    GameControls.create(() => {}, () => {});

    const toolbar = document.getElementById('game-controls');
    const allBtns = toolbar.querySelectorAll('button');
    expect(allBtns.length).toBeGreaterThanOrEqual(6); // 4 materials + flood + drain

    for (const btn of allBtns) {
      expect(parseFloat(btn.style.minWidth)).toBeGreaterThanOrEqual(48);
      expect(parseFloat(btn.style.minHeight)).toBeGreaterThanOrEqual(48);
    }
  });

  describe('phase visibility', () => {
    it('construction phase: material selector + flood visible, drain hidden', () => {
      GameControls.create(() => {}, () => {});
      GameControls.setPhase('construction');

      const toolbar = document.getElementById('game-controls');
      const matBtns = toolbar.querySelectorAll('.material-btn');
      for (const btn of matBtns) {
        expect(btn.style.display).not.toBe('none');
      }
      expect(document.getElementById('flood-btn').style.display).not.toBe('none');
      expect(document.getElementById('drain-btn').style.display).toBe('none');
    });

    it('flood phase: material selector + flood hidden, drain visible', () => {
      GameControls.create(() => {}, () => {});
      GameControls.setPhase('flood');

      const toolbar = document.getElementById('game-controls');
      const matBtns = toolbar.querySelectorAll('.material-btn');
      for (const btn of matBtns) {
        expect(btn.style.display).toBe('none');
      }
      expect(document.getElementById('flood-btn').style.display).toBe('none');
      expect(document.getElementById('drain-btn').style.display).not.toBe('none');
    });

    it('resolution phase: all controls hidden', () => {
      GameControls.create(() => {}, () => {});
      GameControls.setPhase('resolution');

      const toolbar = document.getElementById('game-controls');
      const matBtns = toolbar.querySelectorAll('.material-btn');
      for (const btn of matBtns) {
        expect(btn.style.display).toBe('none');
      }
      expect(document.getElementById('flood-btn').style.display).toBe('none');
      expect(document.getElementById('drain-btn').style.display).toBe('none');
    });
  });
});

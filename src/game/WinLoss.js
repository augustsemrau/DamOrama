/**
 * WinLoss — evaluates the game result at the end of the flood phase.
 *
 * Requirements: 10.7, 10.8
 */

import { getHouses } from './Houses.js';

/**
 * Evaluate the game result at the end of the flood phase.
 *
 * @param {boolean} partialCreditEnabled — whether partial credit is active for this level
 * @returns {{ result: 'victory'|'partial'|'defeat', housesTotal: number, housesSurvived: number }}
 */
export function evaluateResult(partialCreditEnabled = false) {
  const houses = getHouses();
  const housesTotal = houses.length;
  const housesSurvived = houses.filter(h => !h.flooded).length;

  let result;
  if (housesSurvived === housesTotal) {
    result = 'victory';
  } else if (partialCreditEnabled && housesSurvived > 0) {
    result = 'partial';
  } else {
    result = 'defeat';
  }

  return { result, housesTotal, housesSurvived };
}

/**
 * UndoSystem — Snapshot stack for construction phase.
 *
 * Captures bounding-box regions of the UnifiedGrid (terrain height,
 * material type, permeability) before each sculpt/placement action.
 * Supports undo by restoring the most recent snapshot.
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */

import {
  GRID_SIZE,
  getTerrainHeight,
  setTerrainHeight,
  getMaterialType,
  setMaterialType,
  getPermeability,
  setPermeability,
} from './UnifiedGrid.js';

const MAX_STACK = 20;

/** @type {Array<{x0:number, y0:number, x1:number, y1:number, terrainHeight:Float32Array, materialType:Uint8Array, permeability:Float32Array}>} */
const stack = [];

/**
 * Clamp a coordinate to valid grid range [0, GRID_SIZE-1].
 */
function clamp(v) {
  return Math.max(0, Math.min(GRID_SIZE - 1, v));
}

/**
 * Push a snapshot of a grid region before modification.
 * @param {number} x0 — min grid X
 * @param {number} y0 — min grid Y
 * @param {number} x1 — max grid X
 * @param {number} y1 — max grid Y
 */
export function pushSnapshot(x0, y0, x1, y1) {
  x0 = clamp(x0);
  y0 = clamp(y0);
  x1 = clamp(x1);
  y1 = clamp(y1);

  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const count = w * h;

  const terrainHeight = new Float32Array(count);
  const materialType = new Uint8Array(count);
  const permeability = new Float32Array(count);

  let i = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      terrainHeight[i] = getTerrainHeight(x, y);
      materialType[i] = getMaterialType(x, y);
      permeability[i] = getPermeability(x, y);
      i++;
    }
  }

  // Discard oldest when full (Req 12.4)
  if (stack.length >= MAX_STACK) {
    stack.shift();
  }

  stack.push({ x0, y0, x1, y1, terrainHeight, materialType, permeability });
}

/**
 * Pop and restore the most recent snapshot.
 * @returns {boolean} true if restored, false if stack empty
 */
export function undo() {
  if (stack.length === 0) return false;

  const snap = stack.pop();
  let i = 0;
  for (let y = snap.y0; y <= snap.y1; y++) {
    for (let x = snap.x0; x <= snap.x1; x++) {
      setTerrainHeight(x, y, snap.terrainHeight[i]);
      setMaterialType(x, y, snap.materialType[i]);
      setPermeability(x, y, snap.permeability[i]);
      i++;
    }
  }

  return true;
}

/**
 * Get the current stack depth.
 * @returns {number}
 */
export function getStackDepth() {
  return stack.length;
}

/**
 * Clear the undo stack (Req 12.5 — on transition to Flood_Phase).
 */
export function clear() {
  stack.length = 0;
}

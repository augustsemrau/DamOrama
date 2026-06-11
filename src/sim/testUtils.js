import { Grid } from '../core/Grid.js';
import { SIM_DT } from '../core/Constants.js';

export function makeGrid(width, height, terrainFn = () => 0) {
  const g = new Grid(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      g.terrainHeight[g.index(x, y)] = terrainFn(x, y);
    }
  }
  return g;
}

export function runSeconds(seconds, ...steppables) {
  const steps = Math.round(seconds / SIM_DT);
  for (let s = 0; s < steps; s++) {
    for (const obj of steppables) obj.step();
  }
}

// Easternmost column with water deeper than minDepth, or -1.
export function wetFrontX(grid, minDepth = 0.005) {
  let front = -1;
  for (let y = 0; y < grid.height; y++) {
    for (let x = grid.width - 1; x > front; x--) {
      if (grid.waterDepth[grid.index(x, y)] > minDepth) {
        front = x;
        break;
      }
    }
  }
  return front;
}

export function maxDepthInRegion(grid, x0, x1, y0, y1) {
  let max = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = grid.waterDepth[grid.index(x, y)];
      if (d > max) max = d;
    }
  }
  return max;
}

export function assertFinite(grid) {
  for (let i = 0; i < grid.cellCount; i++) {
    if (!Number.isFinite(grid.waterDepth[i]) || grid.waterDepth[i] < 0) {
      throw new Error(`bad depth ${grid.waterDepth[i]} at ${i}`);
    }
  }
}

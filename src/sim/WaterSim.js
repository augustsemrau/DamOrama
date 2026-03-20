import { STONE_BIT } from '../core/Constants.js';

const GRAVITY = 9.81;
const PIPE_AREA = 1.0;        // full pipe area — water flows fast downhill
const DAMPING = 1.0;          // no damping
const MIN_FLOW_DEPTH = 0.001; // water below this doesn't flow

// Flux layout: 4 floats per cell [N, S, E, W]
const F_N = 0, F_S = 1, F_E = 2, F_W = 3;

export class WaterSim {
  constructor() {
    this.grid = null;
    this.flux = null;
    this.fluxNew = null;
    this.velocity = null;
    this.substeps = 2;
    this.width = 0;
    this.height = 0;
    this.source = null;
  }

  init(grid, levelConfig) {
    this.grid = grid;
    this.width = grid.width;
    this.height = grid.height;
    const n = grid.cellCount;

    this.flux = new Float32Array(n * 4);
    this.fluxNew = new Float32Array(n * 4);
    this.velocity = new Float32Array(n * 2);
    this.substeps = levelConfig.sim?.substepsPerFrame ?? 3;
    this.source = levelConfig.waterSource ?? null;
  }

  setSource(source) {
    this.source = source;
  }

  step(dt) {
    const subDt = dt / this.substeps;
    for (let s = 0; s < this.substeps; s++) {
      this._injectSource(subDt);
      this._substep(subDt);
    }
  }

  _injectSource(dt) {
    const { source, grid } = this;
    if (!source) return;
    const { position, radius, flowRate, maxDepth } = source;
    const cx = position.x, cy = position.y;
    const r2 = radius * radius;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        const x = cx + dx, y = cy + dy;
        if (!grid.inBounds(x, y)) continue;
        const i = grid.index(x, y);
        grid.waterDepth[i] = Math.min(
          grid.waterDepth[i] + flowRate * dt,
          maxDepth
        );
      }
    }
  }

  _substep(dt) {
    const { grid, flux, fluxNew, width, height } = this;
    const { terrainHeight, materialHeight, waterDepth, occupancy } = grid;

    // --- Compute new flux into fluxNew (double-buffered) ---
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const fi = i * 4;

        if ((occupancy[i] & STONE_BIT) !== 0) {
          fluxNew[fi + F_N] = 0;
          fluxNew[fi + F_S] = 0;
          fluxNew[fi + F_E] = 0;
          fluxNew[fi + F_W] = 0;
          continue;
        }

        // Don't propagate flow from cells with very thin water film
        if (waterDepth[i] < MIN_FLOW_DEPTH) {
          fluxNew[fi + F_N] = 0;
          fluxNew[fi + F_S] = 0;
          fluxNew[fi + F_E] = 0;
          fluxNew[fi + F_W] = 0;
          continue;
        }

        const h = terrainHeight[i] + materialHeight[i] + waterDepth[i];

        // Helper: compute flux for one direction
        const computeFlux = (ni, prevFlux) => {
          if ((occupancy[ni] & STONE_BIT) !== 0) return 0;
          const nh = terrainHeight[ni] + materialHeight[ni] + waterDepth[ni];
          const dh = h - nh;
          // Apply damping to previous flux + pressure-driven acceleration
          const newFlux = prevFlux * DAMPING + GRAVITY * PIPE_AREA * dh * dt;
          return Math.max(0, newFlux);
        };

        // North (y-1)
        fluxNew[fi + F_N] = y > 0
          ? computeFlux((y - 1) * width + x, flux[fi + F_N])
          : 0;

        // South (y+1)
        fluxNew[fi + F_S] = y < height - 1
          ? computeFlux((y + 1) * width + x, flux[fi + F_S])
          : 0;

        // East (x+1)
        fluxNew[fi + F_E] = x < width - 1
          ? computeFlux(y * width + (x + 1), flux[fi + F_E])
          : 0;

        // West (x-1)
        fluxNew[fi + F_W] = x > 0
          ? computeFlux(y * width + (x - 1), flux[fi + F_W])
          : 0;

        // Clamp total outflux to available water
        const totalOut = fluxNew[fi + F_N] + fluxNew[fi + F_S]
          + fluxNew[fi + F_E] + fluxNew[fi + F_W];
        if (totalOut > 0) {
          const maxOut = waterDepth[i] / dt;
          if (totalOut > maxOut) {
            const scale = maxOut / totalOut;
            fluxNew[fi + F_N] *= scale;
            fluxNew[fi + F_S] *= scale;
            fluxNew[fi + F_E] *= scale;
            fluxNew[fi + F_W] *= scale;
          }
        }
      }
    }

    // --- Swap buffers ---
    const tmp = this.flux;
    this.flux = fluxNew;
    this.fluxNew = tmp;
    const activeFlux = this.flux;

    // --- Apply flux to update water depth ---
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if ((occupancy[i] & STONE_BIT) !== 0) continue;

        const fi = i * 4;
        let netFlux = 0;

        // Outgoing
        netFlux -= activeFlux[fi + F_N] + activeFlux[fi + F_S]
          + activeFlux[fi + F_E] + activeFlux[fi + F_W];

        // Incoming from neighbors
        if (y > 0) netFlux += activeFlux[((y - 1) * width + x) * 4 + F_S];
        if (y < height - 1) netFlux += activeFlux[((y + 1) * width + x) * 4 + F_N];
        if (x < width - 1) netFlux += activeFlux[(y * width + x + 1) * 4 + F_W];
        if (x > 0) netFlux += activeFlux[(y * width + x - 1) * 4 + F_E];

        waterDepth[i] += netFlux * dt;
        if (waterDepth[i] < 0) waterDepth[i] = 0;
      }
    }

    // --- Compute velocity from flux ---
    const vel = this.velocity;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const fi = i * 4;
        vel[i * 2] = (activeFlux[fi + F_E] - activeFlux[fi + F_W]) * 0.5;
        vel[i * 2 + 1] = (activeFlux[fi + F_S] - activeFlux[fi + F_N]) * 0.5;
      }
    }
  }

  reset() {
    this.grid.waterDepth.fill(0);
    this.flux.fill(0);
    this.fluxNew.fill(0);
    this.velocity.fill(0);
  }
}

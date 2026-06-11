import {
  SIM_DT, SUBSTEPS, GRAVITY, PIPE_K, FLUX_DAMPING, MIN_FLOW_DEPTH, CELL, CELL_AREA,
  FLOW_SPEED_CAP,
} from '../core/Constants.js';

// Virtual-pipes shallow water on the grid's height fields.
//
// The simulation contract (spec §10.3): step() always advances exactly SIM_DT
// of sim time regardless of render frame rate, and contains no randomness —
// the same build produces the same flood on every machine.
//
// Stone needs no special-casing here: a stone block is just tall, un-erodable
// material, so water flows around it (or over it, if the surface rises above
// its top) through the ordinary height-difference flux.
const F_N = 0, F_S = 1, F_E = 2, F_W = 3;

export class WaterSim {
  constructor(grid) {
    this.grid = grid;
    const n = grid.cellCount;
    this.flux = new Float32Array(n * 4);
    this.fluxNew = new Float32Array(n * 4);
    this.speed = new Float32Array(n);
    this.flowEnergy = 0;
    this.emitter = null;
    this.emitRemaining = 0;
    this._emitCells = null;
  }

  setEmitter(source) {
    this.emitter = source;
    this.emitRemaining = source ? source.duration : 0;
    this._emitCells = null;
    if (!source) return;
    const cells = [];
    const r2 = source.radius * source.radius;
    for (let dy = -source.radius; dy <= source.radius; dy++) {
      for (let dx = -source.radius; dx <= source.radius; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        const x = source.x + dx, y = source.y + dy;
        if (this.grid.inBounds(x, y)) cells.push(this.grid.index(x, y));
      }
    }
    this._emitCells = cells;
  }

  step() {
    const dt = SIM_DT / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS; s++) {
      this._inject(dt);
      this._substep(dt);
    }
  }

  _inject(dt) {
    if (!this.emitter || this.emitRemaining <= 0 || !this._emitCells?.length) return;
    const span = Math.min(dt, this.emitRemaining);
    const depthAdd = (this.emitter.rate * span) / (this._emitCells.length * CELL_AREA);
    const { waterDepth } = this.grid;
    for (const i of this._emitCells) waterDepth[i] += depthAdd;
    this.emitRemaining -= dt;
    if (this.emitRemaining < 0) this.emitRemaining = 0;
  }

  _substep(dt) {
    const { grid, flux, fluxNew } = this;
    const { width, height } = grid;
    const { terrainHeight, materialHeight, waterDepth } = grid;
    const accel = GRAVITY * PIPE_K * dt;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const fi = i * 4;
        const d = waterDepth[i];

        if (d < MIN_FLOW_DEPTH) {
          fluxNew[fi] = 0; fluxNew[fi + 1] = 0; fluxNew[fi + 2] = 0; fluxNew[fi + 3] = 0;
          continue;
        }

        const h = terrainHeight[i] + materialHeight[i] + d;

        let fN = 0, fS = 0, fE = 0, fW = 0;
        if (y > 0) {
          const n = i - width;
          const dh = h - (terrainHeight[n] + materialHeight[n] + waterDepth[n]);
          fN = Math.max(0, flux[fi + F_N] * FLUX_DAMPING + accel * dh);
        }
        if (y < height - 1) {
          const n = i + width;
          const dh = h - (terrainHeight[n] + materialHeight[n] + waterDepth[n]);
          fS = Math.max(0, flux[fi + F_S] * FLUX_DAMPING + accel * dh);
        }
        if (x < width - 1) {
          const n = i + 1;
          const dh = h - (terrainHeight[n] + materialHeight[n] + waterDepth[n]);
          fE = Math.max(0, flux[fi + F_E] * FLUX_DAMPING + accel * dh);
        }
        if (x > 0) {
          const n = i - 1;
          const dh = h - (terrainHeight[n] + materialHeight[n] + waterDepth[n]);
          fW = Math.max(0, flux[fi + F_W] * FLUX_DAMPING + accel * dh);
        }

        const total = fN + fS + fE + fW;
        if (total > 0) {
          const maxOut = (d * CELL_AREA) / dt;
          if (total > maxOut) {
            const k = maxOut / total;
            fN *= k; fS *= k; fE *= k; fW *= k;
          }
        }
        fluxNew[fi + F_N] = fN;
        fluxNew[fi + F_S] = fS;
        fluxNew[fi + F_E] = fE;
        fluxNew[fi + F_W] = fW;
      }
    }

    const tmp = this.flux;
    this.flux = fluxNew;
    this.fluxNew = tmp;
    const f = this.flux;

    // Apply net flux, then derive a per-cell flow speed for erosion/audio.
    const speed = this.speed;
    let energy = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const fi = i * 4;

        const inN = y > 0 ? f[(i - width) * 4 + F_S] : 0;
        const inS = y < height - 1 ? f[(i + width) * 4 + F_N] : 0;
        const inE = x < width - 1 ? f[(i + 1) * 4 + F_W] : 0;
        const inW = x > 0 ? f[(i - 1) * 4 + F_E] : 0;

        const out = f[fi] + f[fi + 1] + f[fi + 2] + f[fi + 3];
        const net = inN + inS + inE + inW - out;

        let d = waterDepth[i] + (net * dt) / CELL_AREA;
        if (d < 0) d = 0;
        waterDepth[i] = d;

        // Volume/s passing through the cell per axis → velocity through the
        // wetted cross-section. Thin sheets stay fast (that is what erodes
        // a crest), but the depth clamp keeps near-dry cells from exploding.
        const thruX = 0.5 * (f[fi + F_E] - f[fi + F_W] + inW - inE);
        const thruY = 0.5 * (f[fi + F_S] - f[fi + F_N] + inN - inS);
        const cross = CELL * Math.max(d, 0.01);
        let v = Math.hypot(thruX, thruY) / cross;
        if (v > FLOW_SPEED_CAP) v = FLOW_SPEED_CAP;
        speed[i] = v;
        energy += v * d;
      }
    }
    this.flowEnergy = energy;
  }

  reset() {
    this.flux.fill(0);
    this.fluxNew.fill(0);
    this.speed.fill(0);
    this.flowEnergy = 0;
    this.emitRemaining = 0;
  }
}

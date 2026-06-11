import { SIM_DT, MAX_STEPS_PER_FRAME } from '../core/Constants.js';
import { analyzeBreach } from './Postmortem.js';
import { starsForRemaining } from '../levels/index.js';

// The three-phase state machine: build → flood → verdict. Owns the fixed-step
// accumulator (the only place sim time advances) and the flood-start snapshot
// that makes retry an iteration instead of a restart.
export class GameLoop {
  constructor({ level, grid, sim, erosion, winLoss, budget, bus }) {
    this.level = level;
    this.grid = grid;
    this.sim = sim;
    this.erosion = erosion;
    this.winLoss = winLoss;
    this.budget = budget;
    this.bus = bus;
    this.phase = 'build';
    this.simTime = 0;
    this.fastForward = false;
    this._acc = 0;
    this._snapshot = null;
    this._erosionDirty = false;
    this._lastErosionEmit = 0;
    this.verdict = null;
  }

  get floodDuration() {
    return this.level.source.duration + this.level.settleTime;
  }

  releaseWater() {
    if (this.phase !== 'build') return;
    this._snapshot = {
      build: this.grid.snapshotBuild(),
      budget: this.budget.snapshot(),
    };
    this.grid.clearWater();
    this.sim.reset();
    this.erosion.resetStats();
    this.winLoss.reset();
    this.sim.setEmitter(this.level.source);
    this.simTime = 0;
    this._acc = 0;
    this.verdict = null;
    this.phase = 'flood';
    this.bus.emit('phase-changed', { phase: 'flood' });
  }

  // Advance with real elapsed seconds; sim moves in fixed SIM_DT steps only.
  tick(realDt) {
    if (this.phase !== 'flood') return;
    this._acc += realDt * (this.fastForward ? 2 : 1);
    const maxSteps = MAX_STEPS_PER_FRAME * (this.fastForward ? 2 : 1);
    let steps = 0;
    while (this._acc >= SIM_DT && steps < maxSteps) {
      this._acc -= SIM_DT;
      steps++;
      this.sim.step();
      if (this.erosion.step()) this._erosionDirty = true;
      this.simTime += SIM_DT;
      this.winLoss.check(this.simTime);
      if (this.simTime >= this.floodDuration) {
        this._finish();
        return;
      }
    }
    if (this._acc > SIM_DT * maxSteps) this._acc = SIM_DT * maxSteps; // anti-spiral
    if (this._erosionDirty && this.simTime - this._lastErosionEmit > 0.15) {
      this._erosionDirty = false;
      this._lastErosionEmit = this.simTime;
      this.bus.emit('terrain-changed', { reason: 'erosion' });
    }
    this.bus.emit('flood-progress', {
      simTime: this.simTime,
      duration: this.floodDuration,
      emitRemaining: this.sim.emitRemaining,
    });
  }

  _finish() {
    const won = this.winLoss.allDry();
    if (won) {
      const remaining = {
        sand: this.budget.left.sand,
        clay: this.budget.left.clay,
        stone: this.budget.left.stone,
      };
      this.verdict = {
        won: true,
        stars: starsForRemaining(this.level, remaining),
        remaining,
      };
    } else {
      this.verdict = {
        won: false,
        ...analyzeBreach(this.grid, this.erosion, this.winLoss, this.level),
      };
    }
    this.phase = 'verdict';
    this.bus.emit('phase-changed', { phase: 'verdict', verdict: this.verdict });
  }

  // Back to building with the flood-start build and budget restored exactly.
  retry() {
    if (this.phase !== 'verdict' && this.phase !== 'flood') return;
    if (this._snapshot) {
      this.grid.restoreBuild(this._snapshot.build);
      this.budget.restore(this._snapshot.budget);
    }
    this.grid.clearWater();
    this.sim.reset();
    this.winLoss.reset();
    this.simTime = 0;
    this.fastForward = false;
    this.phase = 'build';
    this.bus.emit('terrain-changed', { reason: 'retry' });
    this.bus.emit('phase-changed', { phase: 'build', verdict: this.verdict });
  }
}

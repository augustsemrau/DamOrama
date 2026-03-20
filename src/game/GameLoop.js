export class GameLoop {
  constructor(eventBus, levelConfig) {
    this._bus = eventBus;
    this._phase = 'construction';
    this._floodElapsed = 0;
    this._sourceDuration = levelConfig.waterSource.durationSec;
    this._settleTime = levelConfig.sim.settleTimeSec;
    this._startDelay = levelConfig.waterSource.startDelaySec ?? 0;
  }

  get phase() {
    return this._phase;
  }

  startFlood() {
    if (this._phase !== 'construction') return;
    this._phase = 'flood';
    this._floodElapsed = 0;
    this._bus.emit('phase-changed', { phase: 'flood' });
  }

  retry(resetFn) {
    if (this._phase === 'construction') return;
    if (resetFn) resetFn();
    this._phase = 'construction';
    this._floodElapsed = 0;
    this._bus.emit('phase-changed', { phase: 'construction' });
  }

  update(dt) {
    if (this._phase !== 'flood') return;

    this._floodElapsed += dt;

    const totalTime = this._sourceDuration + this._settleTime;
    if (this._floodElapsed >= totalTime) {
      this._phase = 'resolution';
      this._bus.emit('phase-changed', { phase: 'resolution' });
    }
  }

  isSourceActive() {
    if (this._phase !== 'flood') return false;
    return this._floodElapsed < this._sourceDuration;
  }
}

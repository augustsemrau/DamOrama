// Procedural Web Audio: no assets. Filtered-noise water loop whose gain
// follows total flow energy; a release whoosh; soft verdict tones.
// Silence during build (spec §11 / v0.4 audio priorities).
export class SoundScape {
  constructor() {
    this.ctx = null;
    this._gain = null;
    this._ready = false;
  }

  // Must be called from a user gesture.
  init() {
    if (this._ready) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const seconds = 2;
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        // Pink-ish noise via leaky integrator.
        const white = Math.random() * 2 - 1;
        last = 0.97 * last + 0.03 * white;
        data[i] = last * 3;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 650;
      this._gain = this.ctx.createGain();
      this._gain.gain.value = 0;
      src.connect(filter).connect(this._gain).connect(this.ctx.destination);
      src.start();
      this._ready = true;
    } catch { /* audio is a garnish, never a blocker */ }
  }

  setFlow(energy) {
    if (!this._ready) return;
    const target = Math.min(0.5, energy * 0.04);
    this._gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.25);
  }

  silence() {
    if (!this._ready) return;
    this._gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
  }

  release() {
    this._blip([180, 120], 0.7, 'lowpass', 900);
  }

  win() {
    this._notes([523, 659, 784], 0.16, 0.09);
  }

  lose() {
    this._notes([196, 155], 0.5, 0.06);
  }

  _notes(freqs, dur, vol) {
    if (!this._ready) return;
    freqs.forEach((f, n) => {
      const t0 = this.ctx.currentTime + n * dur * 0.9;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(g).connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    });
  }

  _blip(freqs, dur, type, cutoff) {
    if (!this._ready) return;
    const t0 = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(cutoff, t0);
    filter.frequency.exponentialRampToValueAtTime(freqs[1], t0 + dur);
    const g = this.ctx.createGain();
    g.gain.value = 0.35;
    src.connect(filter).connect(g).connect(this.ctx.destination);
    src.start(t0);
  }
}

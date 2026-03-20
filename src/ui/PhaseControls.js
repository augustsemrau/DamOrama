export class PhaseControls {
  constructor(container, eventBus, callbacks) {
    this._callbacks = callbacks;

    // Button container
    this._el = document.createElement('div');
    this._el.style.cssText =
      'position:absolute;bottom:24px;left:50%;transform:translateX(-50%);z-index:10;' +
      'display:flex;gap:12px;flex-direction:column;align-items:center;';
    container.appendChild(this._el);

    // Start Flood button with icon
    this._startBtn = this._createButton('\u{1F30A} Release the Flood', () => {
      if (this._callbacks.onStartFlood) this._callbacks.onStartFlood();
    });

    // Retry button
    this._retryBtn = this._createButton('\u{1F504} Try Again', () => {
      if (this._callbacks.onRetry) this._callbacks.onRetry();
    });
    this._retryBtn.style.display = 'none';

    // Hint text below start button
    this._hint = document.createElement('div');
    this._hint.style.cssText =
      'color:rgba(255,255,255,0.7);font:13px sans-serif;text-align:center;' +
      'text-shadow:0 1px 3px rgba(0,0,0,0.5);';
    this._hint.textContent = 'Build defenses to protect the houses, then release the flood';

    // Flood progress container
    this._floodBar = document.createElement('div');
    this._floodBar.style.cssText =
      'position:absolute;bottom:24px;left:50%;transform:translateX(-50%);z-index:10;' +
      'display:none;flex-direction:column;align-items:center;gap:6px;';
    container.appendChild(this._floodBar);

    const floodLabel = document.createElement('div');
    floodLabel.style.cssText =
      'color:#4af;font:bold 16px sans-serif;text-shadow:0 2px 4px rgba(0,0,0,0.5);';
    floodLabel.textContent = 'Flood in progress...';
    this._floodBar.appendChild(floodLabel);

    // Progress bar track
    const track = document.createElement('div');
    track.style.cssText =
      'width:200px;height:6px;background:rgba(0,0,0,0.4);border-radius:3px;overflow:hidden;';
    this._floodBar.appendChild(track);

    this._progressFill = document.createElement('div');
    this._progressFill.style.cssText =
      'width:0%;height:100%;background:#4af;border-radius:3px;transition:width 0.3s;';
    track.appendChild(this._progressFill);

    this._el.appendChild(this._startBtn);
    this._el.appendChild(this._hint);
    this._el.appendChild(this._retryBtn);

    eventBus.on('phase-changed', (data) => this._onPhaseChanged(data.phase));
  }

  /** Call each frame during flood to update progress bar */
  updateFloodProgress(elapsed, total) {
    const pct = Math.min(elapsed / total * 100, 100);
    this._progressFill.style.width = pct + '%';
  }

  _createButton(text, onClick) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText =
      'padding:14px 32px;font:16px sans-serif;border:none;border-radius:8px;' +
      'cursor:pointer;background:#e8c547;color:#1a1a2e;font-weight:bold;' +
      'box-shadow:0 3px 8px rgba(0,0,0,0.3);transition:transform 0.1s;';
    btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.05)');
    btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1)');
    btn.addEventListener('click', onClick);
    return btn;
  }

  _onPhaseChanged(phase) {
    switch (phase) {
      case 'construction':
        this._el.style.display = 'flex';
        this._startBtn.style.display = '';
        this._hint.style.display = '';
        this._retryBtn.style.display = 'none';
        this._floodBar.style.display = 'none';
        break;
      case 'flood':
        this._el.style.display = 'none';
        this._floodBar.style.display = 'flex';
        this._progressFill.style.width = '0%';
        break;
      case 'resolution':
        this._el.style.display = 'flex';
        this._startBtn.style.display = 'none';
        this._hint.style.display = 'none';
        this._retryBtn.style.display = '';
        this._floodBar.style.display = 'none';
        break;
    }
  }
}

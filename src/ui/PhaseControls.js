export class PhaseControls {
  /**
   * @param {HTMLElement} container — the #app div
   * @param {EventBus} eventBus
   * @param {{ onStartFlood: Function, onRetry: Function }} callbacks
   */
  constructor(container, eventBus, callbacks) {
    this._callbacks = callbacks;

    // Container for buttons
    this._el = document.createElement('div');
    this._el.style.cssText =
      'position:absolute;bottom:24px;left:50%;transform:translateX(-50%);z-index:10;display:flex;gap:12px;';
    container.appendChild(this._el);

    // Start Flood button
    this._startBtn = this._createButton('Start Flood', () => {
      if (this._callbacks.onStartFlood) this._callbacks.onStartFlood();
    });

    // Retry button
    this._retryBtn = this._createButton('Retry', () => {
      if (this._callbacks.onRetry) this._callbacks.onRetry();
    });
    this._retryBtn.style.display = 'none';

    this._el.appendChild(this._startBtn);
    this._el.appendChild(this._retryBtn);

    // Listen for phase changes
    eventBus.on('phase-changed', (data) => this._onPhaseChanged(data.phase));
  }

  _createButton(text, onClick) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText =
      'padding:12px 24px;font:16px sans-serif;border:none;border-radius:6px;' +
      'cursor:pointer;background:#e8c547;color:#1a1a2e;font-weight:bold;';
    btn.addEventListener('click', onClick);
    return btn;
  }

  _onPhaseChanged(phase) {
    switch (phase) {
      case 'construction':
        this._startBtn.style.display = '';
        this._retryBtn.style.display = 'none';
        break;
      case 'flood':
        this._startBtn.style.display = 'none';
        this._retryBtn.style.display = 'none';
        break;
      case 'resolution':
        this._startBtn.style.display = 'none';
        this._retryBtn.style.display = '';
        break;
    }
  }
}

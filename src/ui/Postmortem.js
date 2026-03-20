export class Postmortem {
  constructor(container, eventBus) {
    this._el = document.createElement('div');
    this._el.style.cssText =
      'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:20;' +
      'background:rgba(0,0,0,0.85);padding:24px 32px;border-radius:12px;' +
      'color:#eee;font:16px sans-serif;text-align:center;display:none;max-width:400px;';
    container.appendChild(this._el);

    eventBus.on('postmortem-ready', (data) => this._show(data));
    eventBus.on('phase-changed', (d) => {
      if (d.phase === 'construction') {
        this._el.style.display = 'none';
      }
    });
  }

  _show(data) {
    if (data.won) {
      this._el.innerHTML = `
        <h2 style="color:#4ecdc4;margin:0 0 12px;">All Houses Safe!</h2>
        <p>Your defenses held. Well done.</p>
      `;
    } else {
      const cause = data.failureCause === 'overtopped'
        ? 'Water overtopped your defenses.'
        : 'Water eroded through your defenses.';
      this._el.innerHTML = `
        <h2 style="color:#e85d4c;margin:0 0 12px;">Flood!</h2>
        <p><strong>${data.firstFloodedHouse}</strong> was flooded.</p>
        <p>${cause}</p>
      `;
    }
    this._el.style.display = '';
  }
}

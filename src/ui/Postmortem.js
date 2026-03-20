export class Postmortem {
  constructor(container, eventBus) {
    this._el = document.createElement('div');
    this._el.style.cssText =
      'position:absolute;top:45%;left:50%;transform:translate(-50%,-50%);z-index:20;' +
      'background:rgba(10,10,20,0.9);padding:28px 36px;border-radius:14px;' +
      'color:#eee;font:16px sans-serif;text-align:center;display:none;max-width:420px;' +
      'border:1px solid rgba(255,255,255,0.1);backdrop-filter:blur(4px);' +
      'box-shadow:0 8px 32px rgba(0,0,0,0.5);';
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
        <h2 style="color:#4ecdc4;margin:0 0 8px;font-size:24px;">All Houses Safe!</h2>
        <p style="margin:8px 0;opacity:0.8;">Your defenses held against the flood.</p>
        <p style="margin:12px 0 0;color:#4ecdc4;font-size:14px;">Well done! Try again with less material?</p>
      `;
    } else {
      const cause = data.failureCause === 'overtopped'
        ? 'Water overtopped your defenses.'
        : 'Water eroded through your defenses.';
      this._el.innerHTML = `
        <h2 style="color:#e85d4c;margin:0 0 8px;font-size:24px;">Flood!</h2>
        <p style="margin:8px 0;"><strong style="color:#f0c040;">${data.firstFloodedHouse}</strong> was flooded.</p>
        <p style="margin:4px 0;opacity:0.8;">${cause}</p>
        <p style="margin:12px 0 0;color:#aaa;font-size:14px;">Try building a stronger wall across the valley.</p>
      `;
    }
    this._el.style.display = '';
  }
}

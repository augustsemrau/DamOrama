export class BudgetDisplay {
  constructor(container, eventBus, initialBudget) {
    this._el = document.createElement('div');
    this._el.style.cssText =
      'position:absolute;top:8px;right:8px;z-index:10;' +
      'background:rgba(0,0,0,0.6);padding:8px 12px;border-radius:8px;' +
      'color:#eee;font:13px monospace;line-height:1.6;';
    container.appendChild(this._el);

    this._update(initialBudget);
    eventBus.on('budget-changed', (data) => this._update(data));

    eventBus.on('phase-changed', (d) => {
      this._el.style.display = d.phase === 'construction' ? '' : 'none';
    });
  }

  _update(data) {
    this._el.innerHTML =
      `Sand: ${data.sandVolume}<br>` +
      `Clay: ${data.clayVolume}<br>` +
      `Stone: ${data.stoneBlocks}`;
  }
}

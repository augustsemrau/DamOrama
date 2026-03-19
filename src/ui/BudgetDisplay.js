/**
 * BudgetDisplay — shows remaining material units as an HTML overlay.
 * Visible during Construction phase.
 *
 * Requirements: 11.5
 */

/** @type {HTMLDivElement|null} */
let container = null;

/** @type {Record<string, HTMLSpanElement>} */
let labels = {};

/**
 * Create the budget display DOM elements and append to document body.
 */
export function create() {
  container = document.createElement('div');
  container.id = 'budget-display';
  const s = container.style;
  s.position = 'fixed';
  s.top = '10px';
  s.left = '10px';
  s.background = 'rgba(0,0,0,0.7)';
  s.color = '#fff';
  s.padding = '12px';
  s.borderRadius = '8px';
  s.fontFamily = 'monospace';
  s.fontSize = '14px';
  s.zIndex = '100';
  s.pointerEvents = 'none';

  const types = ['sand', 'clay', 'stone', 'timber'];
  const colors = { sand: '#e8c170', clay: '#a0522d', stone: '#888', timber: '#8B6914' };

  for (const type of types) {
    const row = document.createElement('div');
    row.style.cssText = 'margin:4px 0;display:flex;align-items:center;gap:8px;';

    const dot = document.createElement('span');
    dot.style.cssText =
      `display:inline-block;width:12px;height:12px;border-radius:50%;background:${colors[type]};`;

    const label = document.createElement('span');
    label.textContent = `${type}: 0`;
    labels[type] = label;

    row.appendChild(dot);
    row.appendChild(label);
    container.appendChild(row);
  }

  document.body.appendChild(container);
}

/**
 * Update the displayed budget values.
 * @param {{ sand: number, clay: number, stone: number, timber: number }} budget
 */
export function update(budget) {
  if (!container) return;
  for (const [type, label] of Object.entries(labels)) {
    label.textContent = `${type}: ${budget[type] ?? 0}`;
  }
}

/**
 * Show or hide the budget display.
 * @param {boolean} visible
 */
export function setVisible(visible) {
  if (container) container.style.display = visible ? 'block' : 'none';
}

/**
 * Remove the budget display from the DOM.
 */
export function destroy() {
  if (container && container.parentNode) {
    container.parentNode.removeChild(container);
  }
  container = null;
  labels = {};
}

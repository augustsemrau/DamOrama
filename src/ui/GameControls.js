/**
 * GameControls — material selector + flood/drain buttons.
 * Bottom-center horizontal toolbar. All buttons ≥ 48×48px.
 *
 * Requirements: 13.8
 */

const MATERIALS = [
  { type: 'sand', label: 'Sand', color: '#e8c170' },
  { type: 'clay', label: 'Clay', color: '#a0522d' },
  { type: 'stone', label: 'Stone', color: '#888888' },
  { type: 'timber', label: 'Timber', color: '#8B6914' },
];

/** @type {HTMLDivElement|null} */
let toolbar = null;

/** @type {string} */
let selectedMaterial = 'sand';

/** @type {Record<string, HTMLButtonElement>} */
let materialButtons = {};

/** @type {HTMLButtonElement|null} */
let floodButton = null;

/** @type {HTMLButtonElement|null} */
let drainButton = null;

/** @type {string} */
let currentPhase = 'construction';

/**
 * Apply common 48×48 minimum touch-target styles to a button.
 * @param {HTMLButtonElement} btn
 */
function applyBaseStyle(btn) {
  const s = btn.style;
  s.width = '48px';
  s.height = '48px';
  s.minWidth = '48px';
  s.minHeight = '48px';
  s.border = '2px solid transparent';
  s.borderRadius = '8px';
  s.cursor = 'pointer';
  s.fontSize = '14px';
  s.fontWeight = 'bold';
  s.color = '#fff';
  s.textShadow = '0 1px 2px rgba(0,0,0,0.6)';
}

/**
 * Update visual highlight on material buttons.
 */
function updateMaterialHighlight() {
  for (const [type, btn] of Object.entries(materialButtons)) {
    btn.style.border = type === selectedMaterial
      ? '3px solid #fff'
      : '2px solid transparent';
  }
}

/**
 * Update button visibility based on current phase.
 */
function updatePhaseVisibility() {
  const isConstruction = currentPhase === 'construction';
  const isFlood = currentPhase === 'flood';

  for (const btn of Object.values(materialButtons)) {
    btn.style.display = isConstruction ? 'inline-block' : 'none';
  }
  if (floodButton) floodButton.style.display = isConstruction ? 'inline-block' : 'none';
  if (drainButton) drainButton.style.display = isFlood ? 'inline-block' : 'none';
}

/**
 * Create the game controls toolbar.
 * @param {() => void} onFlood — callback when flood button is clicked
 * @param {() => void} onDrain — callback when drain button is clicked
 */
export function create(onFlood, onDrain) {
  toolbar = document.createElement('div');
  toolbar.id = 'game-controls';
  const ts = toolbar.style;
  ts.position = 'fixed';
  ts.bottom = '10px';
  ts.left = '50%';
  ts.transform = 'translateX(-50%)';
  ts.display = 'flex';
  ts.gap = '8px';
  ts.alignItems = 'center';
  ts.zIndex = '100';
  ts.padding = '8px';
  ts.background = 'rgba(0,0,0,0.6)';
  ts.borderRadius = '12px';

  // Material selector buttons
  for (const mat of MATERIALS) {
    const btn = document.createElement('button');
    btn.className = 'material-btn';
    btn.dataset.material = mat.type;
    btn.textContent = mat.label;
    btn.title = mat.label;
    applyBaseStyle(btn);
    btn.style.background = mat.color;
    btn.addEventListener('click', () => {
      selectedMaterial = mat.type;
      updateMaterialHighlight();
    });
    materialButtons[mat.type] = btn;
    toolbar.appendChild(btn);
  }

  // Flood button
  floodButton = document.createElement('button');
  floodButton.id = 'flood-btn';
  floodButton.textContent = '🌊 Flood';
  floodButton.title = 'Trigger Flood';
  applyBaseStyle(floodButton);
  floodButton.style.background = '#2266cc';
  floodButton.addEventListener('click', () => { if (onFlood) onFlood(); });
  toolbar.appendChild(floodButton);

  // Drain button
  drainButton = document.createElement('button');
  drainButton.id = 'drain-btn';
  drainButton.textContent = '🔽 Drain';
  drainButton.title = 'Drain Water';
  applyBaseStyle(drainButton);
  drainButton.style.background = '#666666';
  drainButton.addEventListener('click', () => { if (onDrain) onDrain(); });
  toolbar.appendChild(drainButton);

  updateMaterialHighlight();
  updatePhaseVisibility();
  document.body.appendChild(toolbar);
}

/**
 * Remove all controls from the DOM.
 */
export function destroy() {
  if (toolbar && toolbar.parentNode) toolbar.parentNode.removeChild(toolbar);
  toolbar = null;
  materialButtons = {};
  floodButton = null;
  drainButton = null;
  selectedMaterial = 'sand';
  currentPhase = 'construction';
}

/**
 * Update visibility based on game phase.
 * @param {string} phase — 'construction' | 'flood' | 'resolution'
 */
export function setPhase(phase) {
  currentPhase = phase;
  updatePhaseVisibility();
}

/**
 * Get the currently selected material type.
 * @returns {string}
 */
export function getSelectedMaterial() {
  return selectedMaterial;
}

/**
 * Programmatically set the selected material.
 * @param {string} type
 */
export function setSelectedMaterial(type) {
  if (materialButtons[type]) {
    selectedMaterial = type;
    updateMaterialHighlight();
  }
}

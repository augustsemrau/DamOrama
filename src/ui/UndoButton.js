/**
 * UndoButton — 48×48px undo button + Ctrl+Z/Cmd+Z keyboard shortcut.
 * Only active during Construction phase.
 *
 * Requirements: 12.6, 12.7
 */

/** @type {HTMLButtonElement|null} */
let button = null;

/** @type {((e: KeyboardEvent) => void)|null} */
let keyHandler = null;

/**
 * Create the undo button and keyboard listener.
 * @param {() => void} onUndo — callback when undo is triggered
 */
export function create(onUndo) {
  button = document.createElement('button');
  button.id = 'undo-button';
  button.textContent = '↩';
  button.title = 'Undo (Ctrl+Z)';
  const s = button.style;
  s.position = 'fixed';
  s.bottom = '10px';
  s.left = '10px';
  s.width = '48px';
  s.height = '48px';
  s.minWidth = '48px';
  s.minHeight = '48px';
  s.fontSize = '24px';
  s.border = 'none';
  s.borderRadius = '8px';
  s.background = 'rgba(0,0,0,0.7)';
  s.color = '#fff';
  s.cursor = 'pointer';
  s.zIndex = '100';
  button.addEventListener('click', onUndo);
  document.body.appendChild(button);

  keyHandler = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      onUndo();
    }
  };
  window.addEventListener('keydown', keyHandler);
}

/**
 * Show or hide the undo button.
 * @param {boolean} visible
 */
export function setVisible(visible) {
  if (button) button.style.display = visible ? 'block' : 'none';
}

/**
 * Remove the undo button and keyboard listener.
 */
export function destroy() {
  if (button && button.parentNode) button.parentNode.removeChild(button);
  if (keyHandler) window.removeEventListener('keydown', keyHandler);
  button = null;
  keyHandler = null;
}

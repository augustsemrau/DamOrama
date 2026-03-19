/**
 * KeyboardInput — WASD camera controls with acceleration and damping.
 *
 * Controls:
 *   A/D: rotate camera horizontally around the diorama (azimuthal angle)
 *   W/S: tilt camera up/down (polar angle)
 *   Scroll wheel: zoom camera in/out (OrbitControls distance)
 *   Shift+scroll: resize sculpt brush radius
 *
 * All camera movement uses smooth acceleration (ramp up) and damping
 * (decelerate when key released).
 *
 * Exports:
 *   init(controls)   — bind keyboard/wheel listeners, store OrbitControls ref
 *   update(dt)       — call each frame to apply velocity to controls
 *   destroy()        — unbind all listeners, reset state
 *   onBrushResize(cb) — register callback for shift+scroll brush resize
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 */

// --- Configuration ---
const ACCEL = 2.5;          // rad/s² — acceleration when key held
const MAX_SPEED = 1.8;      // rad/s  — max angular velocity
const DAMPING = 0.88;       // per-frame multiplier when key released (0–1)
const VELOCITY_EPSILON = 0.001; // below this, snap velocity to 0

const ZOOM_SPEED = 0.08;    // distance change per wheel delta unit
const BRUSH_RESIZE_SPEED = 0.5; // brush radius change per wheel delta unit

// --- State ---
const keys = { w: false, a: false, s: false, d: false };

let azimuthVel = 0;  // horizontal rotation velocity (rad/s)
let polarVel = 0;    // vertical tilt velocity (rad/s)

/** @type {import('three/addons/controls/OrbitControls.js').OrbitControls | null} */
let controls = null;

let brushResizeCb = null;

// Bound handlers for cleanup
let boundKeyDown = null;
let boundKeyUp = null;
let boundWheel = null;

// --- Event Handlers ---

function onKeyDown(e) {
  const k = e.key.toLowerCase();
  if (k in keys) {
    keys[k] = true;
  }
}

function onKeyUp(e) {
  const k = e.key.toLowerCase();
  if (k in keys) {
    keys[k] = false;
  }
}

function onWheel(e) {
  if (!controls) return;

  if (e.shiftKey) {
    // Shift+scroll → brush resize
    e.preventDefault();
    const delta = -e.deltaY * BRUSH_RESIZE_SPEED * 0.01;
    if (brushResizeCb) {
      brushResizeCb({ delta });
    }
  } else {
    // Normal scroll → zoom
    e.preventDefault();
    const zoomDelta = e.deltaY * ZOOM_SPEED * 0.01;
    // Adjust OrbitControls distance by scaling the camera-to-target vector
    const offset = controls.object.position.clone().sub(controls.target);
    const newLen = Math.max(0.5, offset.length() * (1 + zoomDelta));
    offset.setLength(newLen);
    controls.object.position.copy(controls.target).add(offset);
  }
}

// --- Public API ---

/**
 * Initialise keyboard input. Binds keydown/keyup on window and wheel on
 * the controls' DOM element.
 * @param {import('three/addons/controls/OrbitControls.js').OrbitControls} orbitControls
 */
export function init(orbitControls) {
  controls = orbitControls;

  // Reset velocities
  azimuthVel = 0;
  polarVel = 0;
  keys.w = keys.a = keys.s = keys.d = false;

  boundKeyDown = onKeyDown;
  boundKeyUp = onKeyUp;
  boundWheel = onWheel;

  window.addEventListener('keydown', boundKeyDown);
  window.addEventListener('keyup', boundKeyUp);

  const domEl = controls.domElement || window;
  domEl.addEventListener('wheel', boundWheel, { passive: false });
}

/**
 * Per-frame update — apply acceleration when keys held, damping when released.
 * Modifies OrbitControls azimuthal and polar angles directly.
 * @param {number} dt — delta time in seconds
 */
export function update(dt) {
  if (!controls) return;

  // --- Horizontal rotation (A/D → azimuthal angle) ---
  const azimuthInput = (keys.a ? 1 : 0) - (keys.d ? 1 : 0);
  if (azimuthInput !== 0) {
    azimuthVel += azimuthInput * ACCEL * dt;
    azimuthVel = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, azimuthVel));
  } else {
    azimuthVel *= DAMPING;
    if (Math.abs(azimuthVel) < VELOCITY_EPSILON) azimuthVel = 0;
  }

  // --- Vertical tilt (W/S → polar angle) ---
  const polarInput = (keys.s ? 1 : 0) - (keys.w ? 1 : 0);
  if (polarInput !== 0) {
    polarVel += polarInput * ACCEL * dt;
    polarVel = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, polarVel));
  } else {
    polarVel *= DAMPING;
    if (Math.abs(polarVel) < VELOCITY_EPSILON) polarVel = 0;
  }

  // Apply angular deltas to OrbitControls via the spherical offset approach.
  // OrbitControls internally uses spherical coords; we rotate the camera
  // position around the target.
  if (azimuthVel !== 0 || polarVel !== 0) {
    const azimuthDelta = azimuthVel * dt;
    const polarDelta = polarVel * dt;

    // Use the internal rotate methods if available, otherwise manual spherical
    if (typeof controls.rotateLeft === 'function') {
      controls.rotateLeft(azimuthDelta);
    }
    if (typeof controls.rotateUp === 'function') {
      controls.rotateUp(polarDelta);
    }
    controls.update();
  }
}

/**
 * Remove all event listeners and reset state.
 */
export function destroy() {
  if (boundKeyDown) {
    window.removeEventListener('keydown', boundKeyDown);
  }
  if (boundKeyUp) {
    window.removeEventListener('keyup', boundKeyUp);
  }
  if (controls && boundWheel) {
    const domEl = controls.domElement || window;
    domEl.removeEventListener('wheel', boundWheel);
  }

  keys.w = keys.a = keys.s = keys.d = false;
  azimuthVel = 0;
  polarVel = 0;
  controls = null;
  brushResizeCb = null;
  boundKeyDown = null;
  boundKeyUp = null;
  boundWheel = null;
}

/**
 * Register callback for brush resize events (Shift+scroll).
 * @param {(e: {delta: number}) => void} cb
 */
export function onBrushResize(cb) {
  brushResizeCb = cb;
}

// --- Test helpers (exported for unit tests) ---
export const _test = {
  getKeys: () => ({ ...keys }),
  getVelocity: () => ({ azimuthVel, polarVel }),
  ACCEL,
  MAX_SPEED,
  DAMPING,
  VELOCITY_EPSILON,
};

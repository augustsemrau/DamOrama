/**
 * InputHandler — Pointer Events unified input system.
 *
 * Handles both touch and mouse uniformly via the Pointer Events API.
 * Distinguishes 1-finger vs 2-finger gestures using active pointer tracking.
 *
 * Gestures:
 *   1-finger drag on terrain → 'sculpt' event
 *   1-finger drag on empty basin → 'pan' event
 *   2-finger pinch distance change → 'brushResize' event
 *   2-finger rotation angle change → 'orbitCamera' event
 *   2-finger spread/pinch → 'zoom' event
 *   Long-press (500ms hold) → 'materialPicker' event
 *
 * Exports:
 *   init(canvas, camera, terrainMesh)
 *   destroy()
 *   onSculpt(cb), onPan(cb), onBrushResize(cb),
 *   onOrbitCamera(cb), onZoom(cb), onMaterialPicker(cb)
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7
 */

import * as THREE from 'three';

// --- State ---
let canvas = null;
let camera = null;
let terrainMesh = null;
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();

/** @type {Map<number, {x: number, y: number, startX: number, startY: number, startTime: number}>} */
const activePointers = new Map();

let longPressTimer = null;
const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_THRESHOLD = 10; // px — cancel long-press if moved more than this

// --- Callbacks ---
let sculptCb = null;
let panCb = null;
let brushResizeCb = null;
let orbitCameraCb = null;
let zoomCb = null;
let materialPickerCb = null;

// 2-finger gesture state
let prevPinchDist = null;
let prevPinchAngle = null;

// Bound handlers (for removeEventListener)
let boundPointerDown = null;
let boundPointerMove = null;
let boundPointerUp = null;
let boundPointerCancel = null;

// --- Helpers ---

/**
 * Convert pointer client coords to NDC and raycast against terrain.
 * @returns {{ hit: boolean, point: THREE.Vector3 | null }}
 */
function raycastTerrain(clientX, clientY) {
  if (!canvas || !camera || !terrainMesh) return { hit: false, point: null };

  const rect = canvas.getBoundingClientRect();
  pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;

  try {
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObject(terrainMesh, false);
    if (hits.length > 0) {
      return { hit: true, point: hits[0].point.clone() };
    }
  } catch (_) {
    // Raycast can fail if mesh geometry is not ready — treat as miss
  }
  return { hit: false, point: null };
}

function getDistance(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function getAngle(p1, p2) {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

function clearLongPress() {
  if (longPressTimer !== null) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

// --- Event Handlers ---

function onPointerDown(e) {
  // Only preventDefault for touch to avoid scroll — let mouse events pass to OrbitControls
  if (e.pointerType === 'touch') e.preventDefault();
  activePointers.set(e.pointerId, {
    x: e.clientX,
    y: e.clientY,
    startX: e.clientX,
    startY: e.clientY,
    startTime: performance.now(),
  });

  // Reset 2-finger state when a new pointer arrives
  if (activePointers.size === 2) {
    const [p1, p2] = [...activePointers.values()];
    prevPinchDist = getDistance(p1, p2);
    prevPinchAngle = getAngle(p1, p2);
    clearLongPress();
  }

  // Start long-press timer for single pointer
  if (activePointers.size === 1) {
    clearLongPress();
    const clientX = e.clientX;
    const clientY = e.clientY;
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      const { hit, point } = raycastTerrain(clientX, clientY);
      if (hit && materialPickerCb) {
        materialPickerCb({ position: point });
      }
    }, LONG_PRESS_MS);
  }
}

function onPointerMove(e) {
  if (e.pointerType === 'touch') e.preventDefault();
  const prev = activePointers.get(e.pointerId);
  if (!prev) return;

  const newX = e.clientX;
  const newY = e.clientY;

  // Cancel long-press if moved beyond threshold
  if (longPressTimer !== null) {
    const dx = newX - prev.startX;
    const dy = newY - prev.startY;
    if (Math.sqrt(dx * dx + dy * dy) > LONG_PRESS_MOVE_THRESHOLD) {
      clearLongPress();
    }
  }

  // Update stored position
  activePointers.set(e.pointerId, {
    ...prev,
    x: newX,
    y: newY,
  });

  if (activePointers.size === 1) {
    // --- 1-finger drag ---
    const dx = newX - prev.x;
    const dy = newY - prev.y;
    const { hit, point } = raycastTerrain(newX, newY);

    if (hit) {
      if (sculptCb) sculptCb({ position: point, dx, dy });
    } else {
      if (panCb) panCb({ dx, dy });
    }
  } else if (activePointers.size === 2) {
    // --- 2-finger gestures ---
    const [p1, p2] = [...activePointers.values()];
    const dist = getDistance(p1, p2);
    const angle = getAngle(p1, p2);

    if (prevPinchDist !== null) {
      // Pinch/spread → zoom
      const scaleFactor = dist / prevPinchDist;
      if (Math.abs(scaleFactor - 1) > 0.001 && zoomCb) {
        zoomCb({ scaleFactor });
      }

      // Pinch distance delta → brush resize
      const distDelta = dist - prevPinchDist;
      if (Math.abs(distDelta) > 0.5 && brushResizeCb) {
        brushResizeCb({ delta: distDelta });
      }
    }

    if (prevPinchAngle !== null) {
      // Rotation → orbit camera
      let angleDelta = angle - prevPinchAngle;
      // Normalise to [-PI, PI]
      if (angleDelta > Math.PI) angleDelta -= 2 * Math.PI;
      if (angleDelta < -Math.PI) angleDelta += 2 * Math.PI;

      if (Math.abs(angleDelta) > 0.005 && orbitCameraCb) {
        orbitCameraCb({ angleDelta });
      }
    }

    prevPinchDist = dist;
    prevPinchAngle = angle;
  }
}

function onPointerUp(e) {
  if (e.pointerType === 'touch') e.preventDefault();
  activePointers.delete(e.pointerId);
  clearLongPress();

  if (activePointers.size < 2) {
    prevPinchDist = null;
    prevPinchAngle = null;
  }
}

// --- Public API ---

/**
 * Initialise the input handler.
 * @param {HTMLCanvasElement} canvasEl
 * @param {THREE.Camera} cam
 * @param {THREE.Mesh} terrain
 */
export function init(canvasEl, cam, terrain) {
  canvas = canvasEl;
  camera = cam;
  terrainMesh = terrain;

  boundPointerDown = onPointerDown;
  boundPointerMove = onPointerMove;
  boundPointerUp = onPointerUp;
  boundPointerCancel = onPointerUp;

  canvas.addEventListener('pointerdown', boundPointerDown);
  canvas.addEventListener('pointermove', boundPointerMove);
  canvas.addEventListener('pointerup', boundPointerUp);
  canvas.addEventListener('pointercancel', boundPointerCancel);

  // Prevent default touch actions (scrolling, zooming) on the canvas
  canvas.style.touchAction = 'none';
}

/**
 * Remove all event listeners and reset state.
 */
export function destroy() {
  if (canvas) {
    canvas.removeEventListener('pointerdown', boundPointerDown);
    canvas.removeEventListener('pointermove', boundPointerMove);
    canvas.removeEventListener('pointerup', boundPointerUp);
    canvas.removeEventListener('pointercancel', boundPointerCancel);
  }
  clearLongPress();
  activePointers.clear();
  prevPinchDist = null;
  prevPinchAngle = null;
  canvas = null;
  camera = null;
  terrainMesh = null;
  sculptCb = null;
  panCb = null;
  brushResizeCb = null;
  orbitCameraCb = null;
  zoomCb = null;
  materialPickerCb = null;
}

/** Register callback for sculpt events (1-finger drag on terrain). */
export function onSculpt(cb) { sculptCb = cb; }

/** Register callback for pan events (1-finger drag on empty basin). */
export function onPan(cb) { panCb = cb; }

/** Register callback for brush resize events (2-finger pinch distance). */
export function onBrushResize(cb) { brushResizeCb = cb; }

/** Register callback for orbit camera events (2-finger rotation). */
export function onOrbitCamera(cb) { orbitCameraCb = cb; }

/** Register callback for zoom events (2-finger spread/pinch). */
export function onZoom(cb) { zoomCb = cb; }

/** Register callback for material picker events (long-press on terrain). */
export function onMaterialPicker(cb) { materialPickerCb = cb; }

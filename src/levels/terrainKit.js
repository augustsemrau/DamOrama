import { GRID_SIZE } from '../core/Constants.js';

// Composable heightfield authoring. Every level terrain is a deterministic
// stack of these named features — no noise files, no art dependency.

export function smoothstep(a, b, t) {
  const u = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

export function makeTerrain(size = GRID_SIZE) {
  return { size, h: new Float32Array(size * size) };
}

export function apply(t, fn) {
  const { size, h } = t;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      h[i] = fn(x, y, h[i]);
    }
  }
  return t;
}

// Linear west→east fall.
export function slopeWE(t, west, east) {
  const w = t.size - 1;
  return apply(t, (x, y, h) => h + west + (east - west) * (x / w));
}

// Gentle north→south tilt (positive raises the south edge).
export function tiltNS(t, amount) {
  const w = t.size - 1;
  return apply(t, (x, y, h) => h + amount * (y / w - 0.5));
}

// Carve a channel of given depth along a polyline (grid coords).
export function carvePath(t, points, halfWidth, depth, feather = halfWidth) {
  return carveChannels(t, [{ points, halfWidth, depth, feather }]);
}

// Carve several channels at once. Where channels overlap (e.g. at a fork)
// the deepest carve wins — depths do NOT stack, or junctions become pits.
export function carveChannels(t, channels) {
  return apply(t, (x, y, h) => {
    let carve = 0;
    for (const c of channels) {
      let d2 = Infinity;
      for (let p = 0; p < c.points.length - 1; p++) {
        d2 = Math.min(d2, distToSegment2(x, y, c.points[p], c.points[p + 1]));
      }
      const d = Math.sqrt(d2);
      const feather = c.feather ?? c.halfWidth;
      const amount = c.depth * (1 - smoothstep(c.halfWidth, c.halfWidth + feather, d));
      if (amount > carve) carve = amount;
    }
    return h - carve;
  });
}

// Raised round hill (or a dish, with negative height).
export function knoll(t, cx, cy, radius, height) {
  return apply(t, (x, y, h) => {
    const d = Math.hypot(x - cx, y - cy);
    return h + height * (1 - smoothstep(0, radius, d));
  });
}

// Raised border so the diorama holds water and reads as a tabletop basin.
export function rim(t, width, height) {
  const s = t.size - 1;
  return apply(t, (x, y, h) => {
    const edge = Math.min(x, y, s - x, s - y);
    return h + height * (1 - smoothstep(0, width, edge));
  });
}

// Tiny deterministic surface texture — visual interest, gameplay-neutral.
export function roughen(t, amplitude, seed = 1) {
  const rand = mulberry32(seed);
  const size = t.size;
  const coarse = new Float32Array(17 * 17);
  for (let i = 0; i < coarse.length; i++) coarse[i] = (rand() - 0.5) * 2;
  return apply(t, (x, y, h) => {
    const u = (x / (size - 1)) * 16, v = (y / (size - 1)) * 16;
    const x0 = Math.floor(u), y0 = Math.floor(v);
    const fx = u - x0, fy = v - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const c = (xx, yy) => coarse[Math.min(16, yy) * 17 + Math.min(16, xx)];
    const n =
      c(x0, y0) * (1 - sx) * (1 - sy) + c(x0 + 1, y0) * sx * (1 - sy) +
      c(x0, y0 + 1) * (1 - sx) * sy + c(x0 + 1, y0 + 1) * sx * sy;
    return h + amplitude * n;
  });
}

function distToSegment2(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let u = len2 === 0 ? 0 : ((px - a.x) * dx + (py - a.y) * dy) / len2;
  u = Math.min(1, Math.max(0, u));
  const ex = a.x + u * dx - px, ey = a.y + u * dy - py;
  return ex * ex + ey * ey;
}

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Build helpers (used by reference solutions and tests) ---

// Stamp a straight wall of material between two grid points.
// Returns the volume spent, in budget units (sum of heights placed).
export function stampWall(grid, a, b, halfThickness, height, materialId) {
  const minX = Math.max(0, Math.floor(Math.min(a.x, b.x) - halfThickness - 1));
  const maxX = Math.min(grid.width - 1, Math.ceil(Math.max(a.x, b.x) + halfThickness + 1));
  const minY = Math.max(0, Math.floor(Math.min(a.y, b.y) - halfThickness - 1));
  const maxY = Math.min(grid.height - 1, Math.ceil(Math.max(a.y, b.y) + halfThickness + 1));
  let spent = 0;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (distToSegment2(x, y, a, b) > halfThickness * halfThickness) continue;
      const i = grid.index(x, y);
      if (grid.isStone(i)) continue;
      const add = Math.max(0, height - grid.materialHeight[i]);
      if (add <= 0) continue;
      grid.materialHeight[i] += add;
      grid.materialId[i] = materialId;
      spent += add;
    }
  }
  return spent;
}

# Dam-Orama v0.4 Milestone 1: Water Toy + Performance Gate

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working water simulation toy — terrain with flowing water and camera controls — and verify it sustains 60fps at 128×128.

**Architecture:** Unified grid (flat typed arrays) provides all cell data. Water sim uses Virtual Pipes algorithm with internal flux/velocity buffers. Three.js WebGLRenderer renders terrain (event-driven updates) and water (per-frame updates). Tiny event bus decouples modules.

**Tech Stack:** JavaScript ES modules, Three.js (pinned), Vite, Vitest + jsdom

**Key docs:**
- Build design: `docs/superpowers/specs/2026-03-20-dam-orama-v04-build-design.md`
- Gameplay spec: `dam-orama-spec-v0.4-mvp.md`

---

## File Map

| File | Responsibility |
|------|---------------|
| `package.json` | Dependencies (pinned), scripts |
| `index.html` | Single-page shell with canvas container |
| `vite.config.js` | Vite config, esnext target |
| `src/core/Constants.js` | Material IDs, occupancy bits, dev mode flag |
| `src/core/EventBus.js` | Synchronous pub/sub |
| `src/core/Grid.js` | Typed array buffers + canonical accessors |
| `src/sim/WaterSim.js` | Virtual Pipes water simulation |
| `src/game/Level.js` | JSON loader + procedural terrain generator |
| `src/levels/level-01.json` | "The Basin" level data |
| `src/renderer/SceneBuilder.js` | Three.js scene, camera, lights, renderer |
| `src/renderer/TerrainMesh.js` | Terrain PlaneGeometry, event-driven updates |
| `src/renderer/WaterMesh.js` | Water PlaneGeometry, per-frame updates |
| `src/input/CameraControls.js` | OrbitControls + keyboard shortcuts |
| `src/main.js` | Bootstrap + render loop wiring |

Tests are co-located: `src/core/Grid.test.js`, `src/core/EventBus.test.js`, `src/sim/WaterSim.test.js`, `src/game/Level.test.js`.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.js`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "dam-orama",
  "version": "0.4.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest --run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "three": "0.172.0"
  },
  "devDependencies": {
    "jsdom": "28.1.0",
    "vite": "6.3.5",
    "vitest": "4.1.0"
  }
}
```

Note: exact versions pinned (no `^`), per spec §12.4.

- [ ] **Step 2: Create vite.config.js**

```js
import { defineConfig } from 'vite';

export default defineConfig({
  build: { target: 'esnext' },
  optimizeDeps: { esbuildOptions: { target: 'esnext' } },
  test: { environment: 'jsdom' }
});
```

- [ ] **Step 3: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dam-Orama</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #1a1a2e; }
    #app { width: 100%; height: 100%; position: relative; }
    canvas { display: block; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` generated, no errors.

- [ ] **Step 5: Verify dev server starts**

Run: `npm run dev` (kill after confirming it starts)
Expected: Vite prints local URL (http://localhost:5173)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json index.html vite.config.js
git commit -m "scaffold: Vite project with pinned Three.js, Vitest, jsdom"
```

---

### Task 2: Constants and EventBus

**Files:**
- Create: `src/core/Constants.js`
- Create: `src/core/EventBus.js`
- Create: `src/core/EventBus.test.js`

- [ ] **Step 1: Create Constants.js**

```js
// Material IDs
export const MAT_NONE = 0;
export const MAT_SAND = 1;
export const MAT_CLAY = 2;
export const MAT_STONE = 3;

// Occupancy bits
export const STONE_BIT = 1;
export const HOUSE_BIT = 2;

// Dev mode — enables bounds checking in Grid accessors
export const DEV_MODE = import.meta.env?.DEV ?? true;
```

- [ ] **Step 2: Write failing EventBus test**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from './EventBus.js';

describe('EventBus', () => {
  let bus;
  beforeEach(() => { bus = new EventBus(); });

  it('calls subscriber when event is emitted', () => {
    const calls = [];
    bus.on('test', (data) => calls.push(data));
    bus.emit('test', 42);
    expect(calls).toEqual([42]);
  });

  it('supports multiple subscribers', () => {
    const a = [], b = [];
    bus.on('x', (d) => a.push(d));
    bus.on('x', (d) => b.push(d));
    bus.emit('x', 1);
    expect(a).toEqual([1]);
    expect(b).toEqual([1]);
  });

  it('does not call unsubscribed listener', () => {
    const calls = [];
    const fn = (d) => calls.push(d);
    bus.on('x', fn);
    bus.off('x', fn);
    bus.emit('x', 1);
    expect(calls).toEqual([]);
  });

  it('does nothing when emitting event with no subscribers', () => {
    expect(() => bus.emit('nonexistent', 1)).not.toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/core/EventBus.test.js`
Expected: FAIL — cannot import EventBus

- [ ] **Step 4: Implement EventBus**

```js
export class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  on(event, fn) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(fn);
  }

  off(event, fn) {
    const list = this._listeners.get(event);
    if (!list) return;
    const idx = list.indexOf(fn);
    if (idx !== -1) list.splice(idx, 1);
  }

  emit(event, data) {
    const list = this._listeners.get(event);
    if (!list) return;
    for (const fn of list) fn(data);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/core/EventBus.test.js`
Expected: All 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/Constants.js src/core/EventBus.js src/core/EventBus.test.js
git commit -m "feat: add Constants and EventBus core modules"
```

---

### Task 3: Unified Grid

**Files:**
- Create: `src/core/Grid.js`
- Create: `src/core/Grid.test.js`

- [ ] **Step 1: Write failing Grid test**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { Grid } from './Grid.js';
import { MAT_SAND, MAT_STONE, STONE_BIT, HOUSE_BIT } from './Constants.js';

describe('Grid', () => {
  let grid;
  const W = 4, H = 4;

  beforeEach(() => {
    grid = new Grid(W, H);
  });

  it('initializes with correct dimensions', () => {
    expect(grid.width).toBe(W);
    expect(grid.height).toBe(H);
    expect(grid.cellCount).toBe(W * H);
  });

  it('all buffers start zeroed', () => {
    for (let i = 0; i < grid.cellCount; i++) {
      expect(grid.terrainHeight[i]).toBe(0);
      expect(grid.materialHeight[i]).toBe(0);
      expect(grid.waterDepth[i]).toBe(0);
      expect(grid.materialId[i]).toBe(0);
      expect(grid.occupancy[i]).toBe(0);
    }
  });

  it('index converts x,y to flat index', () => {
    expect(grid.index(0, 0)).toBe(0);
    expect(grid.index(1, 0)).toBe(1);
    expect(grid.index(0, 1)).toBe(W);
    expect(grid.index(3, 3)).toBe(3 * W + 3);
  });

  it('getSurfaceHeight returns terrain + material', () => {
    const i = grid.index(1, 2);
    grid.terrainHeight[i] = 0.5;
    grid.materialHeight[i] = 0.3;
    expect(grid.getSurfaceHeight(i)).toBeCloseTo(0.8);
  });

  it('getWaterSurfaceHeight returns surface + water', () => {
    const i = grid.index(1, 1);
    grid.terrainHeight[i] = 0.5;
    grid.materialHeight[i] = 0.2;
    grid.waterDepth[i] = 0.1;
    expect(grid.getWaterSurfaceHeight(i)).toBeCloseTo(0.8);
  });

  it('isBlocked checks STONE_BIT', () => {
    const i = grid.index(2, 2);
    expect(grid.isBlocked(i)).toBe(false);
    grid.occupancy[i] |= STONE_BIT;
    expect(grid.isBlocked(i)).toBe(true);
  });

  it('isHouse checks HOUSE_BIT', () => {
    const i = grid.index(0, 0);
    expect(grid.isHouse(i)).toBe(false);
    grid.occupancy[i] |= HOUSE_BIT;
    expect(grid.isHouse(i)).toBe(true);
  });

  it('inBounds validates coordinates', () => {
    expect(grid.inBounds(0, 0)).toBe(true);
    expect(grid.inBounds(3, 3)).toBe(true);
    expect(grid.inBounds(-1, 0)).toBe(false);
    expect(grid.inBounds(0, 4)).toBe(false);
    expect(grid.inBounds(4, 0)).toBe(false);
  });

  it('reset zeros all mutable buffers but preserves terrainHeight', () => {
    const i = grid.index(1, 1);
    grid.terrainHeight[i] = 1.0;
    grid.materialHeight[i] = 0.5;
    grid.waterDepth[i] = 0.3;
    grid.materialId[i] = MAT_SAND;
    grid.occupancy[i] = STONE_BIT;

    grid.reset();

    expect(grid.terrainHeight[i]).toBe(1.0);
    expect(grid.materialHeight[i]).toBe(0);
    expect(grid.waterDepth[i]).toBe(0);
    expect(grid.materialId[i]).toBe(0);
    expect(grid.occupancy[i]).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/Grid.test.js`
Expected: FAIL — cannot import Grid

- [ ] **Step 3: Implement Grid**

```js
import { STONE_BIT, HOUSE_BIT, DEV_MODE } from './Constants.js';

export class Grid {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.cellCount = width * height;

    this.terrainHeight = new Float32Array(this.cellCount);
    this.materialHeight = new Float32Array(this.cellCount);
    this.waterDepth = new Float32Array(this.cellCount);
    this.materialId = new Uint8Array(this.cellCount);
    this.occupancy = new Uint8Array(this.cellCount);
  }

  index(x, y) {
    if (DEV_MODE && !this.inBounds(x, y)) {
      throw new RangeError(`Grid index out of bounds: (${x}, ${y})`);
    }
    return y * this.width + x;
  }

  inBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  getSurfaceHeight(i) {
    return this.terrainHeight[i] + this.materialHeight[i];
  }

  getWaterSurfaceHeight(i) {
    return this.getSurfaceHeight(i) + this.waterDepth[i];
  }

  getRemainingMaterial(i) {
    return this.materialHeight[i];
  }

  isBlocked(i) {
    return (this.occupancy[i] & STONE_BIT) !== 0;
  }

  isHouse(i) {
    return (this.occupancy[i] & HOUSE_BIT) !== 0;
  }

  /** Reset all mutable state. Preserves terrainHeight. */
  reset() {
    this.materialHeight.fill(0);
    this.waterDepth.fill(0);
    this.materialId.fill(0);
    this.occupancy.fill(0);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/Grid.test.js`
Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/Grid.js src/core/Grid.test.js
git commit -m "feat: add Grid with typed array buffers and canonical accessors"
```

---

### Task 4: Level Loader + level-01.json

**Files:**
- Create: `src/levels/level-01.json`
- Create: `src/game/Level.js`
- Create: `src/game/Level.test.js`

- [ ] **Step 1: Create level-01.json**

Scaled to 128×128 from the spec's 256×256 (all positions halved, values retuned for smaller grid).

```json
{
  "id": "level-01",
  "name": "The Basin",
  "grid": { "width": 128, "height": 128, "cellSize": 0.125 },
  "terrain": {
    "type": "procedural",
    "profile": "single_valley",
    "flowDirection": "west_to_east",
    "valleyWidth": 28,
    "valleyDepth": 0.22
  },
  "waterSource": {
    "type": "pipe",
    "position": { "x": 14, "y": 64 },
    "radius": 3,
    "flowRate": 0.014,
    "maxDepth": 2.0,
    "durationSec": 18,
    "startDelaySec": 0
  },
  "houses": [
    { "id": "house-a", "position": { "x": 104, "y": 54 }, "footprint": { "w": 5, "h": 5 }, "floodThreshold": 0.05 },
    { "id": "house-b", "position": { "x": 110, "y": 64 }, "footprint": { "w": 5, "h": 5 }, "floodThreshold": 0.05 },
    { "id": "house-c", "position": { "x": 104, "y": 74 }, "footprint": { "w": 5, "h": 5 }, "floodThreshold": 0.05 }
  ],
  "resources": {
    "sandVolume": 800,
    "clayVolume": 450,
    "stoneBlocks": 6
  },
  "sim": {
    "substepsPerFrame": 2,
    "erosionThreshold": 0.35,
    "erosionRateSand": 0.003,
    "erosionRateClay": 0.001,
    "settleTimeSec": 8
  },
  "camera": {
    "initialPosition": { "x": 12, "y": 14, "z": 12 },
    "lookAt": { "x": 8, "y": 0, "z": 8 }
  }
}
```

- [ ] **Step 2: Write failing Level test**

```js
import { describe, it, expect } from 'vitest';
import { Level } from './Level.js';
import { Grid } from '../core/Grid.js';
import levelData from '../levels/level-01.json';

describe('Level', () => {
  it('creates a grid with dimensions from level data', () => {
    const { grid } = Level.load(levelData);
    expect(grid.width).toBe(128);
    expect(grid.height).toBe(128);
  });

  it('generates terrain with a valley profile', () => {
    const { grid } = Level.load(levelData);
    const centerY = 64;
    const edgeY = 0;
    const centerHeight = grid.terrainHeight[grid.index(64, centerY)];
    const edgeHeight = grid.terrainHeight[grid.index(64, edgeY)];
    // Valley center should be lower than edges
    expect(centerHeight).toBeLessThan(edgeHeight);
  });

  it('terrain has non-zero values', () => {
    const { grid } = Level.load(levelData);
    let hasNonZero = false;
    for (let i = 0; i < grid.cellCount; i++) {
      if (grid.terrainHeight[i] > 0) { hasNonZero = true; break; }
    }
    expect(hasNonZero).toBe(true);
  });

  it('returns level config alongside grid', () => {
    const { grid, config } = Level.load(levelData);
    expect(config.waterSource.flowRate).toBe(0.014);
    expect(config.houses).toHaveLength(3);
    expect(config.resources.sandVolume).toBe(800);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/game/Level.test.js`
Expected: FAIL — cannot import Level

- [ ] **Step 4: Implement Level.js**

```js
import { Grid } from '../core/Grid.js';

export class Level {
  /**
   * Load a level from JSON data.
   * @param {object} data — parsed level JSON
   * @returns {{ grid: Grid, config: object }}
   */
  static load(data) {
    const { width, height } = data.grid;
    const grid = new Grid(width, height);

    Level._generateTerrain(grid, data.terrain);

    return { grid, config: data };
  }

  static _generateTerrain(grid, terrain) {
    if (terrain.profile === 'single_valley') {
      Level._singleValley(grid, terrain);
    }
  }

  /**
   * West-to-east valley: terrain is higher at north/south edges,
   * lower in the center band. Slight west-to-east downslope to
   * guide water flow toward the houses.
   */
  static _singleValley(grid, terrain) {
    const { width, height } = grid;
    const centerY = height / 2;
    const halfValley = terrain.valleyWidth / 2;
    const baseHeight = 0.4;
    const rimHeight = baseHeight + terrain.valleyDepth;
    const eastSlope = 0.08; // total height drop west to east

    for (let y = 0; y < height; y++) {
      // Distance from valley center (0 = center, 1 = at rim edge)
      const distFromCenter = Math.abs(y - centerY) / halfValley;
      const valleyFactor = Math.min(distFromCenter, 1.0);
      // Smooth interpolation: valley floor → rim
      const smoothFactor = valleyFactor * valleyFactor * (3 - 2 * valleyFactor);

      for (let x = 0; x < width; x++) {
        // East slope: higher in west, lower in east
        const slopeFactor = 1.0 - (x / width);
        const h = baseHeight
          + smoothFactor * terrain.valleyDepth
          + slopeFactor * eastSlope;
        grid.terrainHeight[grid.index(x, y)] = h;
      }
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/game/Level.test.js`
Expected: All 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/levels/level-01.json src/game/Level.js src/game/Level.test.js
git commit -m "feat: add Level loader with single_valley terrain generator"
```

---

### Task 5: Water Simulation (Virtual Pipes)

**Files:**
- Create: `src/sim/WaterSim.js`
- Create: `src/sim/WaterSim.test.js`

- [ ] **Step 1: Write failing WaterSim test**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { WaterSim } from './WaterSim.js';
import { Grid } from '../core/Grid.js';

describe('WaterSim', () => {
  let grid, sim;
  const W = 8, H = 8;

  beforeEach(() => {
    grid = new Grid(W, H);
    // Flat terrain
    grid.terrainHeight.fill(0.1);
    sim = new WaterSim();
    sim.init(grid, {
      sim: { substepsPerFrame: 2 },
      waterSource: null
    });
  });

  it('init allocates flux and velocity buffers', () => {
    expect(sim.flux.length).toBe(W * H * 4);
    expect(sim.velocity.length).toBe(W * H * 2);
  });

  it('water spreads from a high cell to neighbors', () => {
    const center = grid.index(4, 4);
    grid.waterDepth[center] = 1.0;

    sim.step(1 / 60);

    // Center should have less water, neighbors should have more
    expect(grid.waterDepth[center]).toBeLessThan(1.0);
    const n = grid.index(4, 3);
    const s = grid.index(4, 5);
    const e = grid.index(5, 4);
    const w = grid.index(3, 4);
    const neighborWater = grid.waterDepth[n] + grid.waterDepth[s]
      + grid.waterDepth[e] + grid.waterDepth[w];
    expect(neighborWater).toBeGreaterThan(0);
  });

  it('total water is conserved (no source/drain)', () => {
    const center = grid.index(4, 4);
    grid.waterDepth[center] = 1.0;
    let totalBefore = 0;
    for (let i = 0; i < grid.cellCount; i++) totalBefore += grid.waterDepth[i];

    sim.step(1 / 60);

    let totalAfter = 0;
    for (let i = 0; i < grid.cellCount; i++) totalAfter += grid.waterDepth[i];
    expect(totalAfter).toBeCloseTo(totalBefore, 4);
  });

  it('water does not flow into blocked cells', () => {
    const center = grid.index(4, 4);
    grid.waterDepth[center] = 1.0;

    // Block east neighbor
    const east = grid.index(5, 4);
    grid.occupancy[east] = 1; // STONE_BIT

    sim.step(1 / 60);

    expect(grid.waterDepth[east]).toBe(0);
  });

  it('boundary cells have zero flux (closed basin)', () => {
    // Put water at edge
    const edge = grid.index(0, 4);
    grid.waterDepth[edge] = 1.0;

    sim.step(1 / 60);

    // Water should not disappear (no outflow at boundary)
    let total = 0;
    for (let i = 0; i < grid.cellCount; i++) total += grid.waterDepth[i];
    expect(total).toBeCloseTo(1.0, 4);
  });

  it('reset zeros water depth, flux, and velocity', () => {
    grid.waterDepth[grid.index(4, 4)] = 1.0;
    sim.step(1 / 60);

    sim.reset();

    for (let i = 0; i < grid.cellCount; i++) {
      expect(grid.waterDepth[i]).toBe(0);
    }
    for (let i = 0; i < sim.flux.length; i++) {
      expect(sim.flux[i]).toBe(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/sim/WaterSim.test.js`
Expected: FAIL — cannot import WaterSim

- [ ] **Step 3: Implement WaterSim**

```js
import { STONE_BIT } from '../core/Constants.js';

const GRAVITY = 9.81;
const PIPE_AREA = 1.0;   // cross-section area of virtual pipe
const MIN_DEPTH = 0.0001; // ignore cells with less water than this

// Flux layout: 4 floats per cell [N, S, E, W]
const F_N = 0, F_S = 1, F_E = 2, F_W = 3;

export class WaterSim {
  constructor() {
    this.grid = null;
    this.flux = null;
    this.velocity = null;
    this.substeps = 2;
    this.width = 0;
    this.height = 0;
  }

  init(grid, levelConfig) {
    this.grid = grid;
    this.width = grid.width;
    this.height = grid.height;
    const n = grid.cellCount;

    this.flux = new Float32Array(n * 4);
    this.velocity = new Float32Array(n * 2);
    this.substeps = levelConfig.sim?.substepsPerFrame ?? 2;
  }

  step(dt) {
    const subDt = dt / this.substeps;
    for (let s = 0; s < this.substeps; s++) {
      this._substep(subDt);
    }
  }

  _substep(dt) {
    const { grid, flux, width, height } = this;
    const { terrainHeight, materialHeight, waterDepth, occupancy } = grid;
    const cellCount = grid.cellCount;

    // --- Update flux ---
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if ((occupancy[i] & STONE_BIT) !== 0) {
          // Blocked cell: zero all flux
          flux[i * 4 + F_N] = 0;
          flux[i * 4 + F_S] = 0;
          flux[i * 4 + F_E] = 0;
          flux[i * 4 + F_W] = 0;
          continue;
        }

        const surface = terrainHeight[i] + materialHeight[i];
        const h = surface + waterDepth[i];

        // Compute flux to each neighbor
        // North (y-1)
        if (y > 0) {
          const ni = (y - 1) * width + x;
          if ((occupancy[ni] & STONE_BIT) === 0) {
            const nh = terrainHeight[ni] + materialHeight[ni] + waterDepth[ni];
            const dh = h - nh;
            flux[i * 4 + F_N] = Math.max(0, flux[i * 4 + F_N] + GRAVITY * PIPE_AREA * dh * dt);
          } else {
            flux[i * 4 + F_N] = 0;
          }
        } else {
          flux[i * 4 + F_N] = 0;
        }

        // South (y+1)
        if (y < height - 1) {
          const ni = (y + 1) * width + x;
          if ((occupancy[ni] & STONE_BIT) === 0) {
            const nh = terrainHeight[ni] + materialHeight[ni] + waterDepth[ni];
            const dh = h - nh;
            flux[i * 4 + F_S] = Math.max(0, flux[i * 4 + F_S] + GRAVITY * PIPE_AREA * dh * dt);
          } else {
            flux[i * 4 + F_S] = 0;
          }
        } else {
          flux[i * 4 + F_S] = 0;
        }

        // East (x+1)
        if (x < width - 1) {
          const ni = y * width + (x + 1);
          if ((occupancy[ni] & STONE_BIT) === 0) {
            const nh = terrainHeight[ni] + materialHeight[ni] + waterDepth[ni];
            const dh = h - nh;
            flux[i * 4 + F_E] = Math.max(0, flux[i * 4 + F_E] + GRAVITY * PIPE_AREA * dh * dt);
          } else {
            flux[i * 4 + F_E] = 0;
          }
        } else {
          flux[i * 4 + F_E] = 0;
        }

        // West (x-1)
        if (x > 0) {
          const ni = y * width + (x - 1);
          if ((occupancy[ni] & STONE_BIT) === 0) {
            const nh = terrainHeight[ni] + materialHeight[ni] + waterDepth[ni];
            const dh = h - nh;
            flux[i * 4 + F_W] = Math.max(0, flux[i * 4 + F_W] + GRAVITY * PIPE_AREA * dh * dt);
          } else {
            flux[i * 4 + F_W] = 0;
          }
        } else {
          flux[i * 4 + F_W] = 0;
        }

        // Clamp: total outflux must not exceed available water
        const totalOut = flux[i * 4 + F_N] + flux[i * 4 + F_S]
          + flux[i * 4 + F_E] + flux[i * 4 + F_W];
        if (totalOut > 0) {
          const maxOut = waterDepth[i] / dt;
          if (totalOut > maxOut) {
            const scale = maxOut / totalOut;
            flux[i * 4 + F_N] *= scale;
            flux[i * 4 + F_S] *= scale;
            flux[i * 4 + F_E] *= scale;
            flux[i * 4 + F_W] *= scale;
          }
        }
      }
    }

    // --- Apply flux to update water depth ---
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if ((occupancy[i] & STONE_BIT) !== 0) continue;

        let netFlux = 0;

        // Outgoing
        netFlux -= flux[i * 4 + F_N] + flux[i * 4 + F_S]
          + flux[i * 4 + F_E] + flux[i * 4 + F_W];

        // Incoming from neighbors
        if (y > 0) netFlux += flux[((y - 1) * width + x) * 4 + F_S]; // neighbor's south = our north
        if (y < height - 1) netFlux += flux[((y + 1) * width + x) * 4 + F_N];
        if (x < width - 1) netFlux += flux[(y * width + x + 1) * 4 + F_W];
        if (x > 0) netFlux += flux[(y * width + x - 1) * 4 + F_E];

        waterDepth[i] += netFlux * dt;
        if (waterDepth[i] < 0) waterDepth[i] = 0;
      }
    }

    // --- Compute velocity from flux (for erosion) ---
    const vel = this.velocity;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const fi = i * 4;
        // vx = (east_flux - west_flux) average
        vel[i * 2] = (flux[fi + F_E] - flux[fi + F_W]) * 0.5;
        // vy = (south_flux - north_flux) average
        vel[i * 2 + 1] = (flux[fi + F_S] - flux[fi + F_N]) * 0.5;
      }
    }
  }

  /**
   * Inject water at source cells.
   * Call this each frame during flood phase, before step().
   */
  injectSource(source, dt) {
    if (!source) return;
    const { grid } = this;
    const { position, radius, flowRate, maxDepth } = source;
    const cx = position.x, cy = position.y;
    const r2 = radius * radius;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        const x = cx + dx, y = cy + dy;
        if (!grid.inBounds(x, y)) continue;
        const i = grid.index(x, y);
        if (grid.waterDepth[i] < maxDepth) {
          grid.waterDepth[i] += flowRate * dt;
        }
      }
    }
  }

  reset() {
    this.grid.waterDepth.fill(0);
    this.flux.fill(0);
    this.velocity.fill(0);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/sim/WaterSim.test.js`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/sim/WaterSim.js src/sim/WaterSim.test.js
git commit -m "feat: add Virtual Pipes water simulation with conservation and blocking"
```

---

### Task 6: SceneBuilder (Three.js setup)

**Files:**
- Create: `src/renderer/SceneBuilder.js`

- [ ] **Step 1: Implement SceneBuilder**

No unit test for this module — it's Three.js wiring that requires a real canvas. Verified visually via the dev server.

```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class SceneBuilder {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(0x1a1a2e);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );

    // Lighting
    const hemi = new THREE.HemisphereLight(0xffeebb, 0x445566, 0.8);
    this.scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(5, 10, 5);
    this.scene.add(dir);

    // Handle resize
    this._onResize = () => {
      this.camera.aspect = container.clientWidth / container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', this._onResize);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  get canvas() {
    return this.renderer.domElement;
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/SceneBuilder.js
git commit -m "feat: add SceneBuilder with WebGLRenderer, camera, and lighting"
```

---

### Task 7: TerrainMesh (event-driven)

**Files:**
- Create: `src/renderer/TerrainMesh.js`

- [ ] **Step 1: Implement TerrainMesh**

```js
import * as THREE from 'three';

export class TerrainMesh {
  /**
   * @param {Grid} grid
   * @param {number} cellSize — world units per cell
   * @param {EventBus} eventBus
   */
  constructor(grid, cellSize, eventBus) {
    this.grid = grid;
    this.cellSize = cellSize;

    const worldW = grid.width * cellSize;
    const worldH = grid.height * cellSize;

    this.geometry = new THREE.PlaneGeometry(
      worldW, worldH,
      grid.width - 1, grid.height - 1
    );
    // Rotate plane from XY to XZ (horizontal)
    this.geometry.rotateX(-Math.PI / 2);

    // Earth tone vertex colors
    const colors = new Float32Array(this.geometry.attributes.position.count * 3);
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    // Center mesh at origin
    this.mesh.position.set(worldW / 2, 0, worldH / 2);

    this.updateGeometry();

    // Subscribe to terrain changes
    eventBus.on('terrain-changed', () => this.updateGeometry());
  }

  updateGeometry() {
    const pos = this.geometry.attributes.position;
    const col = this.geometry.attributes.color;
    const { grid } = this;
    const { width, height } = grid;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const vi = y * width + x;
        const gi = grid.index(x, y);
        const h = grid.getSurfaceHeight(gi);

        // Position: X and Z are set by PlaneGeometry, just update Y (height)
        pos.setY(vi, h);

        // Color: earth tones based on height
        const t = Math.min(h / 0.6, 1.0); // normalize
        const r = 0.45 + t * 0.2;  // warm brown
        const g = 0.35 + t * 0.15;
        const b = 0.2 + t * 0.05;
        col.setXYZ(vi, r, g, b);
      }
    }

    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/TerrainMesh.js
git commit -m "feat: add TerrainMesh with event-driven vertex updates"
```

---

### Task 8: WaterMesh (per-frame)

**Files:**
- Create: `src/renderer/WaterMesh.js`

- [ ] **Step 1: Implement WaterMesh**

```js
import * as THREE from 'three';

const WATER_THRESHOLD = 0.001; // minimum depth to show water
const HIDE_Y = -10;            // push invisible vertices below the scene

export class WaterMesh {
  /**
   * @param {Grid} grid
   * @param {number} cellSize
   */
  constructor(grid, cellSize) {
    this.grid = grid;
    this.cellSize = cellSize;

    const worldW = grid.width * cellSize;
    const worldH = grid.height * cellSize;

    this.geometry = new THREE.PlaneGeometry(
      worldW, worldH,
      grid.width - 1, grid.height - 1
    );
    this.geometry.rotateX(-Math.PI / 2);

    this.material = new THREE.MeshPhysicalMaterial({
      color: 0x3388cc,
      transparent: true,
      opacity: 0.6,
      roughness: 0.1,
      metalness: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.set(worldW / 2, 0, worldH / 2);
  }

  /** Call every frame during flood phase. */
  update() {
    const pos = this.geometry.attributes.position;
    const { grid } = this;
    const { width, height } = grid;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const vi = y * width + x;
        const gi = grid.index(x, y);

        if (grid.waterDepth[gi] > WATER_THRESHOLD) {
          pos.setY(vi, grid.getWaterSurfaceHeight(gi));
        } else {
          pos.setY(vi, HIDE_Y);
        }
      }
    }

    pos.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/WaterMesh.js
git commit -m "feat: add WaterMesh with per-frame water surface updates"
```

---

### Task 9: CameraControls

**Files:**
- Create: `src/input/CameraControls.js`

- [ ] **Step 1: Implement CameraControls**

```js
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class CameraControls {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {HTMLCanvasElement} canvas
   * @param {object} cameraConfig — { initialPosition, lookAt } from level JSON
   */
  constructor(camera, canvas, cameraConfig) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, canvas);

    // Constrain orbit
    this.controls.minDistance = 5;
    this.controls.maxDistance = 30;
    this.controls.minPolarAngle = 0.2;       // don't go below horizon
    this.controls.maxPolarAngle = Math.PI / 2.2; // don't go fully top-down
    this.controls.enablePan = false;
    this.controls.mouseButtons = {
      LEFT: null,     // LMB reserved for building
      MIDDLE: 2,      // MMB = dolly
      RIGHT: 0        // RMB = orbit
    };

    // Apply initial camera position
    if (cameraConfig) {
      const p = cameraConfig.initialPosition;
      camera.position.set(p.x, p.y, p.z);
      const t = cameraConfig.lookAt;
      this.controls.target.set(t.x, t.y, t.z);
    }

    this.controls.update();

    // Keyboard shortcuts
    this._defaultTarget = cameraConfig?.lookAt
      ? { x: cameraConfig.lookAt.x, y: cameraConfig.lookAt.y, z: cameraConfig.lookAt.z }
      : { x: 8, y: 0, z: 8 };

    this._onKeyDown = (e) => this._handleKey(e);
    window.addEventListener('keydown', this._onKeyDown);
  }

  _handleKey(e) {
    const angle = Math.PI / 4; // 45 degrees
    switch (e.key) {
      case 'q':
      case 'Q':
        this._rotateAroundTarget(-angle);
        break;
      case 'e':
      case 'E':
        this._rotateAroundTarget(angle);
        break;
      case 'f':
      case 'F':
        this.controls.target.set(
          this._defaultTarget.x,
          this._defaultTarget.y,
          this._defaultTarget.z
        );
        this.controls.update();
        break;
    }
  }

  _rotateAroundTarget(angle) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const x = offset.x * cos - offset.z * sin;
    const z = offset.x * sin + offset.z * cos;
    offset.x = x;
    offset.z = z;
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }

  update() {
    this.controls.update();
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    this.controls.dispose();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/input/CameraControls.js
git commit -m "feat: add CameraControls with OrbitControls and Q/E/F shortcuts"
```

---

### Task 10: Basin Walls

**Files:**
- Create: `src/renderer/BasinWalls.js`

- [ ] **Step 1: Implement BasinWalls**

```js
import * as THREE from 'three';

/**
 * Four vertical wall planes around the basin perimeter.
 */
export function createBasinWalls(scene, worldSize, wallHeight = 0.8) {
  const half = worldSize / 2;
  const material = new THREE.MeshStandardMaterial({
    color: 0x6b5b4f,
    roughness: 0.9,
    side: THREE.DoubleSide
  });

  const wallGeo = new THREE.PlaneGeometry(worldSize, wallHeight);
  const walls = [];

  // North wall (z = 0)
  const north = new THREE.Mesh(wallGeo, material);
  north.position.set(half, wallHeight / 2, 0);
  scene.add(north);
  walls.push(north);

  // South wall (z = worldSize)
  const south = new THREE.Mesh(wallGeo, material);
  south.position.set(half, wallHeight / 2, worldSize);
  south.rotation.y = Math.PI;
  scene.add(south);
  walls.push(south);

  // East wall (x = worldSize)
  const east = new THREE.Mesh(wallGeo.clone(), material);
  east.position.set(worldSize, wallHeight / 2, half);
  east.rotation.y = -Math.PI / 2;
  scene.add(east);
  walls.push(east);

  // West wall (x = 0)
  const west = new THREE.Mesh(wallGeo.clone(), material);
  west.position.set(0, wallHeight / 2, half);
  west.rotation.y = Math.PI / 2;
  scene.add(west);
  walls.push(west);

  return walls;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/BasinWalls.js
git commit -m "feat: add basin wall geometry for diorama perimeter"
```

---

### Task 11: main.js — Wire Everything Together

**Files:**
- Create: `src/main.js`

- [ ] **Step 1: Implement main.js**

```js
import { EventBus } from './core/EventBus.js';
import { Level } from './game/Level.js';
import { WaterSim } from './sim/WaterSim.js';
import { SceneBuilder } from './renderer/SceneBuilder.js';
import { TerrainMesh } from './renderer/TerrainMesh.js';
import { WaterMesh } from './renderer/WaterMesh.js';
import { CameraControls } from './input/CameraControls.js';
import { createBasinWalls } from './renderer/BasinWalls.js';
import levelData from './levels/level-01.json';

async function main() {
  const eventBus = new EventBus();

  // Load level
  const { grid, config } = Level.load(levelData);
  const cellSize = config.grid.cellSize;
  const worldSize = grid.width * cellSize;

  // Water simulation
  const waterSim = new WaterSim();
  waterSim.init(grid, config);

  // Renderer
  const container = document.getElementById('app');
  const scene = new SceneBuilder(container);

  // Terrain
  const terrain = new TerrainMesh(grid, cellSize, eventBus);
  scene.scene.add(terrain.mesh);

  // Water
  const water = new WaterMesh(grid, cellSize);
  scene.scene.add(water.mesh);

  // Basin walls
  createBasinWalls(scene.scene, worldSize);

  // Camera
  const camControls = new CameraControls(
    scene.camera, scene.canvas, config.camera
  );

  // --- FPS measurement ---
  let frameCount = 0;
  let fpsAccum = 0;
  const fpsDisplay = document.createElement('div');
  fpsDisplay.style.cssText =
    'position:absolute;top:8px;left:8px;color:#0f0;font:14px monospace;z-index:10;';
  container.appendChild(fpsDisplay);

  // Auto-start water for milestone 1 (no game loop yet)
  let simActive = true;

  // Render loop
  let lastTime = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min((now - lastTime) / 1000, 0.05); // cap at 50ms
    lastTime = now;

    if (simActive) {
      waterSim.injectSource(config.waterSource, dt);
      waterSim.step(dt);
      water.update();
    }

    camControls.update();
    scene.render();

    // FPS counter
    frameCount++;
    fpsAccum += dt;
    if (fpsAccum >= 1.0) {
      fpsDisplay.textContent = `FPS: ${Math.round(frameCount / fpsAccum)}`;
      frameCount = 0;
      fpsAccum = 0;
    }
  }

  requestAnimationFrame(loop);
}

main();
```

- [ ] **Step 2: Start dev server and verify visually**

Run: `npm run dev`

Open http://localhost:5173 in browser. Verify:
- Terrain is visible (brown-toned landscape with valley)
- Water appears at the west side and flows east through the valley
- Water pools in low areas
- Camera: RMB orbit, scroll zoom, Q/E rotate, F recenter
- FPS counter shows ≥ 60fps
- Water stops at grid edges (closed basin)

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: wire main.js — water toy with terrain, water sim, and camera"
```

---

### Task 12: Performance Validation

**Files:** None (manual test)

- [ ] **Step 1: Measure FPS**

Open dev tools Performance tab in Chrome. Record 10 seconds of the water flowing.

**Acceptance criteria:**
- Average FPS ≥ 60 at 128×128
- No frame exceeds 33ms (no stuttering)
- Water flows directionally from west source, pools in the valley, fills against east wall

- [ ] **Step 2: If FPS < 60**

If the performance gate fails, the plan is:
1. Profile: is the bottleneck in WaterSim.step() or in WaterMesh.update()?
2. If sim: reduce substeps to 1, or implement height-equalization fallback
3. If render: reduce geometry resolution to 64×64 for water mesh
4. Re-test until 60fps is achieved

Do NOT proceed to milestone 2 until this gate passes.

- [ ] **Step 3: Document result**

Add a short note to the commit:

```bash
git add -A
git commit -m "milestone 1 complete: water toy at 128×128 sustains 60fps

Measured: [X] fps average over 10 seconds on [hardware].
Water sim: Virtual Pipes, 2 substeps/frame.
Render: terrain (event-driven) + water (per-frame) PlaneGeometry."
```

---

## Milestone 1 Acceptance Checklist

Before proceeding to Milestone 2, verify all of these:

- [ ] 128×128 water sim + terrain render + water render sustains 60fps (measured)
- [ ] Water flows directionally from source, pools in low areas, stops at edges
- [ ] Total water volume is conserved (no sim leaks)
- [ ] Camera orbit/zoom/snap (Q/E/F) works
- [ ] All unit tests pass: `npm test`
- [ ] Dev server starts and renders without errors

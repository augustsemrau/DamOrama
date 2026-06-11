# Dam-Orama — Spec v0.5 (Gameplay-First Rebuild)

This spec replaces v0.4 as the authoritative document. It is a clean-room rebuild informed
by the v0.4 attempt, whose postmortem is summarized in §2 because the failures directly
shaped these decisions.

The core fantasy is unchanged: **a tactile flood-defence diorama.** You shape a small world
with your hands, then water tests your work honestly.

The loop is unchanged: **read the terrain → build a defence → release the water →
understand the failure → try again.**

What changes in v0.5 is the priority order. v0.4 was built simulation-first and never
became a game. v0.5 is built **gameplay-first**: every technical decision below exists to
serve a named play feature, and the simulation is treated as a game mechanic to be tuned by
tests — not a physics project to be admired.

---

## 1. Player Promise

In any 2-minute attempt the player can:

1. **Read** the terrain at a glance — where water will come from, where it wants to go,
   where the houses are.
2. **Build** with pleasure — material mounds up under the brush instantly, smoothing feels
   like wet sand, mistakes are erasable.
3. **Commit** — pressing *Release the Water* is a real moment with anticipation.
4. **Watch honestly** — water follows the terrain believably; if the defence fails, the
   failure is visible as it happens (water creeping up a wall, sand washing away).
5. **Learn** — the verdict screen points at the breach and names the cause in plain words.
6. **Iterate** — retry keeps the build intact, so the next attempt starts from "fix that
   one spot", not from zero.

---

## 2. What v0.4 Taught Us (and what it forces)

| v0.4 failure | Root cause | v0.5 rule |
|---|---|---|
| Water never reached the houses; tuning took 9+ blind iterations | Sim stepped with the *render* frame's dt → behavior depended on frame rate; headless ≠ browser | **Fixed-timestep sim** (accumulator pattern). Identical behavior at any fps. Flood timing is defined in *sim seconds*. |
| Tuning was screenshot-guesswork | No objective definition of "water behaves correctly" | **Sim behavior is unit-tested**: propagation speed, pooling, overtopping, erosion, and per-level solvability (undefended level floods; reference build wins) are all asserted headlessly. Tuning means making tests pass. |
| 256×256 grid: slow propagation, slow CPU | Resolution chosen for looks, not play | **128×128, locked.** No quality tiers in MVP. The diorama is small; readability beats fidelity. |
| One level, never fun | A puzzle game with one puzzle proves nothing | **Three levels**, each teaching exactly one lesson (§6). |
| Retry meant rebuilding from scratch | "Fast restart" was interpreted as "fast wipe" | **Retry preserves the build** (§4.4). The build is snapshotted at flood start and restored on retry, including budget. |
| Flat, unreadable world | Terrain authored as an afterthought | Terrain is authored per level from named features (valley, fork, knoll) with explicit play intent (§6). |

Everything else from v0.4's scoping held up and is retained: fixed base terrain (no
excavation), three materials, two failure modes, static houses, static stone, no Rapier,
no WebGPU, desktop-first.

---

## 3. Design Pillars

1. **Tactile construction** — building must be fun even before the water comes.
2. **Readable water** — a player can always answer "where did it get through?" by looking.
3. **Small-world stakes** — the houses are warm, fragile, and worth protecting.
4. **The retry is the game** — failure must cost seconds, not minutes, and each retry
   starts from the previous design.
5. **No hidden rules, no lies** — deterministic sim; same build → same outcome, every
   time, on every machine. The postmortem is mandatory and honest.

---

## 4. Core Experience Loop

### 4.1 Build phase
World paused, no timer. The player paints **sand** and **clay**, places **stone blocks**,
**smooths**, **removes** (full refund), and **undoes**. A budget panel shows remaining
material. The water source is clearly marked (pipe mouth + idle trickle/glow) so the threat
is legible before it exists.

### 4.2 Flood phase
Triggered by the **Release the Water** button (with a brief valve-turn beat — anticipation
matters). The source emits for a fixed duration in sim-seconds, then stops; the water then
settles for a fixed window. During flood: camera only — no edits. A slim **flood timeline
bar** shows progress through emit + settle so the player knows how long is left.
A **2× fast-forward** toggle is always available (it runs more sim steps per frame —
deterministic, identical outcome).

### 4.3 Verdict phase
- **Win** — all houses dry after settle: stars awarded by leftover budget (§7).
- **Loss** — the moment a house floods, it visibly reacts (darkens, water tint); the sim
  keeps running so the player sees the full consequence, and the verdict appears at flood
  end with the **postmortem** (§8).

### 4.4 Retry
One click. Water cleared, build and budget **restored to the snapshot taken at flood
start** (so erosion damage is healed). The player tweaks and re-releases. A separate
**Clear All** button wipes the build and refunds everything.

### Attempt duration targets (unchanged from v0.4)
Build 30–120 s · Flood + settle 20–30 s (10–15 s fast-forwarded) · Verdict 5–10 s.

---

## 5. Play Features

### 5.1 Materials
| Material | Cost model | Behaviour | Role in play |
|---|---|---|---|
| **Sand** | volume units, cheap (large budget) | erodes quickly under fast flow | fast bulk — great walls until the water runs hard at them |
| **Clay** | volume units, scarce (small budget) | erodes ~10× slower than sand | the sealing material — spend it where the water hits hardest |
| **Stone** | per block, very scarce (2–6 per level) | impermeable, immovable, never erodes; water flows around/over it only if submerged above its top | the anchor — plug a narrow choke, armor a corner |

Material identity is per cell: the last material painted on a cell owns it. Stone is a
discrete block (6×6 cells, fixed height) stamped into the grid, removable in build phase.

### 5.2 Tools
- **Paint** (sand/clay): gaussian-falloff brush, adjustable radius, height accumulates per
  stroke, budget drains by deposited volume. Hover shows a projected brush ring.
- **Smooth**: volume-conserving blur of *placed material only* within the brush. Free.
- **Remove**: erases placed material under the brush, refunds the full volume.
- **Undo** (Ctrl/Cmd+Z): per-stroke sparse diffs, includes budget.
- **Stone place / remove**: click to stamp, click placed block to remove (build phase only).

### 5.3 Failure modes (both must be *watchable*, not just detectable)
1. **Overtopping** — water rises above a crest and spills. Readable because water level
   visibly climbs the wall face before spilling.
2. **Erosion** — flow speed above a threshold removes sand (fast) and clay (slowly);
   eroding cells darken, the notch deepens, then the breach gushes. Eroded material is
   simply removed (no sediment transport in MVP).

### 5.4 Camera & input (desktop)
LMB paint/place · RMB-drag orbit · wheel zoom · Q/E rotate 45° · F refocus ·
[ / ] or slider for brush size · Ctrl/Cmd+Z undo. One gesture = one purpose.
Touch is out of scope for v0.5 (architecture must not preclude it; no polish).

### 5.5 Houses
3 per level, warmest objects in the scene (lit windows, saturated walls, chimney). Static
footprints with flood sensors: a house floods when **average water depth over its
footprint** exceeds a threshold — no single-cell flickers. Flooded state is latched and
visible (darkened, water-stained, window lights go out).

### 5.6 Progression & persistence
A minimal level-select strip (Level 1/2/3 with earned stars) shown at start and after a
win. Stars persist in `localStorage`. Levels unlock in order; Level 1 is always open.

### 5.7 Audio (polish tier — cut first if needed)
Procedural Web Audio only, no assets: filtered-noise water loop with gain tied to total
flow energy, a release whoosh, a soft win chime / low loss tone. Silence during build.

---

## 6. Levels — one lesson each

All terrains are procedurally authored from named primitives (slope, valley, fork, knoll,
rim) with deterministic parameters — no noise files, no art dependency. Each level ships
with a **reference solution** encoded in its test (§10): the level is *proven* winnable and
*proven* losable in CI forever.

### Level 1 — “The Valley” · lesson: *block the channel*
West pipe feeds a single valley running west→east; three houses on the valley floor to the
east. A generous sand budget and a short, gentle flood. Any decent wall across the valley
wins. Teaches: painting, smoothing, the release loop, reading water.
*Star pressure:* winning is easy — winning with 50% sand left takes a deliberately narrow,
well-placed wall.

### Level 2 — “The Fork” · lesson: *the right material in the right place*
The valley splits around a central knoll into two channels; houses sit in both branches.
The flood is longer and faster. A sand-only dam in the *narrow, fast* north channel erodes
through before the emitter stops — the player must spend scarce clay (or a stone block) at
the choke and use cheap sand on the *wide, slow* south channel. Teaches: erosion, material
identity, watching a wall degrade.

### Level 3 — “The Plain” · lesson: *you can't block everything — redirect*
A wide, shallow front: the source feeds a broad fan with no single chokepoint. Houses
cluster on a low knoll, and a deep **sacrificial basin** sits to one side. The total budget
is far too small to wall the whole front — the winning shape is a pair of angled deflector
walls steering the flood into the basin. Teaches: thinking in flow, not in walls.

Level data is code (one JS module per level): terrain function, source position/rate/
duration, house placements, budgets, star thresholds, sensor threshold, settle time.

---

## 7. Stars

Stars reward efficiency: 1★ win · 2★ win with ≥ 25% of total budget value remaining ·
3★ with ≥ 50% remaining (thresholds tunable per level). Budget value = sand units + clay
units × clay weight + stone blocks × stone weight, so hoarding cheap sand can't buy stars
that clay spending earned. Stars display on the level select and the win screen.

---

## 8. Postmortem (mandatory on every loss)

At the moment the first house floods, the game records a snapshot. The verdict screen
shows, in plain words, one of three causes, with a 3D beacon at the named spot:

- **“Overtopped here”** — the defence cell where the deepest water stood above placed
  material that water then crossed.
- **“Eroded through here”** — the defence cell that lost the most height to erosion on a
  high-flow path.
- **“The water was never blocked”** — no defence stood in the flow path; beacon at the
  highest-flow cell adjacent to the flooded house.

Heuristic, not path-traced — good enough to point the next attempt. The beacon persists
into the next build phase until the player edits.

---

## 9. Aesthetic Direction (unchanged in spirit)

Quiet, focused, tactile, slightly melancholy miniature. Priorities:
1. Wet vs dry reads instantly (water has depth-tinted alpha; wet sand darkens).
2. Houses pop — the only saturated warm objects.
3. The basin reads as a tabletop diorama: visible walls, soft sky, gentle key light.
4. Materials are unmistakable: sand warm tan, clay red-brown, stone cool grey.

---

## 10. Technical Design

### 10.1 Stack
Pure JS ES modules · Three.js `0.172.0` (pinned) · Vite · Vitest + jsdom.
No TypeScript, no frameworks, no physics engine.

### 10.2 Architecture (layered, event-driven — carried over from v0.4, it was sound)
- `src/core/` — `Grid` (flat typed arrays: `terrainHeight`, `materialHeight`,
  `waterDepth`, `materialId`, `occupancy`; canonical accessors), `EventBus`, `Constants`.
- `src/sim/` — `WaterSim` (virtual pipes, fixed step), `Erosion`.
- `src/game/` — `GameLoop` (Build→Flood→Verdict state machine, snapshot/restore),
  `EditTools`, `Budget`, `UndoSystem`, `WinLoss`, `Postmortem` (analysis), `Progress`.
- `src/levels/` — `level1.js`, `level2.js`, `level3.js`, shared `terrainKit.js`.
- `src/render/` — `SceneBuilder`, `TerrainMesh` (event-driven updates only),
  `WaterMesh` (per-frame during flood only), `Houses`, `StoneBlocks`, `Beacon`.
- `src/input/` — `CameraControls`, `PointerInput` (raycast against ground plane).
- `src/ui/` — HTML overlay: `Toolbar`, `BudgetPanel`, `PhaseControls`, `Timeline`,
  `VerdictModal`, `LevelSelect`.
- `src/audio/` — `SoundScape` (procedural, optional).

### 10.3 The simulation contract (the heart of v0.5)
- **Fixed timestep.** `SIM_DT = 1/60` sim-seconds, 2 internal substeps. The render loop
  accumulates real time and steps the sim 0..4 times per frame (clamped; fast-forward
  doubles the step budget). Sim time is the only clock for flood duration, settle, and
  win/loss checks.
- **Deterministic.** No `Math.random()` in the sim path. Same build → same outcome.
- **Tested, not eyeballed.** Vitest suites assert, in pure JS with no renderer:
  - water released on a slope reaches a target column within N sim-seconds;
  - water pools level in a bowl (volume conserved within tolerance);
  - water overtops a low wall but not a high one;
  - sustained fast flow erodes sand through, clay slower, stone never;
  - **per level**: undefended run floods ≥1 house before flood end; the encoded
    reference build keeps all houses dry. These are the design's regression armor —
    any future tuning change that breaks winnability fails CI.
- **Performance gate (Milestone 1):** 128×128 full sim step × 2 substeps in well under
  16 ms on CPU (target < 4 ms) before anything else is built on top.

### 10.4 Key invariants
- Stone cells: water flux in/out = 0 unless surface above block top; never erodes;
  excluded from smoothing.
- Smoothing conserves placed volume exactly.
- Budget: place drains, remove refunds fully, undo restores exactly.
- Flood-start snapshot restores `materialHeight`, `materialId`, occupancy, and budget
  bit-exactly on retry.
- Terrain mesh updates only on `terrain-changed` events; water mesh only during
  flood/verdict frames.

### 10.5 Out of scope for v0.5 (unchanged from v0.4 unless noted)
Excavation · timber · rigid bodies / Rapier · seepage · seasonal memory · multiple
sources per level · in-flood edits · WebGPU · mobile polish · quality tiers (new) ·
replay scrubbing (new — the postmortem beacon replaces it for MVP).

---

## 11. Build Sequence

1. **M1 — Sim core, proven.** Grid, EventBus, WaterSim, Erosion + the full headless test
   suite of §10.3 passing, perf gate met. *Nothing else starts until this is green.*
2. **M2 — World on screen.** Terrain kit, 3 level definitions, scene/terrain/water/house
   rendering, camera. Solvability tests for all 3 levels green.
3. **M3 — Hands in the sand.** Pointer input, edit tools, budgets, undo, toolbar UI.
4. **M4 — The loop closes.** Phase state machine, snapshot/retry, win/loss, stars,
   postmortem + beacon, verdict modal, timeline, level select, persistence.
5. **M5 — Feel pass.** Visual polish (wet darkening, erosion read, house states, source
   marker), audio, fast-forward, browser verification at 60 fps via Playwright.

---

## 12. Acceptance (a build ships when…)

- A new player understands the objective in <10 s and completes an attempt unaided.
- Every loss yields a postmortem the player can act on; retry-to-building takes <3 s and
  preserves the build.
- Sand, clay, and stone produce visibly different outcomes on Level 2.
- Level 3 cannot be won by walling everything — redirection is required.
- All sim and solvability tests pass; 60 fps sustained during flood in Chromium.
- Same build twice → same outcome, both times.

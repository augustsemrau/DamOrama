# Dam-Orama
## Revised Build Spec — v0.4 (MVP Vertical Slice)

This revision keeps the core fantasy of the original spec while reducing technical and UX risk.

The goal of v0.4 is not to describe the whole future game. The goal is to define a first playable that can prove the game loop quickly:

**prepare a defence → release water → understand failure clearly → retry immediately.**

---

## 1. Product Definition

**Dam-Orama** is a single-player tactile flood-defence puzzle game set inside a small rotatable diorama basin. The player places and shapes a limited amount of defensive material to protect a tiny cluster of houses from an incoming flood.

The game should feel like a toy first and a puzzle second. The player should enjoy shaping the basin even when they fail.

### Player promise
The player should be able to:
- read the terrain quickly,
- make a defence with a small number of meaningful decisions,
- watch water test that defence honestly,
- understand why it failed,
- restart in seconds.

---

## 2. Design Pillars

### 2.1 Tactile construction
Placing and smoothing material must feel pleasant even before the flood starts.

### 2.2 Readable water
The player must be able to look at a failure and identify the breach path without needing a physics explanation.

### 2.3 Small-world emotional stakes
The houses are fragile, warm, and easy to care about. They do not need narrative backstory.

### 2.4 Short retry loop
A single full attempt should be short enough that failure invites another try instead of fatigue.

### 2.5 No hidden rules
Material behaviour may be discovered through play, but the game should not feel arbitrary. Post-run feedback is mandatory.

---

## 3. MVP Scope

This spec defines a **desktop-first vertical slice** with a touch-compatible input architecture.

### In scope for v0.4
- One playable level
- One flood event per run
- One camera model
- Three materials: sand, clay, stone
- Two failure modes: overtopping and erosion
- Fast restart
- Post-run breach readout
- Resource budgets
- Construction → flood → resolution state machine

### Explicitly out of scope for v0.4
- True rigid-body stacking and toppling
- Rapier-based structural simulation
- Timber stakes
- Seasonal memory
- Seepage / Darcy-flow subsurface simulation
- Multiple water sources
- In-flood construction edits
- House displacement physics
- Partial-credit scoring
- Mobile-first polish

These items can be added later, but they are not required to discover whether the core game is fun.

---

## 4. Core Experience Loop

Each attempt has three phases.

### 4.1 Construction
The world is paused. The player places material, smooths it, and positions stone blocks. There is no time pressure.

### 4.2 Flood Test
The flood runs from a scripted source for a fixed duration and then settles. During this phase the player can only move the camera and inspect the result. No new material can be placed in MVP.

### 4.3 Resolution and Postmortem
The simulation pauses after the flood settles. The game highlights:
- the first breach path,
- the first house that flooded,
- the dominant failure cause: **overtopped** or **eroded through**.

The player can restart instantly.

### Attempt duration targets
- Construction: 30–120 seconds typical
- Flood + settle: 20–30 seconds
- Postmortem: 5–10 seconds
- Total attempt: 1–3 minutes

---

## 5. Level 1 — The Basin

Level 1 exists to teach placement, erosion, and overtopping. It should not test advanced simulation literacy.

### Layout
- One bounded rectangular basin
- One visible upstream pipe near the west edge
- Three houses on slightly higher ground to the east
- One shallow valley that naturally guides flow toward the settlement
- One obvious “good enough” build area between source and houses

### Why this layout
The original central-source layout is visually striking, but for a first playable it creates too many simultaneous approach vectors. A directional upstream-to-downstream flood is easier to read and easier to tune.

### Success condition
All houses remain dry when the scripted flood ends and the basin has settled.

### Failure condition
Any house becomes flooded during the test. The simulation continues briefly so the player can see the full consequence before the postmortem screen appears.

---

## 6. Materials

Level 1 uses three materials.

| Material | Role | Behaviour |
|---|---|---|
| **Sand** | Fast bulk fill | Cheap and quick to place. Erodes quickly under sustained fast flow. |
| **Clay** | Reliable sealing and shaping | Slower to place. Holds form better and erodes more slowly. |
| **Stone** | Hard obstacle | Placed as discrete blocks. Does not erode in MVP. Water flows around it. |

### Notes
- Stone is **static** in MVP. It does not topple, slide, or get undermined physically.
- Timber is deferred until the rest of the game loop is proven.
- The player does not learn these behaviours from long tooltips, but the game may use short first-use hints and post-run labels.

---

## 7. Construction Rules

The original spec mixes free terrain sculpting with budgeted material placement. For MVP, those need to be separated.

### v0.4 rule
The base terrain is fixed.

The player may only modify the level by placing and reshaping **player-owned material** on top of that terrain.

### Allowed actions
- Add sand
- Add clay
- Smooth placed material
- Remove placed material during construction
- Place stone blocks on valid ground
- Remove a placed stone block during construction

### Not allowed in MVP
- Excavating the baked terrain
- Raising unlimited terrain for free
- Moving material during the flood

This makes the economy legible and prevents exploitative “dig a giant moat for free” solutions.

### Budget model
- Sand and clay are budgeted by **placed volume units**
- Stone is budgeted by **block count**
- Removing player-placed material during construction refunds the full budget cost

---

## 8. Water and Failure Model

### MVP water goals
The simulation does not need to be academically complete. It needs to produce:
- directional flow,
- pooling in low areas,
- overtopping,
- visible erosion of soft material,
- stable performance.

### Failure modes in v0.4
1. **Overtopping** — water rises above the defence crest and spills over.
2. **Erosion** — fast sustained flow removes sand and slowly weakens clay.

### Deferred failure modes
- Undermining with structural collapse
- Seepage through porous fill
- Full rigid-body displacement

### Readability requirement
When a house floods, the player must be able to trace a visible path from source to breach to house.

### Postmortem requirement
After a failed run, the game highlights:
- breach origin cell/region,
- max water depth path,
- failure label,
- optional replay scrub of the last 5 seconds.

This is mandatory. Without it, “learn through play” turns into guesswork.

---

## 9. Camera and Input

The original touch table overloaded gestures and created conflicts. In particular:
- one-finger drag cannot reliably mean both sculpt and camera movement,
- pinch cannot simultaneously mean brush resize and zoom,
- “drag on empty basin” is not reliable when the terrain fills most of the screen.

### v0.4 input design principles
- one gesture = one purpose,
- brush size should be a UI control, not a gesture,
- camera inspection must always be available,
- touch and desktop should map to the same mental model.

### Desktop controls
- **LMB**: place / paint selected material
- **RMB drag**: orbit camera
- **Mouse wheel**: zoom
- **Q / E**: rotate 45° left / right
- **F**: focus level center
- **[ / ]** or on-screen slider: brush size
- **Ctrl/Cmd+Z**: undo last construction action

### Touch controls
Two explicit modes are used to avoid ambiguity.

#### Build mode
- **1 finger drag**: place / shape material
- **2 finger gesture**: orbit and zoom camera
- **On-screen +/- or slider**: brush size

#### Inspect mode
- **1 finger drag**: orbit / pan camera
- **2 finger pinch**: zoom

### Material selection
Materials are selected from a persistent bottom toolbar. No long-press material picker is used in MVP.

---

## 10. Houses

The houses are the emotional objective. In MVP they are static scene objects with flood sensors.

### Requirements
- Read clearly from all camera angles
- Be the warmest and most saturated assets in the scene
- Transition visibly to a flooded state

### Technical rule
Houses are not dynamic rigid bodies in MVP. They are static footprints with visuals attached.

This removes unnecessary physics complexity while preserving the design intent.

---

## 11. Aesthetic Direction

The original mood is worth keeping. The game should feel:
- quiet,
- focused,
- tactile,
- slightly melancholy.

### Visual priorities
1. Wet versus dry terrain must be immediately readable.
2. Houses must pop against earth and water.
3. The basin walls must sell the miniature, tabletop quality.
4. Water should look believable without requiring spectacle-heavy effects.

### Audio priorities
- Silence or near-silence during construction
- Distinct differences between trickle, rush, spill, and erosion
- No music required for MVP

---

## 12. Technical Approach

### 12.1 Technical philosophy
Do not tie core game discovery to the hardest engineering problems.

The first playable should prefer a simpler, stable implementation over an impressive architecture.

### 12.2 World representation
Use a single simulation grid for:
- terrain height,
- placed-material height,
- water depth,
- material id,
- erosion damage,
- occupancy mask.

### 12.3 Stone representation
Stone blocks are rasterized into the occupancy grid as static blockers.

No separate rigid-body world is required in v0.4.

### 12.4 Rendering
Use Three.js with a pinned package version in `package.json`.

The project should not depend on “latest at build time.” Version drift will make an agentic build more fragile.

### 12.5 Water simulation
Start from the existing working prototype and keep the water model visually and behaviourally stable before optimizing.

#### MVP resolution targets
- High: 256×256
- Medium: 192×192
- Low: 128×128

**512×512 is a stretch goal, not a day-one requirement.**

### 12.6 Performance rule
Quality is selected at level load or via startup benchmark. It is **not** changed mid-run, because that changes puzzle behaviour and undermines trust in the simulation.

---

## 13. Platform Strategy

### Primary target for v0.4
- Chromium-based desktop browsers

### Secondary target
- Recent mobile browsers with degraded quality tiers

### Support philosophy
WebGPU is a progressive enhancement, not the baseline promise for the first playable.

The first playable should be judged on feel and readability, not on whether it already ships the final rendering and compute stack.

---

## 14. Development Sequence

### Milestone 1 — Clean port of existing prototype
- Move current prototype into a proper module structure
- Preserve current water feel and camera feel
- Confirm fast restart

### Milestone 2 — Level state machine
- Add construction / flood / resolution phases
- Freeze editing during flood
- Add replay/reset flow

### Milestone 3 — Materials and budgets
- Add sand and clay placement as volume-limited fill
- Add stone as static blocker
- Add budget UI and refund-on-remove during construction

### Milestone 4 — House sensors and postmortem
- Add flooded state visuals
- Highlight breach source and failure label
- Add replay scrub or last-seconds replay

### Milestone 5 — Tuning pass
- Tune flood duration, source rate, erosion rates, and level geometry
- Playtest readability and retry cadence

### Milestone 6 — Performance and platform pass
- Add quality tiers
- Add optional GPU path if needed
- Add touch-compatible controls and mobile UI sizing

### Post-MVP only
- Timber
- Structural collapse
- Rapier integration
- Seasonal memory
- Multi-source levels
- Seepage

---

## 15. Level 1 Data Specification (Revised)

```json
{
  "id": "level-01",
  "name": "The Basin",
  "grid": { "width": 256, "height": 256, "cellSize": 0.0625 },
  "terrain": {
    "type": "procedural",
    "profile": "single_valley",
    "flowDirection": "west_to_east",
    "valleyWidth": 56,
    "valleyDepth": 0.22
  },
  "waterSource": {
    "type": "pipe",
    "position": { "x": 28, "y": 128 },
    "radius": 6,
    "flowRate": 0.014,
    "durationSec": 18,
    "startDelaySec": 0
  },
  "houses": [
    { "id": "house-a", "position": { "x": 208, "y": 108 }, "footprint": { "w": 10, "h": 10 } },
    { "id": "house-b", "position": { "x": 220, "y": 128 }, "footprint": { "w": 10, "h": 10 } },
    { "id": "house-c", "position": { "x": 208, "y": 148 }, "footprint": { "w": 10, "h": 10 } }
  ],
  "resources": {
    "sandVolume": 1600,
    "clayVolume": 900,
    "stoneBlocks": 6
  },
  "sim": {
    "qualityTier": "high",
    "erosionThreshold": 0.35,
    "erosionRateSand": 0.003,
    "erosionRateClay": 0.001,
    "settleTimeSec": 8
  },
  "winCondition": "all_houses_dry_after_settle"
}
```

### Notes on the revised data spec
- Coordinates are in grid cells.
- Resource budgets use units that match the construction model.
- The flood is directional and time-bounded.
- Partial credit is removed from MVP.

---

## 16. Testing Criteria

### A build is acceptable when all of the following are true
- A new player can understand the objective in under 10 seconds.
- A new player can complete one full attempt without instructions.
- On failure, the player can identify where the water got through.
- The retry loop takes less than 3 seconds from failure screen to construction phase.
- Sand and clay feel meaningfully different in practice.
- Stone creates obviously different flow than soft fill.
- The level can be won and lost consistently.

### A build is not acceptable if any of the following are true
- The player loses but cannot tell why.
- Camera control competes with building input.
- Quality changes during a flood and changes the outcome.
- The simulation is so unstable that tuning becomes guesswork.
- The level is only interesting because the physics system is technically impressive.

---

## 17. Future Expansion Path

Once v0.4 proves the loop, the next additions should be ordered by player value, not engineering novelty.

Recommended order:
1. Better postmortem and replay tools
2. More hand-authored levels
3. Touch polish and mobile UI
4. Timber as a new construction option
5. Partial scoring / optional objectives
6. Structural collapse
7. Seasonal memory
8. Seepage

---

## 18. Bottom-Line Design Decision

The game idea is strong because it is tactile, legible, and emotionally small-scale.

It becomes weak when the spec tries to solve fluid simulation, rigid-body coupling, cross-browser WebGPU support, touch-first UX, seasonal persistence, and advanced failure modelling all at once.

**v0.4 chooses clarity over completeness.**

That is the right trade if the real question is: *is this actually a good game once the water starts moving?*

// World / grid
export const GRID_SIZE = 128;
export const WORLD_SIZE = 10;                  // world units, square basin
export const CELL = WORLD_SIZE / GRID_SIZE;    // 0.078125
export const CELL_AREA = CELL * CELL;

// Simulation clock — fixed step, frame-rate independent
export const SIM_DT = 1 / 60;                  // one sim step in sim-seconds
export const SUBSTEPS = 2;                     // internal substeps per sim step
export const MAX_STEPS_PER_FRAME = 4;          // accumulator clamp (8 when fast-forwarding)

// Virtual-pipes water model
export const GRAVITY = 9.81;
export const PIPE_K = 0.6;                     // pipe cross-section / length (tuned via tests)
export const FLUX_DAMPING = 0.998;
export const MIN_FLOW_DEPTH = 1e-4;

// Materials
export const MAT_NONE = 0;
export const MAT_SAND = 1;
export const MAT_CLAY = 2;
export const MAT_STONE = 3;

// Occupancy bits
export const OCC_STONE = 1;
export const OCC_HOUSE = 2;

// Stone blocks
export const STONE_SIZE = 6;                   // cells per side
export const STONE_HEIGHT = 0.45;              // world units

// Erosion (rate = k * (speed - threshold), applied per sim-second).
// Clay both erodes slower and needs faster water before it erodes at all.
export const EROSION_THRESHOLD_SAND = 0.5;     // world units / sim-second
export const EROSION_THRESHOLD_CLAY = 0.9;
export const EROSION_RATE_SAND = 0.06;
export const EROSION_RATE_CLAY = 0.003;
export const FLOW_SPEED_CAP = 6;               // sane ceiling for thin-film jets
export const EROSION_MIN_DEPTH = 0.003;        // no erosion under a dry/thin film

// Flood sensing
export const HOUSE_FLOOD_DEPTH = 0.03;         // avg depth over footprint

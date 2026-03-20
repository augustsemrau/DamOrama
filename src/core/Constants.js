// Material IDs
export const MAT_NONE = 0;
export const MAT_SAND = 1;
export const MAT_CLAY = 2;
export const MAT_STONE = 3;

// Occupancy bits
export const STONE_BIT = 1;
export const HOUSE_BIT = 2;

// Dev mode — enables bounds checking in Grid accessors
// import.meta.env.DEV is always defined in Vite/Vitest environments
export const DEV_MODE = import.meta.env.DEV;

import { MAT_SAND, MAT_CLAY, MAT_STONE } from '../core/Constants.js';

export const MATERIAL_PROPS = {
  [MAT_SAND]: {
    name: 'Sand',
    placementHeight: 0.06,    // height added per paint stroke per cell
    maxHeight: 0.5,           // cap per cell
    erosionRate: 0.005,
    color: '#c2a645'
  },
  [MAT_CLAY]: {
    name: 'Clay',
    placementHeight: 0.05,
    maxHeight: 0.4,
    erosionRate: 0.001,
    color: '#8b6f47'
  },
  [MAT_STONE]: {
    name: 'Stone',
    placementHeight: 0.4,     // fixed block height
    maxHeight: 0.4,
    erosionRate: 0,
    color: '#777777'
  }
};

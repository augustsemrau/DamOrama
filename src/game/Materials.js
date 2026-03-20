import { MAT_SAND, MAT_CLAY, MAT_STONE } from '../core/Constants.js';

export const MATERIAL_PROPS = {
  [MAT_SAND]: {
    name: 'Sand',
    placementHeight: 0.15,   // height added per paint stroke
    erosionRate: 0.003,       // from level JSON, but default here
    color: '#c2a645'
  },
  [MAT_CLAY]: {
    name: 'Clay',
    placementHeight: 0.12,
    erosionRate: 0.001,
    color: '#8b6f47'
  },
  [MAT_STONE]: {
    name: 'Stone',
    placementHeight: 0.5,    // fixed block height
    erosionRate: 0,           // does not erode
    color: '#777777'
  }
};

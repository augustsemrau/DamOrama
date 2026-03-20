import { Grid } from '../core/Grid.js';

export class Level {
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

  static _singleValley(grid, terrain) {
    const { width, height } = grid;
    const centerY = height / 2;
    const halfValley = terrain.valleyWidth / 2;
    const baseHeight = 0.4;
    const rimHeight = baseHeight + terrain.valleyDepth;
    const eastSlope = 0.08;

    for (let y = 0; y < height; y++) {
      const distFromCenter = Math.abs(y - centerY) / halfValley;
      const valleyFactor = Math.min(distFromCenter, 1.0);
      const smoothFactor = valleyFactor * valleyFactor * (3 - 2 * valleyFactor);

      for (let x = 0; x < width; x++) {
        const slopeFactor = 1.0 - (x / width);
        const h = baseHeight
          + smoothFactor * terrain.valleyDepth
          + slopeFactor * eastSlope;
        grid.terrainHeight[grid.index(x, y)] = h;
      }
    }
  }
}

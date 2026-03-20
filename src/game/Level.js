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

  /**
   * West-to-east valley terrain:
   * - Strong west→east downslope drives water toward houses
   * - North/south rims channel water through the valley center
   * - Flat basin floor in the east where houses sit
   */
  static _singleValley(grid, terrain) {
    const { width, height } = grid;
    const centerY = height / 2;
    const halfValley = terrain.valleyWidth / 2;

    // Height parameters
    const westHeight = 0.6;     // source area (high)
    const eastHeight = 0.15;    // house area (low, flat basin)
    const rimExtra = terrain.valleyDepth; // rim height above floor

    for (let y = 0; y < height; y++) {
      // Valley cross-section: 0 at center, 1 at rim
      const distFromCenter = Math.abs(y - centerY) / halfValley;
      const valleyFactor = Math.min(distFromCenter, 1.0);
      // Smooth hermite interpolation
      const rim = valleyFactor * valleyFactor * (3 - 2 * valleyFactor);

      for (let x = 0; x < width; x++) {
        // West-to-east slope: steep in west half, flattening in east
        const t = x / width; // 0=west, 1=east
        // Ease-out curve for natural slope that flattens near houses
        const slopeT = 1 - (1 - t) * (1 - t);
        const floorHeight = westHeight + (eastHeight - westHeight) * slopeT;

        // Add rim walls (north/south edges are higher)
        const h = floorHeight + rim * rimExtra;
        grid.terrainHeight[grid.index(x, y)] = h;
      }
    }
  }
}

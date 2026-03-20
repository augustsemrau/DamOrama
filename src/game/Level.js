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

    // Height parameters — very gentle slope so water flows as a rising lake
    const westHeight = 0.25;    // source area (slightly higher)
    const eastHeight = 0.18;    // house area (slightly lower)
    const rimExtra = terrain.valleyDepth;

    for (let y = 0; y < height; y++) {
      // Valley cross-section: narrower toward east (funneling)
      const distFromCenter = Math.abs(y - centerY) / halfValley;
      const valleyFactor = Math.min(distFromCenter, 1.0);
      const rim = valleyFactor * valleyFactor * (3 - 2 * valleyFactor);

      for (let x = 0; x < width; x++) {
        // Ease-in slope: gentle at west, steeper toward middle, flattens at east
        // This keeps a pool at the source but pushes water strongly mid-basin
        const t = x / width;
        const slopeT = t * t * (3 - 2 * t); // S-curve: slow start, fast middle, slow end
        const floorHeight = westHeight + (eastHeight - westHeight) * slopeT;

        // Add rim walls (north/south edges are higher)
        const h = floorHeight + rim * rimExtra;
        grid.terrainHeight[grid.index(x, y)] = h;
      }
    }
  }
}

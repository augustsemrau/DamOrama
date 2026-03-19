import { describe, it, expect, vi } from 'vitest';

// Mock Three.js for Node test environment
vi.mock('three/webgpu', () => {
  class MockVector3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; }
  }

  class MockBoxGeometry {
    constructor(w, h, d) {
      this.parameters = { width: w, height: h, depth: d };
    }
    dispose() {}
  }

  class MockMeshStandardMaterial {
    constructor(opts = {}) { Object.assign(this, opts); }
    dispose() {}
  }

  class MockMesh {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.position = new MockVector3();
      this.name = '';
    }
  }

  return {
    Vector3: MockVector3,
    BoxGeometry: MockBoxGeometry,
    MeshStandardMaterial: MockMeshStandardMaterial,
    Mesh: MockMesh,
  };
});

import {
  createBasinWalls,
  BASIN_SIZE, WALL_HEIGHT, WALL_THICKNESS,
  CAMERA_MIN_DISTANCE, CAMERA_MAX_DISTANCE,
  CAMERA_MIN_POLAR_ANGLE, CAMERA_MAX_POLAR_ANGLE,
} from './SceneBuilder.js';

describe('SceneBuilder — Camera constraints (Req 15.3)', () => {
  it('minDistance allows close inspection', () => {
    expect(CAMERA_MIN_DISTANCE).toBe(2);
  });

  it('maxDistance shows full diorama', () => {
    expect(CAMERA_MAX_DISTANCE).toBe(20);
  });

  it('minPolarAngle prevents camera going directly overhead', () => {
    expect(CAMERA_MIN_POLAR_ANGLE).toBeCloseTo(0.2, 2);
  });

  it('maxPolarAngle prevents camera going below terrain', () => {
    expect(CAMERA_MAX_POLAR_ANGLE).toBeCloseTo(Math.PI / 2.2, 4);
    expect(CAMERA_MAX_POLAR_ANGLE).toBeLessThan(Math.PI / 2);
  });
});

describe('SceneBuilder — Basin walls (Req 15.4)', () => {
  it('creates exactly 4 wall meshes', () => {
    const walls = createBasinWalls();
    expect(walls).toHaveLength(4);
  });

  it('all walls are named "basin-wall"', () => {
    const walls = createBasinWalls();
    for (const wall of walls) {
      expect(wall.name).toBe('basin-wall');
    }
  });

  it('walls use MeshStandardMaterial with earth-tone colour', () => {
    const walls = createBasinWalls();
    for (const wall of walls) {
      expect(wall.material.color).toBe(0x8b6f47);
    }
  });

  it('walls have correct height', () => {
    const walls = createBasinWalls();
    for (const wall of walls) {
      expect(wall.geometry.parameters.height).toBe(WALL_HEIGHT);
    }
  });

  it('north/south walls span the full basin width (plus thickness)', () => {
    const walls = createBasinWalls();
    const northSouth = walls.filter(
      w => w.geometry.parameters.depth === WALL_THICKNESS
    );
    expect(northSouth).toHaveLength(2);
    for (const w of northSouth) {
      expect(w.geometry.parameters.width).toBeCloseTo(BASIN_SIZE + WALL_THICKNESS * 2);
    }
  });

  it('east/west walls span the basin depth', () => {
    const walls = createBasinWalls();
    const eastWest = walls.filter(
      w => w.geometry.parameters.width === WALL_THICKNESS
    );
    expect(eastWest).toHaveLength(2);
    for (const w of eastWest) {
      expect(w.geometry.parameters.depth).toBe(BASIN_SIZE);
    }
  });

  it('walls are positioned at the basin perimeter', () => {
    const walls = createBasinWalls();
    const halfBasin = BASIN_SIZE / 2;

    // North/south walls should be at ±(halfBasin + thickness/2) on Z
    const northSouth = walls.filter(
      w => w.geometry.parameters.depth === WALL_THICKNESS
    );
    const zPositions = northSouth.map(w => w.position.z).sort((a, b) => a - b);
    expect(zPositions[0]).toBeCloseTo(-(halfBasin + WALL_THICKNESS / 2));
    expect(zPositions[1]).toBeCloseTo(halfBasin + WALL_THICKNESS / 2);

    // East/west walls should be at ±(halfBasin + thickness/2) on X
    const eastWest = walls.filter(
      w => w.geometry.parameters.width === WALL_THICKNESS
    );
    const xPositions = eastWest.map(w => w.position.x).sort((a, b) => a - b);
    expect(xPositions[0]).toBeCloseTo(-(halfBasin + WALL_THICKNESS / 2));
    expect(xPositions[1]).toBeCloseTo(halfBasin + WALL_THICKNESS / 2);
  });

  it('walls are elevated so bottom sits at y=0', () => {
    const walls = createBasinWalls();
    for (const wall of walls) {
      expect(wall.position.y).toBeCloseTo(WALL_HEIGHT / 2);
    }
  });
});

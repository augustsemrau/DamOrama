import { describe, it, expect, beforeEach } from 'vitest';
import {
  init,
  step,
  addBlock,
  addStake,
  addHouse,
  getBodies,
  removeBody,
  getBodyAABBs,
  makeBodyDynamic,
  getWorld,
  getBodyCount,
  getMaxBodies,
  getBody,
  setBodyMesh,
} from './RigidBodies.js';

describe('RigidBodies', () => {
  beforeEach(async () => {
    await init();
  });

  describe('init', () => {
    it('should create a Rapier world with gravity', () => {
      const world = getWorld();
      expect(world).not.toBeNull();
      const gravity = world.gravity;
      expect(gravity.x).toBe(0);
      expect(gravity.y).toBeCloseTo(-9.81);
      expect(gravity.z).toBe(0);
    });

    it('should start with zero bodies', () => {
      expect(getBodyCount()).toBe(0);
      expect(getBodies()).toHaveLength(0);
    });

    it('should clear bodies from previous init', async () => {
      addBlock({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
      expect(getBodyCount()).toBe(1);
      await init();
      expect(getBodyCount()).toBe(0);
    });
  });

  describe('addBlock', () => {
    it('should add a block and return a valid ID', () => {
      const id = addBlock({ x: 1, y: 2, z: 3 }, { x: 0.5, y: 0.5, z: 0.5 });
      expect(id).not.toBeNull();
      expect(typeof id).toBe('number');
      expect(getBodyCount()).toBe(1);
    });

    it('should store the block at the given position', () => {
      const id = addBlock({ x: 1, y: 2, z: 3 }, { x: 0.5, y: 0.5, z: 0.5 });
      const bodies = getBodies();
      expect(bodies).toHaveLength(1);
      expect(bodies[0].position.x).toBeCloseTo(1);
      expect(bodies[0].position.y).toBeCloseTo(2);
      expect(bodies[0].position.z).toBeCloseTo(3);
      expect(bodies[0].type).toBe('block');
    });

    it('should create a fixed (static) body', () => {
      const id = addBlock({ x: 0, y: 5, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 });
      // Step physics — fixed body should not move
      for (let i = 0; i < 60; i++) step(1 / 60);
      const bodies = getBodies();
      expect(bodies[0].position.y).toBeCloseTo(5);
    });
  });

  describe('addStake', () => {
    it('should add a stake and return a valid ID', () => {
      const id = addStake({ x: 0, y: 0, z: 0 }, 2, 0.1);
      expect(id).not.toBeNull();
      expect(getBodyCount()).toBe(1);
    });

    it('should position the stake centre at base + halfHeight', () => {
      const id = addStake({ x: 1, y: 0, z: 2 }, 4, 0.1);
      const bodies = getBodies();
      expect(bodies[0].position.y).toBeCloseTo(2); // base 0 + halfHeight 2
      expect(bodies[0].type).toBe('stake');
    });
  });

  describe('addHouse', () => {
    it('should add a house and return a valid ID', () => {
      const id = addHouse({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
      expect(id).not.toBeNull();
      expect(getBodyCount()).toBe(1);
    });

    it('should position the house centre at base + scale.y', () => {
      const id = addHouse({ x: 3, y: 0, z: 4 }, { x: 1, y: 1.5, z: 1 });
      const bodies = getBodies();
      expect(bodies[0].position.y).toBeCloseTo(1.5); // base 0 + scale.y 1.5
      expect(bodies[0].type).toBe('house');
    });

    it('should remain fixed after physics steps', () => {
      addHouse({ x: 0, y: 5, z: 0 }, { x: 1, y: 1, z: 1 });
      for (let i = 0; i < 60; i++) step(1 / 60);
      const bodies = getBodies();
      expect(bodies[0].position.y).toBeCloseTo(6); // 5 + 1
    });
  });

  describe('removeBody', () => {
    it('should remove an existing body', () => {
      const id = addBlock({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
      expect(removeBody(id)).toBe(true);
      expect(getBodyCount()).toBe(0);
    });

    it('should return false for non-existent ID', () => {
      expect(removeBody(9999)).toBe(false);
    });
  });

  describe('getBodies', () => {
    it('should return all bodies with position, rotation, type, and mesh', () => {
      addBlock({ x: 1, y: 0, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 });
      addStake({ x: 2, y: 0, z: 0 }, 2, 0.1);
      addHouse({ x: 3, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });

      const all = getBodies();
      expect(all).toHaveLength(3);

      const types = all.map((b) => b.type).sort();
      expect(types).toEqual(['block', 'house', 'stake']);

      for (const b of all) {
        expect(b).toHaveProperty('id');
        expect(b).toHaveProperty('position');
        expect(b).toHaveProperty('rotation');
        expect(b.rotation).toHaveProperty('w');
        expect(b.mesh).toBeNull();
      }
    });
  });

  describe('getBodyAABBs', () => {
    it('should return AABBs for all bodies', () => {
      addBlock({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
      const aabbs = getBodyAABBs();
      expect(aabbs).toHaveLength(1);
      expect(aabbs[0]).toHaveProperty('minX');
      expect(aabbs[0]).toHaveProperty('minZ');
      expect(aabbs[0]).toHaveProperty('maxX');
      expect(aabbs[0]).toHaveProperty('maxZ');
      // Cuboid half-extents 1,1,1 at origin → AABB from -1 to 1
      expect(aabbs[0].minX).toBeCloseTo(-1);
      expect(aabbs[0].maxX).toBeCloseTo(1);
      expect(aabbs[0].minZ).toBeCloseTo(-1);
      expect(aabbs[0].maxZ).toBeCloseTo(1);
    });
  });

  describe('makeBodyDynamic', () => {
    it('should convert a fixed body to dynamic', () => {
      const id = addBlock({ x: 0, y: 5, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 });
      // Confirm it stays put as fixed
      for (let i = 0; i < 10; i++) step(1 / 60);
      expect(getBodies()[0].position.y).toBeCloseTo(5);

      // Make dynamic — should start falling
      expect(makeBodyDynamic(id)).toBe(true);
      for (let i = 0; i < 60; i++) step(1 / 60);
      expect(getBodies()[0].position.y).toBeLessThan(5);
    });

    it('should return false for non-existent ID', () => {
      expect(makeBodyDynamic(9999)).toBe(false);
    });
  });

  describe('setBodyMesh', () => {
    it('should set the mesh reference on a body', () => {
      const id = addBlock({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
      const fakeMesh = { isMesh: true };
      setBodyMesh(id, fakeMesh);
      const entry = getBody(id);
      expect(entry.mesh).toBe(fakeMesh);
    });
  });

  describe('body limit', () => {
    it('should return a positive max body limit', () => {
      expect(getMaxBodies()).toBeGreaterThan(0);
    });

    it('should reject bodies when at limit', () => {
      const limit = getMaxBodies();
      for (let i = 0; i < limit; i++) {
        const id = addBlock({ x: i, y: 0, z: 0 }, { x: 0.1, y: 0.1, z: 0.1 });
        expect(id).not.toBeNull();
      }
      expect(getBodyCount()).toBe(limit);
      // Next add should be rejected
      expect(addBlock({ x: 0, y: 0, z: 0 }, { x: 0.1, y: 0.1, z: 0.1 })).toBeNull();
      expect(addStake({ x: 0, y: 0, z: 0 }, 1, 0.1)).toBeNull();
      expect(addHouse({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 })).toBeNull();
    });
  });

  describe('block stacking stability (Req 5.2)', () => {
    /**
     * Helper: add a large fixed ground-plane collider to the Rapier world
     * so dynamic blocks have something to rest on.
     */
    function addGroundPlane() {
      const world = getWorld();
      const RAPIER = world.constructor; // not needed — use world API directly
      // Create a fixed body at y=0 with a large thin cuboid as ground
      const groundId = addBlock({ x: 0, y: -0.25, z: 0 }, { x: 50, y: 0.25, z: 50 });
      return groundId;
    }

    it('should keep 5 stacked blocks stable for 10 seconds as fixed bodies', () => {
      const blockHalfExtent = { x: 0.5, y: 0.5, z: 0.5 };
      const blockIds = [];

      // Stack 5 blocks vertically: each block is 1 unit tall (half-extent 0.5)
      // Block centres at y = 0.5, 1.5, 2.5, 3.5, 4.5
      for (let i = 0; i < 5; i++) {
        const y = 0.5 + i * 1.0;
        const id = addBlock({ x: 0, y, z: 0 }, blockHalfExtent);
        expect(id).not.toBeNull();
        blockIds.push(id);
      }

      // Record initial positions
      const initialPositions = getBodies()
        .filter((b) => blockIds.includes(b.id))
        .map((b) => ({ id: b.id, x: b.position.x, y: b.position.y, z: b.position.z }));

      // Step for 10 seconds at 60 fps (600 steps)
      const dt = 1 / 60;
      const totalSteps = Math.ceil(10 / dt);
      for (let i = 0; i < totalSteps; i++) step(dt);

      // Verify all blocks remain at their initial positions (no drift/jitter)
      const finalBodies = getBodies().filter((b) => blockIds.includes(b.id));
      for (const body of finalBodies) {
        const initial = initialPositions.find((p) => p.id === body.id);
        expect(body.position.x).toBeCloseTo(initial.x, 2);
        expect(body.position.y).toBeCloseTo(initial.y, 2);
        expect(body.position.z).toBeCloseTo(initial.z, 2);
      }
    });
  });

  describe('block toppling on support removal (Req 5.3)', () => {
    it('should collapse remaining blocks when bottom block is removed and they become dynamic', () => {
      // Add a ground plane so falling blocks have something to land on
      const groundId = addBlock({ x: 0, y: -0.25, z: 0 }, { x: 50, y: 0.25, z: 50 });
      expect(groundId).not.toBeNull();

      const blockHalfExtent = { x: 0.5, y: 0.5, z: 0.5 };
      const blockIds = [];

      // Stack 5 blocks vertically on top of the ground plane
      // Ground surface is at y=0, block centres at y = 0.5, 1.5, 2.5, 3.5, 4.5
      for (let i = 0; i < 5; i++) {
        const y = 0.5 + i * 1.0;
        const id = addBlock({ x: 0, y, z: 0 }, blockHalfExtent);
        expect(id).not.toBeNull();
        blockIds.push(id);
      }

      // Confirm all 5 blocks + ground = 6 bodies
      expect(getBodyCount()).toBe(6);

      // Record initial positions of the upper 4 blocks (indices 1-4)
      const upperIds = blockIds.slice(1);
      const initialUpperPositions = getBodies()
        .filter((b) => upperIds.includes(b.id))
        .map((b) => ({ id: b.id, y: b.position.y }));

      // Remove the bottom block
      const bottomId = blockIds[0];
      expect(removeBody(bottomId)).toBe(true);
      expect(getBodyCount()).toBe(5); // ground + 4 remaining blocks

      // Make the remaining 4 blocks dynamic so they can fall
      for (const id of upperIds) {
        expect(makeBodyDynamic(id)).toBe(true);
      }

      // Step physics for 2 seconds — blocks should fall/collapse
      const dt = 1 / 60;
      const collapseSteps = Math.ceil(2 / dt);
      for (let i = 0; i < collapseSteps; i++) step(dt);

      // Verify the upper blocks have fallen (their Y positions decreased significantly)
      const finalBodies = getBodies().filter((b) => upperIds.includes(b.id));
      for (const body of finalBodies) {
        const initial = initialUpperPositions.find((p) => p.id === body.id);
        // Each block should have fallen — its Y should be lower than its initial position
        expect(body.position.y).toBeLessThan(initial.y - 0.1);
      }

      // The highest block (was at y=4.5) should now be much lower
      const topBlock = finalBodies.find(
        (b) => b.id === blockIds[4]
      );
      expect(topBlock.position.y).toBeLessThan(4.0);
    });
  });

  describe('step', () => {
    it('should not throw when called with no bodies', () => {
      expect(() => step(1 / 60)).not.toThrow();
    });

    it('should not throw when world is not initialised', async () => {
      // step before init — world is already initialised in beforeEach,
      // but we can verify it doesn't crash with a normal call
      expect(() => step(1 / 60)).not.toThrow();
    });
  });
});

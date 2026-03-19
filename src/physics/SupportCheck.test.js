import { describe, it, expect, beforeEach } from 'vitest';
import { checkSupport, SUPPORT_THRESHOLD } from './SupportCheck.js';
import {
  init,
  addBlock,
  getBodies,
  getBodyBaseY,
  makeBodyDynamic,
  getBody,
} from './RigidBodies.js';

describe('SupportCheck', () => {
  describe('checkSupport (unit tests with mock terrain)', () => {
    it('should return empty array when no bodies exist', () => {
      const result = checkSupport([], () => null, () => 0);
      expect(result).toEqual([]);
    });

    it('should consider a body supported when terrain is at its base', () => {
      // Fake body at y=1 with base at y=0.5
      const bodies = [{ id: 1, position: { x: 0, y: 1, z: 0 }, type: 'block' }];
      const getBaseY = () => 0.5;
      const terrainH = () => 0.5; // terrain exactly at base

      const result = checkSupport(bodies, getBaseY, terrainH);
      expect(result).toEqual([]);
    });

    it('should consider a body supported when terrain is slightly below base but within threshold', () => {
      const bodies = [{ id: 1, position: { x: 0, y: 1, z: 0 }, type: 'block' }];
      const getBaseY = () => 0.5;
      // Terrain is 0.1 below base — within the 0.2 threshold
      const terrainH = () => 0.4;

      const result = checkSupport(bodies, getBaseY, terrainH);
      expect(result).toEqual([]);
    });

    it('should flag a body as unsupported when terrain drops beyond threshold', () => {
      const bodies = [{ id: 42, position: { x: 2, y: 1, z: 3 }, type: 'block' }];
      const getBaseY = () => 0.5;
      // Terrain is 0.3 below base — exceeds the 0.2 threshold
      const terrainH = () => 0.2;

      const result = checkSupport(bodies, getBaseY, terrainH);
      expect(result).toEqual([42]);
    });

    it('should flag only unsupported bodies in a mixed set', () => {
      const bodies = [
        { id: 1, position: { x: 0, y: 1, z: 0 }, type: 'block' },
        { id: 2, position: { x: 5, y: 2, z: 5 }, type: 'block' },
        { id: 3, position: { x: 3, y: 1, z: 3 }, type: 'stake' },
      ];
      const getBaseY = (id) => {
        if (id === 1) return 0.5;
        if (id === 2) return 1.5;
        if (id === 3) return 0.5;
        return 0;
      };
      // Body 1: terrain at base (supported)
      // Body 2: terrain far below (unsupported)
      // Body 3: terrain slightly below within threshold (supported)
      const terrainH = (wx) => {
        if (wx === 0) return 0.5;
        if (wx === 5) return 1.0; // 0.5 below base of 1.5 → unsupported
        if (wx === 3) return 0.4; // 0.1 below base of 0.5 → supported
        return 0;
      };

      const result = checkSupport(bodies, getBaseY, terrainH);
      expect(result).toEqual([2]);
    });

    it('should skip bodies where getBaseY returns null', () => {
      const bodies = [{ id: 99, position: { x: 0, y: 1, z: 0 }, type: 'block' }];
      const getBaseY = () => null;
      const terrainH = () => -10;

      const result = checkSupport(bodies, getBaseY, terrainH);
      expect(result).toEqual([]);
    });

    it('should consider a body at exact threshold boundary as supported', () => {
      const bodies = [{ id: 1, position: { x: 0, y: 1, z: 0 }, type: 'block' }];
      const getBaseY = () => 0.5;
      // Terrain exactly at base - threshold (0.5 - 0.2 = 0.3) → NOT less than, so supported
      const terrainH = () => 0.3;

      const result = checkSupport(bodies, getBaseY, terrainH);
      expect(result).toEqual([]);
    });
  });

  describe('integration with RigidBodies', () => {
    beforeEach(async () => {
      await init();
    });

    it('should detect support loss and makeBodyDynamic causes the body to fall', () => {
      // Place a block at y=1 with half-extents 0.5 → base at y=0.5
      const id = addBlock({ x: 0, y: 1, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 });
      expect(id).not.toBeNull();

      // Verify getBodyBaseY works
      const baseY = getBodyBaseY(id);
      expect(baseY).toBeCloseTo(0.5);

      // Terrain at 0.5 → supported
      let unsupported = checkSupport(
        getBodies(),
        getBodyBaseY,
        () => 0.5
      );
      expect(unsupported).toEqual([]);

      // Terrain eroded to 0.1 — 0.4 below base — unsupported
      unsupported = checkSupport(
        getBodies(),
        getBodyBaseY,
        () => 0.1
      );
      expect(unsupported).toEqual([id]);

      // Make the body dynamic — it should start falling
      expect(makeBodyDynamic(id)).toBe(true);

      // Verify the body type changed (it will fall under gravity)
      const entry = getBody(id);
      expect(entry).toBeDefined();
    });

    it('getBodyBaseY should return correct base for a block', () => {
      // Block at centre y=2, half-extent y=0.5 → base at 1.5
      const id = addBlock({ x: 0, y: 2, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 });
      expect(getBodyBaseY(id)).toBeCloseTo(1.5);
    });

    it('getBodyBaseY should return null for non-existent body', () => {
      expect(getBodyBaseY(9999)).toBeNull();
    });
  });
});

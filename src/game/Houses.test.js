import { describe, it, expect, beforeEach } from 'vitest';
import { init as initPhysics } from '../physics/RigidBodies.js';
import {
  placeHouse,
  getHouses,
  getHouse,
  setFlooded,
  getHouseCount,
  reset,
} from './Houses.js';

describe('Houses', () => {
  beforeEach(async () => {
    await initPhysics();
    reset();
  });

  describe('placeHouse', () => {
    it('should create a rigid body and return a valid ID', () => {
      const id = placeHouse({ x: 1, y: 0, z: 2 }, { x: 0.5, y: 0.5, z: 0.5 });
      expect(id).not.toBeNull();
      expect(typeof id).toBe('number');
    });

    it('should track the placed house', () => {
      placeHouse({ x: 1, y: 0, z: 2 }, { x: 0.5, y: 0.5, z: 0.5 });
      expect(getHouseCount()).toBe(1);
    });

    it('should store position and scale correctly', () => {
      const id = placeHouse({ x: 3, y: 1, z: 4 }, { x: 1, y: 1.5, z: 1 });
      const house = getHouse(id);
      expect(house.position).toEqual({ x: 3, y: 1, z: 4 });
      expect(house.scale).toEqual({ x: 1, y: 1.5, z: 1 });
    });
  });

  describe('getHouses', () => {
    it('should return empty array when no houses placed', () => {
      expect(getHouses()).toHaveLength(0);
    });

    it('should return all placed houses', () => {
      placeHouse({ x: 0, y: 0, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 });
      placeHouse({ x: 5, y: 0, z: 5 }, { x: 1, y: 1, z: 1 });
      placeHouse({ x: -3, y: 0, z: 2 }, { x: 0.8, y: 0.6, z: 0.8 });
      expect(getHouses()).toHaveLength(3);
    });
  });

  describe('getHouse', () => {
    it('should return a specific house by ID', () => {
      const id = placeHouse({ x: 2, y: 0, z: 3 }, { x: 1, y: 1, z: 1 });
      const house = getHouse(id);
      expect(house).not.toBeNull();
      expect(house.id).toBe(id);
    });

    it('should return null for non-existent ID', () => {
      expect(getHouse(9999)).toBeNull();
    });
  });

  describe('setFlooded', () => {
    it('should update flood state to true', () => {
      const id = placeHouse({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
      setFlooded(id, true);
      expect(getHouse(id).flooded).toBe(true);
    });

    it('should update flood state back to false', () => {
      const id = placeHouse({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
      setFlooded(id, true);
      setFlooded(id, false);
      expect(getHouse(id).flooded).toBe(false);
    });

    it('should not throw for non-existent ID', () => {
      expect(() => setFlooded(9999, true)).not.toThrow();
    });
  });

  describe('houses start as not flooded', () => {
    it('should initialise flooded to false', () => {
      const id = placeHouse({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
      expect(getHouse(id).flooded).toBe(false);
    });
  });

  describe('reset', () => {
    it('should clear all tracked houses', () => {
      placeHouse({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
      placeHouse({ x: 5, y: 0, z: 5 }, { x: 1, y: 1, z: 1 });
      expect(getHouseCount()).toBe(2);
      reset();
      expect(getHouseCount()).toBe(0);
      expect(getHouses()).toHaveLength(0);
    });
  });

  describe('getHouseCount', () => {
    it('should return 0 when no houses placed', () => {
      expect(getHouseCount()).toBe(0);
    });

    it('should return correct count after multiple placements', () => {
      placeHouse({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
      placeHouse({ x: 5, y: 0, z: 5 }, { x: 1, y: 1, z: 1 });
      expect(getHouseCount()).toBe(2);
    });
  });
});

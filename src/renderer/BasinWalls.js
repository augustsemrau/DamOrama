import * as THREE from 'three';

export function createBasinWalls(scene, worldSize, wallHeight = 1.0) {
  const half = worldSize / 2;
  const material = new THREE.MeshStandardMaterial({
    color: 0x8B7355,
    roughness: 0.85,
    side: THREE.DoubleSide
  });

  const wallGeo = new THREE.PlaneGeometry(worldSize, wallHeight);

  // North wall (z = 0)
  const north = new THREE.Mesh(wallGeo.clone(), material);
  north.position.set(half, wallHeight / 2, 0);
  scene.add(north);

  // South wall (z = worldSize)
  const south = new THREE.Mesh(wallGeo.clone(), material);
  south.position.set(half, wallHeight / 2, worldSize);
  south.rotation.y = Math.PI;
  scene.add(south);

  // East wall (x = worldSize)
  const east = new THREE.Mesh(wallGeo.clone(), material);
  east.position.set(worldSize, wallHeight / 2, half);
  east.rotation.y = -Math.PI / 2;
  scene.add(east);

  // West wall (x = 0)
  const west = new THREE.Mesh(wallGeo.clone(), material);
  west.position.set(0, wallHeight / 2, half);
  west.rotation.y = Math.PI / 2;
  scene.add(west);
}

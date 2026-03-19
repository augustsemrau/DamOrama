import * as THREE from 'three/webgpu';

/**
 * SceneBuilder — Sets up the Three.js scene, camera, lighting, and WebGPURenderer.
 *
 * The basin is 16×16 world units. Camera is positioned in an isometric-like
 * perspective above the basin looking down at its centre (8, 0, 8).
 *
 * Exports an async init() that returns { scene, camera, renderer }.
 */

const BASIN_CENTRE = new THREE.Vector3(0, 0, 0);

/** Basin dimensions (world units) */
export const BASIN_SIZE = 16;
export const WALL_HEIGHT = 0.8;
export const WALL_THICKNESS = 0.1;

/** Camera zoom constraints */
export const CAMERA_MIN_DISTANCE = 2;
export const CAMERA_MAX_DISTANCE = 20;
export const CAMERA_MIN_POLAR_ANGLE = 0.2;
export const CAMERA_MAX_POLAR_ANGLE = Math.PI / 2.2;

/**
 * Create four basin wall meshes around the 16×16 perimeter.
 * Returns an array of wall meshes.
 */
export function createBasinWalls() {
  const material = new THREE.MeshStandardMaterial({ color: 0x8b6f47 }); // warm earth tone
  const halfBasin = BASIN_SIZE / 2;
  const walls = [];

  // Wall configs: [width, height, depth, x, y, z]
  const configs = [
    // North wall (along +Z edge)
    [BASIN_SIZE + WALL_THICKNESS * 2, WALL_HEIGHT, WALL_THICKNESS, 0, WALL_HEIGHT / 2, halfBasin + WALL_THICKNESS / 2],
    // South wall (along -Z edge)
    [BASIN_SIZE + WALL_THICKNESS * 2, WALL_HEIGHT, WALL_THICKNESS, 0, WALL_HEIGHT / 2, -(halfBasin + WALL_THICKNESS / 2)],
    // East wall (along +X edge)
    [WALL_THICKNESS, WALL_HEIGHT, BASIN_SIZE, halfBasin + WALL_THICKNESS / 2, WALL_HEIGHT / 2, 0],
    // West wall (along -X edge)
    [WALL_THICKNESS, WALL_HEIGHT, BASIN_SIZE, -(halfBasin + WALL_THICKNESS / 2), WALL_HEIGHT / 2, 0],
  ];

  for (const [w, h, d, x, y, z] of configs) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.name = 'basin-wall';
    walls.push(mesh);
  }

  return walls;
}

/**
 * Initialise the Three.js scene with WebGPURenderer, camera, and lighting.
 * @returns {Promise<{ scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGPURenderer }>}
 */
export async function init() {
  // --- Scene ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5e6c8); // warm sandy background

  // --- Camera (isometric-like perspective above basin) ---
  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    200
  );
  camera.position.set(8, 10, 8);
  camera.lookAt(BASIN_CENTRE);

  // --- Lighting (warm diorama feel) ---
  // Hemisphere: warm white sky, warm brown ground
  const hemiLight = new THREE.HemisphereLight(0xffeedd, 0x8b7355, 2);
  scene.add(hemiLight);

  // Directional: warm white, positioned above and to the side
  const dirLight = new THREE.DirectionalLight(0xfff4e0, 3);
  dirLight.position.set(10, 16, 8);
  scene.add(dirLight);

  // --- WebGPU Renderer ---
  const renderer = new THREE.WebGPURenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
  await renderer.init();

  // --- Window resize handler ---
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Add basin walls (Req 15.4)
  const walls = createBasinWalls();
  for (const wall of walls) {
    scene.add(wall);
  }

  // Render one frame to confirm the renderer works (warm background visible)
  renderer.render(scene, camera);

  return { scene, camera, renderer };
}

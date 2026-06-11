import * as THREE from 'three';
import { WORLD_SIZE } from '../core/Constants.js';

export const COLORS = {
  sky: 0xa7bdcb,
  fog: 0xa7bdcb,
  earthLow: 0x6e5f49,
  earthHigh: 0xb7a87e,
  sand: 0xd9bd7f,
  clay: 0xb0664a,
  stone: 0x8d9499,
  waterShallow: 0x84bccf,
  waterDeep: 0x255f7e,
  houseWall: 0xf2e3c2,
  houseRoof: 0xc75b39,
  window: 0xffd98a,
  basin: 0x453627,
};

export class SceneBuilder {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.sky);
    this.scene.fog = new THREE.Fog(COLORS.fog, 18, 42);

    this.camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 9, 9.5);

    const hemi = new THREE.HemisphereLight(0xdfeaf2, 0x6b5d49, 0.85);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff2dd, 1.25);
    key.position.set(-6, 10, 4);
    this.scene.add(key);

    this._addBasinSkirt();

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  _addBasinSkirt() {
    // The tabletop box the diorama sits in.
    const s = WORLD_SIZE;
    const mat = new THREE.MeshLambertMaterial({ color: COLORS.basin });
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(s + 0.5, 1.6, s + 0.5), mat);
    skirt.position.y = -0.82;
    this.scene.add(skirt);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

import * as THREE from 'three';

export class SceneBuilder {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(0x87CEEB); // sky blue background
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    // Subtle fog for depth
    this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.015);

    this.camera = new THREE.PerspectiveCamera(
      40,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );

    // Warm hemisphere light (sky/ground)
    const hemi = new THREE.HemisphereLight(0xffeedd, 0x446633, 1.0);
    this.scene.add(hemi);

    // Main directional light with warm tone
    const dir = new THREE.DirectionalLight(0xfff5e0, 0.8);
    dir.position.set(-5, 12, 8);
    this.scene.add(dir);

    // Subtle fill light from opposite side
    const fill = new THREE.DirectionalLight(0xc0d0ff, 0.3);
    fill.position.set(8, 5, -5);
    this.scene.add(fill);

    this._onResize = () => {
      this.camera.aspect = container.clientWidth / container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', this._onResize);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  get canvas() {
    return this.renderer.domElement;
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
  }
}

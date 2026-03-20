import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class CameraControls {
  constructor(camera, canvas, cameraConfig) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, canvas);

    this.controls.minDistance = 3;
    this.controls.maxDistance = 40;
    this.controls.minPolarAngle = 0.1;          // nearly horizontal
    this.controls.maxPolarAngle = Math.PI / 2;  // straight down
    this.controls.enablePan = true;
    this.controls.panSpeed = 1.0;
    this.controls.mouseButtons = {
      LEFT: null,     // LMB reserved for building
      MIDDLE: 2,      // MMB = pan
      RIGHT: 0        // RMB = orbit (full spherical)
    };

    if (cameraConfig) {
      const p = cameraConfig.initialPosition;
      camera.position.set(p.x, p.y, p.z);
      const t = cameraConfig.lookAt;
      this.controls.target.set(t.x, t.y, t.z);
    }

    this.controls.update();

    this._defaultTarget = cameraConfig?.lookAt
      ? { x: cameraConfig.lookAt.x, y: cameraConfig.lookAt.y, z: cameraConfig.lookAt.z }
      : { x: 8, y: 0, z: 8 };

    this._onKeyDown = (e) => this._handleKey(e);
    window.addEventListener('keydown', this._onKeyDown);
  }

  _handleKey(e) {
    const angle = Math.PI / 4;
    switch (e.key) {
      case 'q':
      case 'Q':
        this._rotateAroundTarget(-angle);
        break;
      case 'e':
      case 'E':
        this._rotateAroundTarget(angle);
        break;
      case 'f':
      case 'F':
        this.controls.target.set(
          this._defaultTarget.x,
          this._defaultTarget.y,
          this._defaultTarget.z
        );
        this.controls.update();
        break;
    }
  }

  _rotateAroundTarget(angle) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const x = offset.x * cos - offset.z * sin;
    const z = offset.x * sin + offset.z * cos;
    offset.x = x;
    offset.z = z;
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }

  update() {
    this.controls.update();
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    this.controls.dispose();
  }
}

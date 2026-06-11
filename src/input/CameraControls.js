import * as THREE from 'three';

// Minimal orbit camera: RMB-drag orbit, wheel zoom, Q/E 45° steps, F refocus.
// One gesture = one purpose; LMB stays free for building.
export class CameraControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.dom = domElement;
    this.target = new THREE.Vector3(0, 0.15, 0);
    this.radius = 12.5;
    this.theta = 0;            // azimuth
    this.phi = 0.95;           // polar (0 = top-down)
    this._goalTheta = this.theta;
    this._goalRadius = this.radius;
    this._dragging = false;

    domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    domElement.addEventListener('pointerdown', (e) => {
      if (e.button === 2) { this._dragging = true; domElement.setPointerCapture(e.pointerId); }
    });
    domElement.addEventListener('pointerup', (e) => {
      if (e.button === 2) this._dragging = false;
    });
    domElement.addEventListener('pointermove', (e) => {
      if (!this._dragging) return;
      this.theta -= e.movementX * 0.0055;
      this._goalTheta = this.theta;
      this.phi = Math.min(1.35, Math.max(0.18, this.phi - e.movementY * 0.0045));
    });
    domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      this._goalRadius = Math.min(20, Math.max(4.5, this._goalRadius * (1 + e.deltaY * 0.0011)));
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'q' || e.key === 'Q') this._goalTheta += Math.PI / 4;
      if (e.key === 'e' || e.key === 'E') this._goalTheta -= Math.PI / 4;
      if (e.key === 'f' || e.key === 'F') {
        this._goalTheta = 0; this.phi = 0.95; this._goalRadius = 12.5;
      }
    });
    this.update(0);
  }

  update(dt) {
    const k = 1 - Math.exp(-dt * 8);
    this.theta += (this._goalTheta - this.theta) * k;
    this.radius += (this._goalRadius - this.radius) * k;
    const sp = Math.sin(this.phi), cp = Math.cos(this.phi);
    this.camera.position.set(
      this.target.x + this.radius * sp * Math.sin(this.theta),
      this.target.y + this.radius * cp,
      this.target.z + this.radius * sp * Math.cos(this.theta),
    );
    this.camera.lookAt(this.target);
  }
}

// First-person weapon presentation: rendered in its own pass (never clips into walls),
// posed from the firearm's real mechanical state.
import * as THREE from '../vendor/three.module.js';
import { buildWeaponModel, buildMagModel } from './weaponmodels.js';
import { ATTACHMENTS } from './data/weapons.js';

const sm = (x) => x * x * (3 - 2 * x);
export class ViewModel {
  constructor() {
    this.scene = new THREE.Scene(); this.cam = new THREE.PerspectiveCamera(52, 16 / 9, 0.01, 10);
    this.hemi = new THREE.HemisphereLight(0xdfe6ee, 0x4a463c, 1); this.dir = new THREE.DirectionalLight(0xfff2dd, 1.5); this.dir.position.set(0.4, 1, 0.5); this.rim = new THREE.DirectionalLight(0xbcd0e8, 0.55); this.rim.position.set(-0.8, 0.3, 0.6); this.scene.add(this.hemi, this.dir, this.rim);
    this.root = new THREE.Group(); this.scene.add(this.root); this.model = null; this.hand = null; this.kz = 0; this.kr = 0; this.flashT = 0; this.hb = 0; this.grabK = 0; this.openK = 0; this.sprintK = 0;
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.4, 'rgba(255,170,60,0.6)'); gr.addColorStop(1, 'rgba(255,120,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthTest: false, transparent: true })); this.flash.visible = false; this.scene.add(this.flash);
    this.cases = []; const cg = new THREE.CylinderGeometry(0.005, 0.005, 0.02, 6), cm = new THREE.MeshStandardMaterial({ color: 0xb08a3c, metalness: 0.8, roughness: 0.4 }), sg = new THREE.CylinderGeometry(0.009, 0.009, 0.055, 6), sm2 = new THREE.MeshStandardMaterial({ color: 0x8a2a22, roughness: 0.7 });
    for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(cg, cm); m.visible = false; this.scene.add(m); this.cases.push({ m, t: 9, v: new THREE.Vector3(), geo: [cg, sg], mat: [cm, sm2] }); }
  }
  setWeapon(f) { if (this.model) this.root.remove(this.model.group); this.model = null; this.f = f; if (f) { this.model = buildWeaponModel(f, true); this.root.add(this.model.group); } }
  setHand(item) { if (this.hand) this.root.remove(this.hand.group); this.hand = null; if (item && item.kind === 'mag') { this.hand = buildMagModel(item); this.root.add(this.hand.group); } }
  handBump() { this.hb = 1; }
  kick(back, pitchDeg) { this.kz += back; this.kr += pitchDeg * 0.011; this.flashT = this.f && this.f.suppressed && this.f.att.muzzle.cond > 0.3 ? 0 : 0.05; }
  kickSlide() { if (this.model) this.model.vis.kick = 1; }
  ejectCase(shell) { const c = this.cases.find(c => c.t > 0.8) || this.cases[0]; if (!this.model) return; c.t = 0; c.m.geometry = c.geo[shell ? 1 : 0]; c.m.material = c.mat[shell ? 1 : 0]; c.m.visible = true; this.model.group.updateWorldMatrix(true, false); c.m.position.set(0.012, this.model.sightY - 0.01, 0).applyMatrix4(this.model.group.matrixWorld); c.v.set(1.3 + Math.random() * 0.6, 1.2 + Math.random() * 0.5, 0.2 - Math.random() * 0.4); }
  update(dt, p, light, aspect) {
    this.cam.aspect = aspect; this.cam.updateProjectionMatrix();
    this.hemi.intensity = 0.55 + 1.0 * light; this.dir.intensity = 0.7 + 1.9 * light;
    this.kz += (0 - this.kz) * Math.min(1, dt * 14); this.kr += (0 - this.kr) * Math.min(1, dt * 11); this.hb = Math.max(0, this.hb - dt * 5);
    for (const c of this.cases) if (c.m.visible) { c.t += dt; c.v.y -= 9.8 * dt; c.m.position.addScaledVector(c.v, dt); c.m.rotation.x += dt * 20; c.m.rotation.z += dt * 13; if (c.t > 0.8) c.m.visible = false; }
    const m = this.model, f = this.f, bobX = Math.sin(p.bob) * 0.005 * Math.min(1, p.speed / 3), bobY = Math.abs(Math.cos(p.bob)) * 0.004 * Math.min(1, p.speed / 3);
    this.sprintK += ((p.sprinting ? 1 : 0) - this.sprintK) * Math.min(1, dt * 8);
    if (m && f) {
      m.sync(dt);
      const long = m.kind === 'long', a = sm(p.aim), ins = sm(Math.min(1, p.inspect)), sightY = m.scopeY ?? m.sightY;
      this.grabK += ((f.grabbed ? 1 : 0) - this.grabK) * Math.min(1, dt * 10);
      const wantOpen = f.cyl && (f.cylOpen || f.gateOpen) ? 1 : 0; this.openK += (wantOpen - this.openK) * Math.min(1, dt * 8);
      let px = long ? 0.1 : 0.115, py = long ? -0.155 : -0.135, pz = long ? -0.27 : -0.36, rx = 0, ry = 0.05, rz = 0;
      const ax = 0, ay = -sightY, az = long ? -0.11 - m.eyeZ : -0.3 - m.rearZ;   // long guns: eye just behind the receiver, never inside it
      px += (ax - px) * a; py += (ay - py) * a; pz += (az - pz) * a; ry *= 1 - a;
      px += bobX * (1 - a * 0.9); py -= bobY * (1 - a * 0.9);
      const s = this.sprintK * (1 - ins); px += 0.03 * s; py -= 0.07 * s; rx -= 0.45 * s; ry += 0.5 * s;
      const gk = this.grabK * (1 - ins) * (1 - a * 0.6); rz += 0.3 * gk; py += 0.025 * gk; rx += 0.08 * gk;
      const ok = this.openK * (1 - ins); rx += 0.45 * ok; ry -= 0.35 * ok; py += 0.03 * ok; px -= 0.03 * ok;
      if (ins > 0.001) { const ix = long ? -0.16 : -0.07, iy = long ? -0.03 : -0.04, iz = long ? -0.62 : -0.34; px += (ix - px) * ins; py += (iy - py) * ins; pz += (iz - pz) * ins; rx += (0.2 + p.insRot.x - rx) * ins; ry += (-1.25 + p.insRot.y - ry) * ins; rz += (0.3 - rz) * ins; }
      const dr = p.drawT / 0.4; py -= dr * 0.28; rx -= dr * 0.7;
      if (p.busy) { py -= 0.25; rx -= 0.5; }
      m.group.position.set(px, py, pz + this.kz); m.group.rotation.set(rx + this.kr, ry, rz, 'YXZ');
      const scoped = f.att.optic && ATTACHMENTS[f.att.optic.id].zoom > 1 && p.aim > 0.9; m.group.visible = !scoped;
      this.flashT -= dt; this.flash.visible = this.flashT > 0 && !scoped;
      if (this.flash.visible) { m.group.updateWorldMatrix(true, false); this.flash.position.copy(m.muzzle).applyMatrix4(m.group.matrixWorld); this.flash.position.z -= 0.03 + (m.muzzleLen || 0); const sc = (long ? 0.2 : 0.13) * (0.7 + Math.random() * 0.6); this.flash.scale.set(sc, sc, sc); this.flash.material.rotation = Math.random() * 6; }
    } else this.flash.visible = false;
    if (this.hand) {
      this.hand.sync(); const ins = sm(Math.min(1, p.inspect)), h = this.hand.group;
      h.position.set(-0.14 + 0.06 * ins + bobX, -0.17 + 0.1 * ins - this.hb * 0.02 - bobY - (p.busy ? 0.3 : 0), -0.33 + 0.07 * ins); h.rotation.set(0.35 - 0.2 * ins, 0.5 - 0.3 * ins, 0.25 - 0.2 * ins);
    }
  }
  render(renderer) { renderer.clearDepth(); renderer.render(this.scene, this.cam); }
}

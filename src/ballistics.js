// Projectiles: travel time, gravity drop, material penetration and hit-location damage.
import * as THREE from '../vendor/three.module.js';
import { CALIBERS } from './data/weapons.js';

// penetration resistance per metre of material
const RES = { plaster: 3, wood: 6, fabric: 2, glass: 1, roof: 8, metal: 40, brick: 28, concrete: 60, tile: 60, chain: 0 };
const PUFF = { ground: 0x6a6252, wood: 0x8a7350, plaster: 0xb9b4a6, concrete: 0x9a9890, brick: 0x8a5a48, metal: 0xd0c8a0, fabric: 0x777266, flesh: 0x3a0f0c };
const bulletFilter = (b) => b.mat !== 'chain';

export class Ballistics {
  constructor(game, scene) {
    this.g = game; this.scene = scene; this.bullets = []; this.fx = []; this.holes = []; this.holeI = 0; this.sndT = 0;
    const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
    for (let i = 0; i < 40; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); s.visible = false; scene.add(s); this.fx.push({ s, t: 1, v: [0, 0, 0] }); }
    const hg = new THREE.CircleGeometry(0.022, 8), hm = new THREE.MeshBasicMaterial({ color: 0x0c0b0a, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    for (let i = 0; i < 80; i++) { const m = new THREE.Mesh(hg, hm); m.visible = false; scene.add(m); this.holes.push(m); }
    this.fxI = 0;
  }
  fire(eye, dir, f, spreadDeg) {
    const cal = CALIBERS[f.def.cal], n = cal.pellets, dm = f.damageMult();
    // orthonormal basis around dir
    const up = Math.abs(dir.y) > 0.95 ? [1, 0, 0] : [0, 1, 0];
    let rx = dir.z * up[1] - dir.y * up[2], ry = dir.x * up[2] - dir.z * up[0], rz = dir.y * up[0] - dir.x * up[1]; const rl = Math.hypot(rx, ry, rz); rx /= rl; ry /= rl; rz /= rl;
    const ux = ry * dir.z - rz * dir.y, uy = rz * dir.x - rx * dir.z, uz = rx * dir.y - ry * dir.x;
    const base = spreadDeg * 0.01745, a0 = Math.random() * 6.2832, r0 = Math.tan(base) * Math.sqrt(Math.random());
    for (let i = 0; i < n; i++) {
      let ox = Math.cos(a0) * r0, oy = Math.sin(a0) * r0;
      if (n > 1) { const a = Math.random() * 6.2832, r = Math.tan(cal.spread * 0.01745) * Math.sqrt(Math.random()); ox += Math.cos(a) * r; oy += Math.sin(a) * r; }
      let dx = dir.x + rx * ox + ux * oy, dy = dir.y + ry * ox + uy * oy, dz = dir.z + rz * ox + uz * oy; const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
      const v = cal.vel * (0.85 + 0.15 * dm) * (f.suppressed && cal.vel < 400 ? 0.92 : 1);
      this.bullets.push({ x: eye.x + dx * 0.25, y: eye.y + dy * 0.25 - 0.02, z: eye.z + dz * 0.25, vx: dx * v, vy: dy * v, vz: dz * v, dmg: cal.dmg * dm, pen: cal.pen * (0.8 + 0.2 * dm), pen0: cal.pen, rifle: cal.pen >= 2, life: 0, sx: eye.x, sz: eye.z });
    }
  }
  puff(x, y, z, mat, nx = 0, ny = 1, nz = 0, big = 1) {
    const f = this.fx[this.fxI = (this.fxI + 1) % this.fx.length]; f.t = 0; f.s.visible = true; f.s.position.set(x + nx * 0.03, y + ny * 0.03, z + nz * 0.03); f.s.material.color.setHex(PUFF[mat] ?? 0x8a8478); f.size = (mat === 'flesh' ? 0.16 : 0.22) * big; f.v = [nx * 0.6, ny * 0.6 + 0.3, nz * 0.6]; f.dur = mat === 'flesh' ? 0.3 : 0.5;
  }
  hole(x, y, z, nx, ny, nz) { const m = this.holes[this.holeI = (this.holeI + 1) % this.holes.length]; m.visible = true; m.position.set(x + nx * 0.004, y + ny * 0.004, z + nz * 0.004); m.lookAt(x + nx, y + ny, z + nz); }
  update(dt) {
    const g = this.g, W = g.world, Z = g.zombies; this.sndT -= dt;
    for (const f of this.fx) if (f.s.visible) { f.t += dt / f.dur; if (f.t >= 1) { f.s.visible = false; continue; } const sc = f.size * (0.5 + f.t * 1.6); f.s.scale.set(sc, sc, sc); f.s.material.opacity = (1 - f.t) * 0.8; f.s.position.x += f.v[0] * dt; f.s.position.y += f.v[1] * dt; f.s.position.z += f.v[2] * dt; }
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i]; b.life += dt; b.vy -= 9.81 * dt;
      let rem = Math.hypot(b.vx, b.vy, b.vz) * dt, alive = true, guard = 0; const sp = rem / dt; let dx = b.vx / sp, dy = b.vy / sp, dz = b.vz / sp;
      while (alive && rem > 0.001 && guard++ < 6) {
        const wh = W.raycast(b.x, b.y, b.z, dx, dy, dz, rem, bulletFilter), zh = Z.raycast(b.x, b.y, b.z, dx, dy, dz, wh ? wh.t : rem);
        if (zh) {
          const hx = b.x + dx * zh.t, hy = b.y + dy * zh.t, hz = b.z + dz * zh.t, r = Z.hit(zh, b.dmg, dx, dz, b.rifle, b.sx, b.sz);
          this.puff(hx, hy, hz, r.armor ? 'metal' : 'flesh', -dx, 0.2, -dz); if (this.sndT <= 0) { this.sndT = 0.04; g.audio.play3d(r.armor ? 'armor_hit' : 'impact_flesh', hx, hy, hz, 0.8, 1, 4); }
          if (b.rifle && b.pen > 1.4 && !r.armor) { b.pen -= 1.2; b.dmg *= 0.5; const adv = zh.t + 0.5; b.x += dx * adv; b.y += dy * adv; b.z += dz * adv; rem -= adv; } else alive = false;
        } else if (wh) {
          const hx = b.x + dx * wh.t, hy = b.y + dy * wh.t, hz = b.z + dz * wh.t;
          this.puff(hx, hy, hz, wh.mat, wh.nx, wh.ny, wh.nz); if (wh.box) this.hole(hx, hy, hz, wh.nx, wh.ny, wh.nz);
          if (this.sndT <= 0) { this.sndT = 0.05; g.audio.play3d(wh.mat === 'metal' ? 'impact_metal' : 'impact', hx, hy, hz, 0.7, 1, 4); }
          const res = wh.box ? RES[wh.mat] ?? 30 : 1e9, thick = wh.tExit - wh.t, cost = thick * res;
          if (cost < b.pen && thick < 3) { b.pen -= cost; b.dmg *= 1 - 0.5 * cost / b.pen0; const adv = wh.tExit + 0.02; b.x += dx * adv; b.y += dy * adv; b.z += dz * adv; rem -= adv; this.puff(b.x, b.y, b.z, wh.mat, dx, 0, dz, 0.7); }
          else alive = false;
        } else { b.x += dx * rem; b.y += dy * rem; b.z += dz * rem; rem = 0; }
      }
      if (!alive || b.life > 1.6 || b.y < -1 || b.x < -20 || b.z < -20 || b.x > W.size + 20 || b.z > W.size + 20) this.bullets.splice(i, 1);
    }
  }
  dispose() { for (const f of this.fx) this.scene.remove(f.s); for (const h of this.holes) this.scene.remove(h); }
}

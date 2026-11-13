// The infected: articulated bodies, perception (sight + hearing), state machine AI and grid pathfinding.
import * as THREE from '../vendor/three.module.js';

export const ZTYPES = {
  standard: { hp: 100, walk: 0.9, run: 3.1, dmg: [14, 22], r: 0.3, windup: 0.42, w: 1, hgt: 1 },
  bloater: { hp: 330, walk: 0.7, run: 1.9, dmg: [26, 36], r: 0.45, windup: 0.6, w: 1.55, hgt: 1.08 },
  runner: { hp: 65, walk: 1.3, run: 5.8, dmg: [10, 16], r: 0.28, windup: 0.28, w: 0.85, hgt: 1 },
  crawler: { hp: 55, walk: 0.6, run: 1.7, dmg: [8, 14], r: 0.3, windup: 0.4, w: 0.95, hgt: 1, prone: true },
  armored: { hp: 130, walk: 0.9, run: 2.8, dmg: [16, 24], r: 0.32, windup: 0.45, w: 1.08, hgt: 1.02, armor: true },
};
const SKIN = [0x8c917c, 0x7f8a78, 0x99947f, 0x868c84, 0x76806c], SHIRT = [0x4a5560, 0x6a5a4a, 0x5a3a36, 0x7a7868, 0x3d4a3d, 0x8a8674, 0x4d4a5a, 0x6b6f5a], PANTS = [0x2e3440, 0x3a3630, 0x4a4a48, 0x2a3028, 0x54493a];
const BOX = new THREE.BoxGeometry(1, 1, 1), HEAD = new THREE.IcosahedronGeometry(0.5, 1);
const matCache = new Map(); const M = (c, r = 0.95) => { const k = c + '|' + r; if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 })); return matCache.get(k); };
const part = (parent, geo, m, sx, sy, sz, x, y, z) => { const o = new THREE.Mesh(geo, m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
const piv = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

function buildBody(type, seed) {
  const T = ZTYPES[type], w = T.w, skin = M(SKIN[seed % SKIN.length]), shirt = M(type === 'armored' ? 0x2a2f38 : SHIRT[(seed >> 3) % SHIRT.length]), pants = M(PANTS[(seed >> 5) % PANTS.length]), dark = M(0x1c1d20, 0.6);
  const root = new THREE.Group(), body = piv(root, 0, 0, 0), hips = piv(body, 0, 0.92 * T.hgt, 0), B = { root, body, hips };
  part(hips, BOX, pants, 0.36 * w, 0.2, 0.22 * w, 0, 0, 0);
  B.torso = piv(hips, 0, 0.08, 0); part(B.torso, BOX, shirt, 0.42 * w, 0.52, 0.24 * (type === 'bloater' ? 1.9 : w), 0, 0.28, type === 'bloater' ? 0.05 : 0);
  if (type === 'bloater') part(B.torso, HEAD, skin, 0.62, 0.55, 0.6, 0, 0.14, 0.12);
  if (T.armor) { part(B.torso, BOX, dark, 0.47, 0.42, 0.3, 0, 0.3, 0); part(B.torso, BOX, M(0x3a4048), 0.3, 0.1, 0.02, 0, 0.42, 0.155); }
  B.head = piv(B.torso, 0, 0.58, 0); part(B.head, HEAD, skin, 0.2, 0.25, 0.22, 0, 0.11, 0.01); part(B.head, BOX, M(0x2a2622), 0.2, 0.09, 0.2, 0, 0.21, -0.02);
  part(B.head, BOX, M(0x1a1410), 0.11, 0.025, 0.02, 0, 0.11, 0.115); part(B.head, BOX, M(0x2a1f1a), 0.07, 0.03, 0.02, 0, 0.04, 0.11);
  if (T.armor) { part(B.head, HEAD, dark, 0.27, 0.22, 0.28, 0, 0.17, -0.01); part(B.head, BOX, dark, 0.26, 0.05, 0.1, 0, 0.14, 0.12); }
  for (const s of [-1, 1]) {
    const sh = piv(B.torso, s * (0.26 * w), 0.5, 0); part(sh, BOX, shirt, 0.11, 0.3, 0.11, 0, -0.14, 0); const el = piv(sh, 0, -0.29, 0); part(el, BOX, skin, 0.085, 0.28, 0.085, 0, -0.13, 0); part(el, BOX, skin, 0.08, 0.1, 0.05, 0, -0.3, 0.01);
    const hip = piv(hips, s * 0.1 * w, -0.06, 0); part(hip, BOX, pants, 0.15 * w, 0.44, 0.15 * w, 0, -0.2, 0); const kn = piv(hip, 0, -0.42, 0); part(kn, BOX, pants, 0.12, 0.42, 0.12, 0, -0.2, 0); part(kn, BOX, dark, 0.11, 0.07, 0.24, 0, -0.42, 0.05);
    B[s < 0 ? 'armL' : 'armR'] = sh; B[s < 0 ? 'foreL' : 'foreR'] = el; B[s < 0 ? 'legL' : 'legR'] = hip; B[s < 0 ? 'shinL' : 'shinR'] = kn;
  }
  if (T.prone) { body.rotation.x = 1.42; body.position.set(0, 0.24, -0.75); }
  return B;
}

export class Zombies {
  constructor(game, scene, L) {
    this.g = game; this.scene = scene; this.L = L; this.list = []; this.corpses = []; this.initial = 0; this.respawnT = 60; this.budget = 3; this.tick = 0;
    for (const s of L.zombies) this.spawn(s.x, s.z, s.type);
    this.initial = this.list.length;
  }
  spawn(x, z, type) {
    const T = ZTYPES[type], seed = (Math.random() * 1e6) | 0, B = buildBody(type, seed);
    const zb = { type, T, B, x, z, y: 0, face: Math.random() * 6.28, hp: T.hp, state: 'idle', t: 0, percT: Math.random() * 0.3, seenT: 0, lostT: 0, path: null, pi: 0, pathT: 0, tx: x, tz: z, lkx: x, lkz: z, wanderT: 3 + Math.random() * 12, groanT: 2 + Math.random() * 12, stepT: 0, phase: Math.random() * 6, stagger: 0, legDmg: 0, hobbled: false, doorT: 0, bangT: 0, stuckT: 0, sx: x, sz: z, stuckN: 0, atkT: 0, hitDone: false, searchT: 0, alive: true, deadT: 0, fall: Math.random() < 0.5 ? 1 : -1, speedNow: 0, sees: false, fast: false };
    B.root.position.set(x, 0, z); this.scene.add(B.root); this.list.push(zb); return zb;
  }
  get alive() { return this.list.length; }

  // ---------- hearing ----------
  noise(x, z, radius, kind) {
    const loud = kind === 'gunshot', inSrc = this.g.indoorAt(x, z);
    for (const zb of this.list) {
      if (zb.state === 'chase' && zb.sees) continue;
      const d = Math.hypot(zb.x - x, zb.z - z), eff = radius * (this.g.indoorAt(zb.x, zb.z) !== inSrc ? 0.7 : 1);
      if (d > eff || (!loud && d > eff * 0.75 && Math.random() < 0.5)) continue;
      const err = loud ? d * 0.1 : d * 0.25, hx = x + (Math.random() - 0.5) * err, hz = z + (Math.random() - 0.5) * err;
      if (zb.state === 'chase' || zb.state === 'attack') { zb.lkx = hx; zb.lkz = hz; continue; }
      if (zb.state === 'investigate' && !loud && kind !== 'door' && Math.random() < 0.6) continue;
      zb.state = 'investigate'; zb.tx = hx; zb.tz = hz; zb.path = null; zb.fast = loud || zb.fast; zb.t = 0;
    }
  }

  // ---------- bullets ----------
  raycast(ox, oy, oz, dx, dy, dz, maxT) {
    let best = null;
    for (const zb of this.list) {
      const cx = zb.x - ox, cy = 0.9 - oy, cz = zb.z - oz, tc = cx * dx + cy * dy + cz * dz; if (tc < -1.5 || tc > maxT + 1.5) continue;
      const px = cx - dx * tc, py = cy - dy * tc, pz = cz - dz * tc; if (px * px + py * py + pz * pz > 2.6) continue;
      for (const s of this.spheres(zb)) {
        const lx = s[0] - ox, ly = s[1] - oy, lz = s[2] - oz, b = lx * dx + ly * dy + lz * dz, c = lx * lx + ly * ly + lz * lz - s[3] * s[3], disc = b * b - c; if (disc < 0) continue;
        const t = b - Math.sqrt(disc); if (t < 0 || t > maxT) continue; if (!best || t < best.t) best = { t, zb, part: s[4], py: oy + dy * t - s[1] };
      }
    }
    return best;
  }
  spheres(zb) {
    const T = zb.T, s = T.hgt, w = T.w, fx = Math.sin(zb.face), fz = Math.cos(zb.face), rx = fz, rz = -fx, x = zb.x, z = zb.z, out = [];
    if (T.prone) { out.push([x + fx * 0.78, 0.3, z + fz * 0.78, 0.14, 'head'], [x + fx * 0.42, 0.24, z + fz * 0.42, 0.22, 'torso'], [x + fx * 0.05, 0.22, z + fz * 0.05, 0.2, 'torso'], [x - fx * 0.4, 0.15, z - fz * 0.4, 0.14, 'limb'], [x - fx * 0.8, 0.13, z - fz * 0.8, 0.13, 'limb']); return out; }
    out.push([x + fx * 0.03, 1.66 * s, z + fz * 0.03, 0.135, 'head'], [x, 1.32 * s, z, 0.22 * w, 'torso'], [x, 1.03 * s, z, 0.21 * w, 'torso']);
    for (const sd of [-1, 1]) { out.push([x + rx * sd * 0.11, 0.7 * s, z + rz * sd * 0.11, 0.11, 'leg'], [x + rx * sd * 0.11, 0.42 * s, z + rz * sd * 0.11, 0.1, 'leg'], [x + rx * sd * 0.11, 0.15, z + rz * sd * 0.11, 0.1, 'leg'], [x + rx * sd * 0.3 * w, 1.28 * s, z + rz * sd * 0.3 * w, 0.09, 'limb'], [x + rx * sd * 0.31 * w + fx * 0.1, 1.02 * s, z + rz * sd * 0.31 * w + fz * 0.1, 0.085, 'limb']); }
    return out;
  }
  // returns {killed, armor}
  hit(h, dmg, bdx, bdz, rifle, sx, sz) {
    const zb = h.zb, T = zb.T; let mult = h.part === 'head' ? 4 : h.part === 'torso' ? 1 : 0.55, armor = false;
    if (T.armor) {
      const front = bdx * Math.sin(zb.face) + bdz * Math.cos(zb.face) < -0.25;
      if (h.part === 'head' && !(front && h.py < 0.02)) { mult *= rifle ? 0.55 : 0.2; armor = true; }   // helmet; the face is only open from the front
      if (h.part === 'torso') { mult *= rifle ? 0.6 : 0.25; armor = true; }
    }
    if (T === ZTYPES.bloater && h.part === 'torso') mult *= 0.8;
    const d = dmg * mult; zb.hp -= d;
    if (h.part === 'leg' || (T.prone && h.part === 'limb')) { zb.legDmg += d; if (!zb.hobbled && zb.legDmg > T.hp * 0.35) zb.hobbled = true; }
    if (d > 18 && T !== ZTYPES.bloater || h.part === 'head') zb.stagger = Math.max(zb.stagger, 0.32);
    if (zb.hp <= 0) { this.kill(zb); return { killed: true, armor }; }
    this.g.audio.play3d('z_pain', zb.x, 1.4, zb.z, 0.6, T === ZTYPES.bloater ? 0.6 : 1, 3);
    if (zb.state !== 'chase' && zb.state !== 'attack') { zb.state = 'investigate'; zb.tx = sx + (Math.random() - 0.5) * 4; zb.tz = sz + (Math.random() - 0.5) * 4; zb.fast = true; zb.path = null; }
    return { killed: false, armor };
  }
  kill(zb) {
    zb.alive = false; zb.state = 'dead'; zb.deadT = 0; this.list.splice(this.list.indexOf(zb), 1); this.corpses.push(zb);
    this.g.audio.play3d('z_death', zb.x, 1.2, zb.z, 0.7, zb.T === ZTYPES.bloater ? 0.6 : zb.type === 'runner' ? 1.3 : 1, 3);
    if (this.corpses.length > 30) { const c = this.corpses.shift(); this.scene.remove(c.B.root); }
  }

  // ---------- per-frame ----------
  update(dt) {
    const g = this.g, p = g.player; this.budget = 3; this.tick++;
    const day = g.sky.daylight, pcx = p.pos.x, pcz = p.pos.z;
    for (const zb of this.corpses) if (zb.deadT < 1) { zb.deadT = Math.min(1, zb.deadT + dt * 2.2); const e = 1 - Math.pow(1 - zb.deadT, 2); if (zb.T.prone) zb.B.body.rotation.z = e * 0.5 * zb.fall; else { zb.B.root.rotation.x = zb.fall * e * 1.5; zb.B.root.position.y = e * 0.14; zb.B.armL.rotation.x = -0.6 * e; zb.B.armR.rotation.x = 0.4 * e; } }
    // reinforcements drift in from the edges so the town never becomes safe
    this.respawnT -= dt;
    if (this.respawnT <= 0) { this.respawnT = 70 + Math.random() * 40; if (this.list.length < this.initial * 0.7) for (let a = 0; a < 30; a++) { const x = 3 + Math.random() * (this.L.W - 6), z = 3 + Math.random() * (this.L.H - 6), c = (x | 0) + (z | 0) * this.L.W; if (!this.L.reach[c] || this.L.blocked[c] || this.L.cellB[c] || Math.hypot(x - pcx, z - pcz) < 75) continue; this.spawn((x | 0) + 0.5, (z | 0) + 0.5, ['standard', 'standard', 'standard', 'runner', 'crawler', 'bloater'][(Math.random() * 6) | 0]); break; } }
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const zb = list[i], T = zb.T, dxp = pcx - zb.x, dzp = pcz - zb.z, dp = Math.hypot(dxp, dzp);
      if (dp > 150 && zb.state === 'idle') { zb.B.root.visible = false; continue; }
      zb.B.root.visible = true;
      // ----- perception -----
      zb.percT -= dt;
      if (zb.percT <= 0) {
        const iv = 0.18 + Math.random() * 0.08; zb.percT = iv; let sees = false;
        if (!p.dead) {
          const dormant = zb.state === 'idle' && day > 0.7 && !g.indoorAt(zb.x, zb.z);
          const range = (13 + 23 * day) * (p.crouched ? 0.6 : 1) * (g.lightActive && day < 0.35 ? 1.7 : 1) * (dormant ? 0.65 : 1) * (g.indoor && day > 0.3 ? 0.75 : 1);
          if (dp < range) { const dot = (Math.sin(zb.face) * dxp + Math.cos(zb.face) * dzp) / (dp || 1); if (dp < 2.2 || dot > 0.3) { const ey = T.prone ? 0.35 : 1.6 * T.hgt; sees = g.world.los(zb.x, ey, zb.z, pcx, p.pos.y + p.eyeH - 0.1, pcz) || g.world.los(zb.x, ey, zb.z, pcx, p.pos.y + 0.6, pcz); } }
        }
        zb.sees = sees;
        if (sees) { zb.seenT += iv; zb.lostT = 0; zb.lkx = pcx; zb.lkz = pcz; if (zb.state !== 'chase' && zb.state !== 'attack' && zb.seenT > 0.2 + dp * 0.02) this.alert(zb); }
        else { zb.seenT = Math.max(0, zb.seenT - iv * 0.5); if (zb.state === 'chase') { zb.lostT += iv; if (zb.lostT > 3.2) { zb.state = 'search'; zb.searchT = 9 + Math.random() * 6; zb.tx = zb.lkx; zb.tz = zb.lkz; zb.path = null; zb.t = 0; } } }
      }
      // ----- behaviour -----
      let speed = 0, tx = zb.tx, tz = zb.tz, want = false; zb.t += dt;
      if (zb.stagger > 0) zb.stagger -= dt;
      else switch (zb.state) {
        case 'idle':
          zb.wanderT -= dt;
          if (zb.wanderT <= 0) { const night = day < 0.3, rad = night ? 16 : 7; zb.wanderT = (night ? 4 : 9) + Math.random() * (night ? 7 : 14); const nx = zb.x + (Math.random() - 0.5) * 2 * rad, nz = zb.z + (Math.random() - 0.5) * 2 * rad; const c = (nx | 0) + (nz | 0) * this.L.W; if (nx > 2 && nz > 2 && nx < this.L.W - 2 && nz < this.L.H - 2 && this.L.reach[c] && !this.L.blocked[c]) { zb.tx = nx; zb.tz = nz; zb.path = null; zb.state = 'wander'; zb.t = 0; } }
          break;
        case 'wander': speed = T.walk; want = true; if (Math.hypot(zb.tx - zb.x, zb.tz - zb.z) < 0.8 || zb.t > 25) zb.state = 'idle'; break;
        case 'investigate': speed = zb.fast ? T.run * 0.8 : (T.walk + T.run) * 0.5; want = true; if (Math.hypot(zb.tx - zb.x, zb.tz - zb.z) < 1.3 || zb.t > 40) { zb.state = 'search'; zb.searchT = 7 + Math.random() * 6; zb.fast = false; zb.t = 0; zb.path = null; } break;
        case 'search': speed = (T.walk + T.run) * 0.45; want = true; zb.searchT -= dt;
          if (Math.hypot(zb.tx - zb.x, zb.tz - zb.z) < 1 || zb.t > 5) { zb.t = 0; const nx = zb.lkx + (Math.random() - 0.5) * 14, nz = zb.lkz + (Math.random() - 0.5) * 14, c = (nx | 0) + (nz | 0) * this.L.W; if (nx > 2 && nz > 2 && nx < this.L.W - 2 && nz < this.L.H - 2 && this.L.reach[c] && !this.L.blocked[c]) { zb.tx = nx; zb.tz = nz; zb.path = null; } }
          if (zb.searchT <= 0) { zb.state = 'idle'; zb.wanderT = 2 + Math.random() * 5; } break;
        case 'chase': {
          speed = T.run; want = true; tx = zb.tx = zb.lkx; tz = zb.tz = zb.lkz;
          const reach = T.r + 0.3 + 0.75;
          if (zb.sees && dp < reach && Math.abs(p.pos.y) < 1.25) { zb.state = 'attack'; zb.atkT = 0; zb.hitDone = false; g.audio.play3d('z_attack', zb.x, 1.4, zb.z, 0.9, T === ZTYPES.bloater ? 0.6 : zb.type === 'runner' ? 1.35 : 1, 2.5); }
          break;
        }
        case 'attack':
          zb.atkT += dt; zb.face = turn(zb.face, Math.atan2(dxp, dzp), dt * 7);
          if (!zb.hitDone && zb.atkT >= T.windup) { zb.hitDone = true; if (dp < T.r + 0.3 + 1.2 && Math.abs(p.pos.y) < 1.25 && !p.dead) p.damage(T.dmg[0] + Math.random() * (T.dmg[1] - T.dmg[0]), { legs: !!T.prone, by: zb.type }); }
          if (zb.atkT >= T.windup + 0.65) zb.state = 'chase';
          break;
      }
      if (zb.hobbled) speed *= 0.45;
      // ----- locomotion -----
      let moved = 0;
      if (want && speed > 0) {
        let gx = tx, gz = tz; const dt2 = Math.hypot(tx - zb.x, tz - zb.z);
        let direct = false;
        if (dt2 < 14) { const h = g.world.raycast(zb.x, T.prone ? 0.3 : 0.7, zb.z, (tx - zb.x) / (dt2 || 1), 0, (tz - zb.z) / (dt2 || 1), dt2, moveFilter); direct = !h; }
        if (!direct) {
          zb.pathT -= dt;
          if ((!zb.path || zb.pathT <= 0 || zb.pi >= zb.path.length) && this.budget > 0) { this.budget--; zb.path = g.nav.findPath(zb.x, zb.z, tx, tz, zb.state === 'chase' ? 6000 : 3500); zb.pi = 0; zb.pathT = zb.state === 'chase' ? 0.7 + Math.random() * 0.4 : 3; if (!zb.path && zb.state !== 'chase') { zb.state = 'idle'; } }
          if (zb.path && zb.pi < zb.path.length) { const wpt = zb.path[zb.pi]; gx = wpt.x; gz = wpt.z; if (Math.hypot(gx - zb.x, gz - zb.z) < 0.45) { zb.pi++; if (zb.pi < zb.path.length) { gx = zb.path[zb.pi].x; gz = zb.path[zb.pi].z; } } }
          else { gx = zb.x; gz = zb.z; }
        } else zb.path = null;
        const ddx = gx - zb.x, ddz = gz - zb.z, dl = Math.hypot(ddx, ddz);
        if (dl > 0.05) {
          zb.face = turn(zb.face, Math.atan2(ddx, ddz), dt * (zb.type === 'runner' ? 9 : 5.5));
          const stp = Math.min(dl, speed * dt), ox = zb.x, oz = zb.z; zb.x += ddx / dl * stp; zb.z += ddz / dl * stp;
          // closed doors: batter them open
          if (dl < 1.6 || !direct) { const h = g.world.raycast(ox, 1.0, oz, ddx / dl, 0, ddz / dl, 0.9, null); if (h && h.box && h.box.door && !h.box.door.open) { zb.x = ox; zb.z = oz; zb.doorT += dt; zb.bangT -= dt; if (zb.bangT <= 0) { zb.bangT = 0.65; g.audio.play3d('door_bang', h.box.door.x, 1.2, h.box.door.z, 1, 0.9 + Math.random() * 0.2, 5); } if (zb.doorT > 1.5) { zb.doorT = 0; g.setDoor(h.box.door, true, zb.x, zb.z); } } else zb.doorT = 0; }
          moved = stp;
        }
      }
      // separation + world collision
      for (let j = i + 1; j < list.length; j++) { const o = list[j], sx = o.x - zb.x, sz = o.z - zb.z, d2 = sx * sx + sz * sz, mn = zb.T.r + o.T.r; if (d2 < mn * mn && d2 > 1e-6) { const d = Math.sqrt(d2), k = (mn - d) / d * 0.5; zb.x -= sx * k; zb.z -= sz * k; o.x += sx * k; o.z += sz * k; } }
      { const sx = pcx - zb.x, sz = pcz - zb.z, d2 = sx * sx + sz * sz, mn = T.r + 0.32; if (d2 < mn * mn && d2 > 1e-6 && Math.abs(p.pos.y) < 1.2) { const d = Math.sqrt(d2), k = (mn - d) / d; zb.x -= sx * k; zb.z -= sz * k; } }
      if (dp < 90 || (this.tick + i) % 4 === 0) g.world.collide(zb, T.r, T.prone ? 0.15 : 0.5, T.prone ? 0.5 : 1.6);
      // stuck recovery
      if (want && speed > 0) { zb.stuckT += dt; if (zb.stuckT > 1.2) { if (Math.hypot(zb.x - zb.sx, zb.z - zb.sz) < 0.25 && zb.doorT === 0) { zb.path = null; zb.pathT = 0; if (++zb.stuckN >= 3) { const c = g.nav.nearestFree(zb.x, zb.z, true); if (c) { zb.x = c[0] + 0.5; zb.z = c[1] + 0.5; } zb.stuckN = 0; if (zb.state === 'wander') zb.state = 'idle'; } } else zb.stuckN = 0; zb.stuckT = 0; zb.sx = zb.x; zb.sz = zb.z; } } else { zb.stuckT = 0; zb.sx = zb.x; zb.sz = zb.z; }
      zb.speedNow += ((moved / Math.max(dt, 1e-4)) - zb.speedNow) * Math.min(1, dt * 8);
      // ----- sound -----
      zb.groanT -= dt;
      if (zb.groanT <= 0 && dp < 55) { const chasing = zb.state === 'chase'; zb.groanT = chasing ? 2 + Math.random() * 2.5 : 6 + Math.random() * 12; const n = zb.type === 'bloater' ? 'z_bloat' : zb.type === 'runner' && chasing ? 'z_runner' : zb.type === 'crawler' ? 'z_crawl' : chasing ? 'z_alert' : 'z_groan' + (1 + (Math.random() * 3 | 0)); g.audio.play3d(n, zb.x, T.prone ? 0.3 : 1.5, zb.z, chasing ? 0.8 : 0.5, 0.85 + Math.random() * 0.3, chasing ? 4 : 2.5); }
      if (zb.speedNow > 1.2 && dp < 22) { zb.stepT -= dt * zb.speedNow; if (zb.stepT <= 0) { zb.stepT = 1.5; g.audio.play3d(zb.T.prone ? 'cloth' : 'z_step', zb.x, 0.1, zb.z, zb.type === 'bloater' ? 0.9 : 0.5, zb.type === 'bloater' ? 0.6 : 1, 2); } }
      // ----- pose -----
      const B = zb.B; B.root.position.set(zb.x, 0, zb.z); B.root.rotation.y = zb.face;
      if (dp < 70) this.animate(zb, dt, day);
    }
  }
  alert(zb) {
    const g = this.g; zb.state = 'chase'; zb.path = null; zb.pathT = 0; zb.seenT = 0;
    g.audio.play3d(zb.type === 'runner' ? 'z_runner' : zb.type === 'bloater' ? 'z_bloat' : 'z_alert', zb.x, 1.5, zb.z, 1, 1, 5);
    for (const o of this.list) if (o !== zb && (o.state === 'idle' || o.state === 'wander' || o.state === 'search') && Math.hypot(o.x - zb.x, o.z - zb.z) < 9) { o.state = 'investigate'; o.tx = zb.lkx; o.tz = zb.lkz; o.fast = true; o.path = null; o.t = 0; }
  }
  animate(zb, dt, day) {
    const B = zb.B, T = zb.T, sp = zb.speedNow, chasing = zb.state === 'chase' || zb.state === 'attack';
    zb.phase += dt * (1.5 + sp * (T === ZTYPES.bloater ? 2.6 : 2.1)); const ph = zb.phase, amp = Math.min(1, sp / 1.2);
    if (T.prone) { B.armL.rotation.x = -2.6 + Math.sin(ph) * 0.5 * amp; B.armR.rotation.x = -2.6 - Math.sin(ph) * 0.5 * amp; B.legL.rotation.x = 0.15 + Math.sin(ph) * 0.08; B.legR.rotation.x = 0.15 - Math.sin(ph) * 0.08; B.head.rotation.x = -1.0 + Math.sin(ph * 0.5) * 0.1; B.body.rotation.z = Math.sin(ph) * 0.08 * amp; if (zb.state === 'attack') B.armR.rotation.x = -2.6 + Math.sin(Math.min(1, zb.atkT / T.windup) * 3.14) * 1.2; return; }
    const sw = Math.sin(ph) * 0.55 * amp, limp = zb.hobbled ? 0.5 : 1;
    B.legL.rotation.x = -sw * limp; B.legR.rotation.x = sw; B.shinL.rotation.x = Math.max(0, Math.sin(ph + 0.6)) * 0.7 * amp * limp; B.shinR.rotation.x = Math.max(0, Math.sin(ph + 3.74)) * 0.7 * amp;
    B.hips.position.y = 0.92 * T.hgt + Math.abs(Math.cos(ph)) * 0.03 * amp - (zb.hobbled ? 0.06 : 0);
    const idle = Math.sin(ph * 0.35) * 0.04;
    let lean = chasing ? 0.22 : 0.08 + idle, armBase = chasing ? -1.25 : -0.05;
    if (zb.stagger > 0) lean = -0.35;
    B.torso.rotation.x += (lean - B.torso.rotation.x) * Math.min(1, dt * 8); B.torso.rotation.z = Math.sin(ph) * 0.05 * amp + (zb.hobbled ? 0.12 : 0) + idle * 0.5;
    let aL = armBase + sw * (chasing ? 0.15 : 0.5), aR = armBase - sw * (chasing ? 0.15 : 0.5) + (chasing ? 0.2 : 0);
    if (zb.state === 'attack') { const k = Math.sin(Math.min(1, zb.atkT / (T.windup + 0.15)) * 3.14); aL = -1.9 + k * 1.3; aR = -1.7 + k * 1.5; }
    B.armL.rotation.x += (aL - B.armL.rotation.x) * Math.min(1, dt * 12); B.armR.rotation.x += (aR - B.armR.rotation.x) * Math.min(1, dt * 12); B.foreL.rotation.x = chasing ? -0.35 : -0.12; B.foreR.rotation.x = chasing ? -0.5 : -0.12;
    const up = zb.state === 'idle' && day > 0.7 && !this.g.indoorAt(zb.x, zb.z) ? -0.5 : chasing ? -0.1 : 0.15;   // at midday they stand with their faces to the sun
    B.head.rotation.x += (up - B.head.rotation.x) * Math.min(1, dt * 2); B.head.rotation.z = Math.sin(ph * 0.23) * 0.12; B.head.rotation.y = Math.sin(ph * 0.17 + zb.phase * 0.01) * (chasing ? 0.05 : 0.35);
  }
  dispose() { for (const z of [...this.list, ...this.corpses]) this.scene.remove(z.B.root); this.list = []; this.corpses = []; }
}
const moveFilter = (b) => !b.noMove && b.y1 > 0.5 && b.y0 < 1.5;
function turn(a, b, max) { let d = b - a; while (d > Math.PI) d -= 6.2832; while (d < -Math.PI) d += 6.2832; return a + Math.max(-max, Math.min(max, d)); }

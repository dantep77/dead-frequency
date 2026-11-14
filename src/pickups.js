// Physical world items: loot on surfaces, containers that must be opened, dropped gear, the ten cassettes.
import * as THREE from '../vendor/three.module.js';
import { Firearm } from './firearm.js';
import { buildWeaponModel } from './weaponmodels.js';
import { itemLabel } from './inventory.js';
import { CALIBERS } from './data/weapons.js';
import { PROPS } from './data/props.js';
import { NOTES } from './data/story.js';
import { RNG } from './rng.js';

const G = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10), sph: new THREE.SphereGeometry(0.5, 8, 6) };
const mats = {}; const M = (c, r = 0.8, m = 0) => mats[c + '|' + m] || (mats[c + '|' + m] = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m }));
const P = (g, geo, m, sx, sy, sz, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
const CALCOL = { '9mm': 0x8a3a2a, '.45': 0x3a4a6a, '.38': 0x6a6a3a, '12ga': 0x7a2222, '5.56': 0x3a5a3a, '.308': 0x5a4a32 };
const NAMES = { fridge: 'refrigerator', dresser: 'dresser', wardrobe: 'wardrobe', sink: 'cabinet', toolchest: 'tool chest', cooler: 'cooler', filecab: 'filing cabinet', lockers: 'lockers', crate: 'crate', dumpster: 'dumpster', gunlocker: 'gun locker', medcab: 'medical cabinet', car: 'trunk', policecar: 'trunk', van: 'van', miltruck: 'truck bed' };

function itemMesh(it) {
  const g = new THREE.Group();
  switch (it.kind) {
    case 'weapon': { const m = buildWeaponModel(it, false); m.group.rotation.z = Math.PI / 2; m.group.position.y = 0.025; g.add(m.group); g.userData.model = m; break; }
    case 'mag': P(g, G.box, M(0x26282a, 0.5, 0.6), it.type === 'ar15' ? 0.13 : 0.11, 0.022, it.type === 'ar15' ? 0.058 : 0.032, 0, 0.011, 0); if (it.rounds > 0) P(g, G.cyl, M(0xb08a3c, 0.4, 0.8), 0.01, 0.024, 0.01, 0.058, 0.011, 0).rotation.x = Math.PI / 2; break;
    case 'ammo': if (it.n <= 2) { for (let i = 0; i < it.n; i++) { const c = P(g, G.cyl, M(it.cal === '12ga' ? 0x8a2a22 : 0xb08a3c, 0.4, 0.7), it.cal === '12ga' ? 0.018 : 0.01, it.cal === '12ga' ? 0.06 : 0.03, it.cal === '12ga' ? 0.018 : 0.01, i * 0.025, 0.009, 0); c.rotation.x = Math.PI / 2; } } else { P(g, G.box, M(CALCOL[it.cal]), 0.1, 0.045, 0.065, 0, 0.022, 0); P(g, G.box, M(0xc9c2a8), 0.06, 0.002, 0.03, 0, 0.046, 0); } break;
    case 'att': if (it.id === 'reddot') { P(g, G.box, M(0x18191b, 0.6, 0.4), 0.05, 0.012, 0.03, 0, 0.006, 0); P(g, G.box, M(0x18191b, 0.6, 0.4), 0.012, 0.03, 0.03, 0.019, 0.02, 0); } else if (it.id.startsWith('scope')) { const c = P(g, G.cyl, M(0x18191b, 0.5, 0.5), 0.034, it.id === 'scope10' ? 0.34 : 0.26, 0.034, 0, 0.02, 0); c.rotation.z = Math.PI / 2; } else if (it.id === 'light') { const c = P(g, G.cyl, M(0x1c1d1f, 0.5, 0.5), 0.028, 0.09, 0.028, 0, 0.014, 0); c.rotation.z = Math.PI / 2; } else if (it.id === 'laser') P(g, G.box, M(0x1c1d1f, 0.5, 0.5), 0.045, 0.022, 0.025, 0, 0.011, 0); else { const c = P(g, G.cyl, M(0x202123, 0.45, 0.6), 0.036, it.id === 'supp_rifle' ? 0.19 : 0.15, 0.036, 0, 0.018, 0); c.rotation.z = Math.PI / 2; } break;
    case 'med': if (it.id === 'medkit') { P(g, G.box, M(0x8a2a22), 0.2, 0.08, 0.14, 0, 0.04, 0); P(g, G.box, M(0xd8d4c8), 0.08, 0.002, 0.025, 0, 0.081, 0); P(g, G.box, M(0xd8d4c8), 0.025, 0.002, 0.08, 0, 0.081, 0); } else P(g, G.cyl, M(0xd0ccc0), 0.06, 0.05, 0.06, 0, 0.025, 0); break;
    case 'plate': P(g, G.box, M(0x3c4236, 0.9), 0.25, 0.028, 0.3, 0, 0.014, 0); break;
    case 'note': { const p = P(g, G.box, M(0xcfc9b4, 1), 0.2, 0.002, 0.27, 0, 0.002, 0); p.castShadow = false; P(g, G.box, M(0x55524a, 1), 0.14, 0.0025, 0.01, 0, 0.002, -0.08); P(g, G.box, M(0x77736a, 1), 0.15, 0.0025, 0.006, 0, 0.002, -0.04); P(g, G.box, M(0x77736a, 1), 0.13, 0.0025, 0.006, 0, 0.002, 0); break; }
  }
  g.rotation.y = Math.random() * 6.28; return g;
}

export class Pickups {
  constructor(game, scene, L) {
    this.g = game; this.scene = scene; this.entries = []; this.extra = [];
    this.containers = L.containers.map(c => { const p = L.props[c.prop], fp = PROPS[p.kind].fp, w = p.rot & 1 ? fp[1] : fp[0], d = p.rot & 1 ? fp[0] : fp[1]; const top = Math.max(...PROPS[p.kind].boxes.map(q => q[4])); return { ...c, opened: false, x: p.x + w / 2, z: p.z + d / 2, y: Math.min(1.2, c.slots[0].y + 0.3), x0: p.x + 0.1, z0: p.z + 0.1, x1: p.x + w - 0.1, z1: p.z + d - 0.1, top: Math.min(top, 1.9), name: NAMES[c.kind] || c.kind, items: [] }; });
    for (const it of L.items) {
      let item = it.item;
      if (item.kind === 'weapon') { const r = new RNG(item.seed); item = new Firearm(item.id).randomize(r); if (item.id === 'm40' && r.chance(0.75)) item.att.optic = { kind: 'att', id: 'scope10', cond: +r.range(0.3, 1).toFixed(2) }; }
      else item = { ...item };
      const e = this.add(item, it.x, it.y, it.z);
      if (it.container >= 0) { e.hidden = true; e.mesh.visible = false; this.containers[it.container].items.push(e); }
    }
    // cassettes: a tape in its case with a blinking locator tag
    this.tapes = L.tapes.map(t => {
      const g = new THREE.Group(); P(g, G.box, M(0x1d1e20, 0.6), 0.11, 0.018, 0.07, 0, 0.009, 0); P(g, G.box, M(0xc9c2a8, 1), 0.08, 0.002, 0.03, 0, 0.019, -0.01); P(g, G.box, M(0xb5651f, 0.7), 0.035, 0.022, 0.03, 0.08, 0.011, 0.01);
      const led = new THREE.Mesh(G.sph, new THREE.MeshBasicMaterial({ color: 0xff3a1a })); led.scale.setScalar(0.012); led.position.set(0.08, 0.026, 0.01); g.add(led);
      g.position.set(t.x, t.y, t.z); g.rotation.y = t.id * 1.3; scene.add(g); return { ...t, mesh: g, led, taken: false };
    });
  }
  add(item, x, y, z) { const mesh = itemMesh(item); mesh.position.set(x, y, z); this.scene.add(mesh); const e = { item, x, y, z, mesh, hidden: false, vy: 0, fall: false }; this.entries.push(e); return e; }
  spawn(item, pos) { const e = this.add(item, pos.x, pos.y, pos.z); e.fall = true; return e; }   // dropped: falls to whatever is below
  remove(e) { this.scene.remove(e.mesh); const i = this.entries.indexOf(e); if (i >= 0) this.entries.splice(i, 1); }
  open(c) { c.opened = true; for (const e of c.items) { e.hidden = false; e.mesh.visible = true; } this.g.audio.play3d('container', c.x, 1, c.z, 1, 1, 2); this.g.noise(c.x, c.z, 5, 'mech'); if (!c.items.length) this.g.ui.msg('Empty.'); }
  update(dt, t) {
    for (const e of this.entries) if (e.fall) { e.vy -= 9.8 * dt; e.y += e.vy * dt; const gr = this.g.world.groundAt(e.x, e.z, 0.1, e.y + 0.1); if (e.y <= gr) { e.y = gr; e.fall = false; e.vy = 0; } e.mesh.position.y = e.y; }
    const on = (t % 1.1) < 0.12; for (const tp of this.tapes) if (!tp.taken) tp.led.visible = on;
    for (const e of this.entries) if (e.item.kind === 'weapon' && e.mesh.userData.model && !e.hidden) { const m = e.mesh.userData.model; if (m.lastAtt !== ['optic', 'rail', 'muzzle'].map(s => e.item.att[s] ? e.item.att[s].id : '-').join()) m.sync(1); }
  }
  // What is the player looking at? Returns {type, ref, label}
  findTarget(eye, f) {
    const W = this.g.world; let best = null, bestS = 0;
    const test = (x, y, z, maxD, minCos, type, ref, label) => {
      const dx = x - eye.x, dy = y - eye.y, dz = z - eye.z, d = Math.hypot(dx, dy, dz); if (d > maxD || d < 0.05) return;
      const c = (dx * f.x + dy * f.y + dz * f.z) / d; if (c < minCos) return; const s = c - d * 0.01; if (s <= bestS) return;
      if (d > 0.5 && !W.los(eye.x, eye.y, eye.z, x - dx / d * 0.12, y + 0.06, z - dz / d * 0.12)) return;
      bestS = s; best = { type, ref, label: typeof label === 'function' ? label() : label };
    };
    for (const e of this.entries) if (!e.hidden && Math.abs(e.x - eye.x) < 3 && Math.abs(e.z - eye.z) < 3) test(e.x, e.y + 0.04, e.z, 2.4, 0.95, 'item', e, () => (e.item.kind === 'note' ? 'Read: ' + NOTES[e.item.id].title : 'Take ' + itemLabel(e.item)));
    for (const t of this.tapes) if (!t.taken) test(t.x, t.y + 0.03, t.z, 2.6, 0.93, 'tape', t, 'Take cassette');
    // containers: aim anywhere at the object itself (nearest point of its body), not at a point buried inside it
    for (const c of this.containers) if (!c.opened && Math.abs(c.x - eye.x) < 6 && Math.abs(c.z - eye.z) < 6) {
      const x = Math.max(c.x0, Math.min(eye.x, c.x1)), z = Math.max(c.z0, Math.min(eye.z, c.z1)), y = Math.max(0.3, Math.min(eye.y - 0.35, c.top)), dx = x - eye.x, dy = y - eye.y, dz = z - eye.z, d = Math.hypot(dx, dy, dz); if (d > 2.2 || d < 0.05) continue;
      const cs = (dx * f.x + dy * f.y + dz * f.z) / d; if (cs < 0.8) continue; const s = cs - d * 0.01 - 0.06; if (s <= bestS) continue;
      const h = W.raycast(eye.x, eye.y, eye.z, dx / d, dy / d, dz / d, d - 0.05, null); if (h && h.box && !this.g.wb.propCols[c.prop].includes(h.box)) continue;
      bestS = s; best = { type: 'container', ref: c, label: 'Search ' + c.name };
    }
    for (const x of this.extra) if (x.active()) test(x.x, x.y, x.z, x.dist || 3, 0.8, 'extra', x, x.label);
    if (!best || best.type === 'container') {
      const h = W.raycast(eye.x, eye.y, eye.z, f.x, f.y, f.z, 2.5, null);
      if (h && h.box && h.box.door) return { type: 'door', ref: h.box.door, label: 'Open door' };
      if (!best) for (const d of this.g.wb.doors) if (d.open && Math.abs(d.x - eye.x) < 2 && Math.abs(d.z - eye.z) < 2) { const lx = d.pivot.position.x + (d.v ? Math.sin(d.ang) : Math.cos(d.ang)) * 0.5, lz = d.pivot.position.z + (d.v ? Math.cos(d.ang) : -Math.sin(d.ang)) * 0.5; test(lx, 1.1, lz, 2.0, 0.9, 'door', d, 'Close door'); }
    }
    return best;
  }
  dispose() { for (const e of this.entries) this.scene.remove(e.mesh); for (const t of this.tapes) this.scene.remove(t.mesh); }
}

// Procedural firearm models with articulated parts (slide, hammer, trigger, magazine, cylinder, bolt, pump...).
// Convention: muzzle points to -Z, +Y up, +X right. Origin is at the trigger.
import * as THREE from '../vendor/three.module.js';
import { WEAPONS, MAGS, ATTACHMENTS } from './data/weapons.js';

const mat = (c, rough = 0.45, metal = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });
function box(g, m, w, h, d, x, y, z, rx = 0) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.x = rx; g.add(o); return o; }
function cyl(g, m, r, len, x, y, z, axis = 'z', seg = 12, r2) { const o = new THREE.Mesh(new THREE.CylinderGeometry(r2 ?? r, r, len, seg), m); if (axis === 'z') o.rotation.x = Math.PI / 2; else if (axis === 'x') o.rotation.z = Math.PI / 2; o.position.set(x, y, z); g.add(o); return o; }
const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

// Gun finishes are lifted well above true black so the mechanism stays readable in the hand;
// without an environment map, high metalness renders as a featureless silhouette.
const lift = (c, k = 1.9, add = 22) => { const r = Math.min(255, ((c >> 16) & 255) * k + add), g = Math.min(255, ((c >> 8) & 255) * k + add), b = Math.min(255, (c & 255) * k + add); return (r << 16) | (g << 8) | b; };
function baseMats(o = {}) {
  return {
    steel: mat(lift(o.steel ?? 0x2a2c30), 0.42, 0.3), frame: mat(lift(o.frame ?? o.steel ?? 0x2a2c30, o.poly ? 1.8 : 1.75), o.poly ? 0.8 : 0.5, o.poly ? 0.05 : 0.28), grip: mat(lift(o.grip ?? 0x3a2a1e, 1.5, 10), 0.85, 0.02),
    dark: mat(0x17181a, 0.55, 0.2), brass: mat(0xb08a3c, 0.35, 0.9), spent: mat(0x6a5a34, 0.6, 0.7), lead: mat(0x8a5a3a, 0.5, 0.7), sight: new THREE.MeshBasicMaterial({ color: 0xd8d8c8 }),
    glove: mat(0x4a4d48, 0.9, 0), sleeve: mat(0x56604e, 1, 0), shell: mat(0x8a2a22, 0.7, 0.1),
  };
}

function chamberBits(M, g, x, y, z, r, len) { // visible round in the ejection port + stovepipe case
  const round = grp(g, x, y, z); cyl(round, M.brass, r, len, 0, 0, 0, 'z', 8); const tip = cyl(round, M.lead, r * 0.9, len * 0.5, 0, 0, -len * 0.7, 'z', 8, r * 0.3); round.userData.tip = tip; round.visible = false;
  const stove = cyl(g, M.spent, r, len, x + r * 1.5, y + len * 0.45, z, 'y', 8); stove.rotation.z = -0.5; stove.visible = false;
  return { round, stove };
}

function pistol(id, p) {
  const M = baseMats(p), g = new THREE.Group(), P = {};
  const L = p.len, front = -(L - 0.065), zc = (0.065 + front) / 2, sy = 0.048;
  box(g, M.frame, 0.026, 0.02, L * 0.92, 0, 0.025, zc + 0.004);                       // frame / dust cover
  if (p.rail) box(g, M.frame, 0.022, 0.008, 0.045, 0, 0.012, front + 0.035);
  const gripG = grp(g, 0, 0.02, 0.04); gripG.rotation.x = p.rake ?? 0.2;
  box(gripG, M.frame, 0.027, 0.105, 0.044, 0, -0.05, 0); box(gripG, M.grip, 0.031, 0.08, 0.034, 0, -0.05, 0);
  box(g, M.frame, 0.008, 0.004, 0.05, 0, -0.022, -0.02); box(g, M.frame, 0.008, 0.03, 0.004, 0, -0.008, -0.044);   // trigger guard
  P.trigger = grp(g, 0, 0.012, -0.012); box(P.trigger, M.steel, 0.006, 0.022, 0.006, 0, -0.012, 0, -0.2);
  cyl(g, M.steel, 0.0068, L - 0.02, 0, sy, zc - 0.008, 'z', 10);                         // barrel (revealed as the slide retracts)
  P.slide = grp(g, 0, 0, 0);
  if (p.openTop) { box(P.slide, M.steel, 0.027, 0.012, L, 0, sy - 0.008, zc); box(P.slide, M.steel, 0.027, 0.026, L * 0.42, 0, sy, 0.065 - L * 0.21); box(P.slide, M.steel, 0.027, 0.026, 0.02, 0, sy, front + 0.01); }
  else box(P.slide, M.steel, 0.027, 0.027, L, 0, sy, zc);
  for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) box(P.slide, M.dark, 0.001, 0.02, 0.003, sx * 0.0139, sy, 0.05 - i * 0.007);
  box(P.slide, M.dark, 0.013, 0.002, 0.032, 0.005, sy + 0.0131, zc + 0.03); box(P.slide, M.dark, 0.002, 0.012, 0.032, 0.0136, sy + 0.006, zc + 0.03);                // ejection port
  const sh = sy + 0.0135;
  box(P.slide, M.dark, 0.006, 0.006, 0.006, -0.0075, sh + 0.003, 0.058); box(P.slide, M.dark, 0.006, 0.006, 0.006, 0.0075, sh + 0.003, 0.058); box(P.slide, M.dark, 0.021, 0.002, 0.006, 0, sh, 0.058);
  box(P.slide, M.dark, 0.0035, 0.0058, 0.005, 0, sh + 0.003, front + 0.008); box(P.slide, M.sight, 0.0025, 0.0025, 0.001, 0, sh + 0.004, front + 0.0106);
  box(P.slide, M.sight, 0.002, 0.002, 0.001, -0.0075, sh + 0.004, 0.0611); box(P.slide, M.sight, 0.002, 0.002, 0.001, 0.0075, sh + 0.004, 0.0611);
  Object.assign(P, chamberBits(M, g, 0.005, sy + 0.006, zc + 0.03, 0.005, 0.02));
  if (p.hammer) { P.hammer = grp(g, 0, 0.036, 0.066); box(P.hammer, M.steel, 0.007, 0.02, 0.008, 0, 0.012, 0.002); box(P.hammer, M.dark, 0.008, 0.006, 0.01, 0, 0.022, 0.005); }
  else box(P.slide, M.dark, 0.016, 0.02, 0.002, 0, sy, 0.0655);                            // striker cover plate
  if (p.safety === 'frame') { P.safety = grp(g, -0.0145, 0.036, 0.05); box(P.safety, M.steel, 0.004, 0.006, 0.022, 0, 0, -0.008); }
  if (p.safety === 'slide') { P.safety = grp(P.slide, -0.0145, sy + 0.002, 0.05); box(P.safety, M.steel, 0.004, 0.006, 0.02, 0, 0, -0.008); }
  P.stop = box(g, M.steel, 0.003, 0.005, 0.024, -0.0145, 0.034, 0.0);
  P.mag = grp(gripG, 0, 0, 0); box(P.mag, M.steel, 0.021, 0.115, 0.03, 0, -0.047, 0.001); box(P.mag, M.dark, 0.029, 0.008, 0.046, 0, -0.108, 0);
  // hands
  const hand = grp(g); box(hand, M.glove, 0.05, 0.085, 0.06, 0.004, -0.045, 0.05, 0.2); const arm = box(hand, M.sleeve, 0.07, 0.07, 0.4, 0.03, -0.11, 0.28); arm.rotation.set(-0.25, -0.1, 0); P.hand = hand;
  return { group: g, P, M, travel: 0.045, muzzle: new THREE.Vector3(0, sy, front), sightY: sh + 0.0045, rearZ: 0.058, mount: { optic: [sh, 0.02, P.slide], rail: [0.004, front + 0.035], muzzleR: 0.0068 }, magDrop: 0.14, kind: 'pistol' };
}

function revolver(id, p) {
  const M = baseMats(p), g = new THREE.Group(), P = {};
  const by = 0.05, cz = -0.02, cl = 0.042, cr = 0.02, bl = p.barrel;
  box(g, M.steel, 0.02, 0.012, 0.075, 0, by + 0.024, cz);                               // top strap
  box(g, M.steel, 0.02, 0.05, 0.022, 0, by - 0.002, cz + cl / 2 + 0.012);               // recoil shield
  box(g, M.steel, 0.018, 0.016, 0.07, 0, by - 0.03, cz);                                // lower frame
  box(g, M.steel, 0.02, 0.05, 0.014, 0, by - 0.004, cz - cl / 2 - 0.008);               // front of frame
  cyl(g, M.steel, 0.0085, bl, 0, by, cz - cl / 2 - 0.012 - bl / 2, 'z', 10);
  const mz = cz - cl / 2 - 0.012 - bl;
  box(g, M.dark, 0.003, 0.008, 0.008, 0, by + 0.012, mz + 0.008); box(g, M.sight, 0.002, 0.003, 0.001, 0, by + 0.0145, mz + 0.0125);
  box(g, M.dark, 0.012, 0.003, 0.004, 0, by + 0.0305, cz + 0.035); box(g, M.dark, 0.004, 0.004, 0.004, -0.004, by + 0.032, cz + 0.035); box(g, M.dark, 0.004, 0.004, 0.004, 0.004, by + 0.032, cz + 0.035);
  const gripG = grp(g, 0, 0.012, 0.04); gripG.rotation.x = p.sa ? 0.5 : 0.32; box(gripG, M.grip, 0.03, p.sa ? 0.1 : 0.09, 0.038, 0, -0.05, 0.005);
  box(g, M.steel, 0.008, 0.004, 0.045, 0, -0.022, -0.012); box(g, M.steel, 0.008, 0.028, 0.004, 0, -0.008, -0.034);
  P.trigger = grp(g, 0, 0.012, -0.008); box(P.trigger, M.steel, 0.006, 0.022, 0.006, 0, -0.012, 0, -0.25);
  P.hammer = grp(g, 0, by - 0.006, cz + cl / 2 + 0.026); box(P.hammer, M.steel, 0.007, 0.026, 0.008, 0, 0.014, 0); box(P.hammer, M.dark, 0.009, 0.005, 0.014, 0, 0.027, 0.006);
  P.crane = grp(g, 0, by - 0.03, cz);                                                   // swing-out pivot (DA)
  P.cyl = grp(P.crane, 0, 0.03, 0); cyl(P.cyl, M.steel, cr, cl, 0, 0, 0, 'z', 12);
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.2832; cyl(P.cyl, M.dark, 0.004, cl + 0.001, Math.sin(a) * cr, Math.cos(a) * cr, 0, 'z', 6); }
  P.rounds = [];
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.2832 + Math.PI / 6 * 0; const rg = grp(P.cyl, Math.sin(a) * 0.0118, Math.cos(a) * 0.0118, cl / 2); const rim = cyl(rg, M.brass, 0.0055, 0.003, 0, 0, 0, 'z', 8); const primer = cyl(rg, M.steel, 0.002, 0.0034, 0, 0, 0, 'z', 6); const hole = cyl(rg, M.dark, 0.0052, 0.002, 0, 0, -0.001, 'z', 8); P.rounds.push({ rim, primer, hole }); }
  if (!p.sa) P.rod = cyl(g, M.steel, 0.003, 0.06, 0, by - 0.017, cz - cl / 2 - 0.04, 'z', 6);
  else { P.rod = cyl(g, M.steel, 0.004, bl * 0.8, 0.008, by - 0.012, cz - cl / 2 - 0.012 - bl * 0.4, 'z', 6); P.gate = grp(g, 0.011, by - 0.004, cz + cl / 2 + 0.012); box(P.gate, M.steel, 0.004, 0.024, 0.02, 0, 0.004, 0); }
  const hand = grp(g); box(hand, M.glove, 0.05, 0.085, 0.06, 0.004, -0.05, 0.055, 0.3); const arm = box(hand, M.sleeve, 0.07, 0.07, 0.4, 0.03, -0.12, 0.29); arm.rotation.set(-0.25, -0.1, 0); P.hand = hand;
  return { group: g, P, M, travel: 0, muzzle: new THREE.Vector3(0, by, mz), sightY: by + 0.034, rearZ: cz + 0.035, mount: { muzzleR: 0.0085 }, kind: 'revolver', cylR: 0.0118 };
}

function longgun(id, p) {
  const M = baseMats(p), g = new THREE.Group(), P = {};
  const by = 0.055, rl = p.recv, bl = p.barrel, rz = -rl / 2 + 0.06, bz = rz - rl / 2 - bl / 2, mz = rz - rl / 2 - bl;
  M.stock = mat(lift(p.stock ?? 0x4a3524, 1.5, 12), 0.8, 0.02);
  box(g, M.steel, p.recvW ?? 0.04, p.recvH ?? 0.055, rl, 0, by - 0.01, rz);                // receiver
  cyl(g, M.steel, p.barrelR ?? 0.0095, bl, 0, by, bz, 'z', 10);
  // stock
  if (p.pistolGrip) { const gg = grp(g, 0, 0.0, 0.04); gg.rotation.x = 0.3; box(gg, M.grip, 0.03, 0.1, 0.04, 0, -0.045, 0); box(g, M.stock, 0.035, 0.05, 0.24, 0, by - 0.012, rz + rl / 2 + 0.12); box(g, M.stock, 0.036, 0.11, 0.03, 0, by - 0.035, rz + rl / 2 + 0.245); }
  else { const st = box(g, M.stock, 0.04, 0.06, 0.34, 0, by - 0.05, rz + rl / 2 + 0.15); st.rotation.x = -0.14; box(g, M.stock, 0.038, 0.05, 0.1, 0, -0.012, 0.045, 0.5); box(g, M.dark, 0.04, 0.115, 0.016, 0, by - 0.078, rz + rl / 2 + 0.325, -0.14); }
  box(g, M.steel, 0.008, 0.004, 0.06, 0, -0.022, -0.012); box(g, M.steel, 0.008, 0.028, 0.004, 0, -0.008, -0.042);
  P.trigger = grp(g, 0, 0.012, -0.008); box(P.trigger, M.steel, 0.006, 0.022, 0.006, 0, -0.012, 0, -0.25);
  let sightY = by + 0.025, rearZ = rz + rl / 2 - 0.02, travel = 0.08;
  const port = [0.012, by + 0.012, rz - rl * 0.12];
  if (p.type === 'pump' || p.type === 'semi_shotgun') {
    cyl(g, M.steel, 0.011, bl * 0.72, 0, by - 0.028, rz - rl / 2 - bl * 0.36, 'z', 10);    // magazine tube
    if (p.type === 'pump') { P.slide = grp(g); const f = cyl(P.slide, M.stock, 0.022, 0.17, 0, by - 0.028, rz - rl / 2 - 0.19, 'z', 10); for (let i = 0; i < 6; i++) box(P.slide, M.dark, 0.046, 0.003, 0.004, 0, by - 0.028, rz - rl / 2 - 0.12 - i * 0.026); travel = 0.09; P.pumpHand = true; }
    else { box(g, M.stock, 0.046, 0.045, 0.26, 0, by - 0.026, rz - rl / 2 - 0.15); P.slide = grp(g); cyl(P.slide, M.steel, 0.004, 0.022, 0.03, by + 0.004, port[2], 'x', 6); box(P.slide, M.dark, 0.004, 0.018, 0.06, 0.0205, by + 0.006, port[2] + 0.005); travel = 0.07; }
    if (p.ghost) { box(g, M.dark, 0.004, 0.022, 0.004, 0, by + 0.02, mz + 0.03); box(g, M.sight, 0.0025, 0.004, 0.001, 0, by + 0.029, mz + 0.0325); for (const sx of [-1, 1]) box(g, M.dark, 0.003, 0.014, 0.006, sx * 0.007, by + 0.03, rearZ); box(g, M.dark, 0.017, 0.003, 0.006, 0, by + 0.0215, rearZ); sightY = by + 0.031; }
    else { cyl(g, M.sight, 0.0025, 0.004, 0, by + 0.0115, mz + 0.012, 'y', 6); box(g, M.steel, 0.008, 0.003, bl * 0.9, 0, by + 0.0095, bz); sightY = by + 0.0185; rearZ = rz; }
  } else if (p.type === 'ar') {
    box(g, M.frame, 0.044, 0.046, 0.24, 0, by, rz - rl / 2 - 0.13);                         // handguard
    box(g, M.steel, 0.02, 0.006, rl + 0.2, 0, by + 0.022, rz - 0.1);                        // top rail
    box(g, M.dark, 0.012, 0.045, 0.012, 0, by + 0.03, mz + 0.14); box(g, M.dark, 0.003, 0.012, 0.003, 0, by + 0.058, mz + 0.14); box(g, M.sight, 0.002, 0.003, 0.001, 0, by + 0.0625, mz + 0.142);   // front sight tower
    for (const sx of [-1, 1]) box(g, M.dark, 0.003, 0.03, 0.008, sx * 0.007, by + 0.04, rearZ); box(g, M.dark, 0.017, 0.012, 0.008, 0, by + 0.03, rearZ); sightY = by + 0.0625;
    P.slide = grp(g); box(P.slide, M.dark, 0.03, 0.006, 0.03, 0, by + 0.02, rz + rl / 2 + 0.005); box(P.slide, M.dark, 0.008, 0.006, 0.06, 0, by + 0.02, rz + rl / 2 - 0.03); travel = 0.07;
    cyl(g, M.dark, 0.014, 0.07, 0, by, mz + 0.035, 'z', 8); box(g, M.dark, 0.014, 0.012, 0.05, 0.021, by - 0.002, port[2]);
    P.safety = grp(g, -0.0225, by - 0.03, 0.02); box(P.safety, M.steel, 0.004, 0.005, 0.02, 0, 0, -0.008);
    P.mag = grp(g, 0, by - 0.036, rz - 0.065); const m1 = box(P.mag, M.steel, 0.022, 0.13, 0.058, 0, -0.06, 0, -0.14);
  } else { // bolt action
    box(g, M.stock, 0.042, 0.045, bl * 0.55, 0, by - 0.028, rz - rl / 2 - bl * 0.275);     // fore-stock
    P.slide = grp(g, 0, by, rz + 0.02); P.boltRot = grp(P.slide); cyl(P.slide, M.steel, 0.009, rl * 0.7, 0, 0, -rl * 0.3, 'z', 8);
    const hd = cyl(P.boltRot, M.steel, 0.004, 0.05, 0.03, -0.012, 0.02, 'x', 6); hd.rotation.z = Math.PI / 2 + 0.5; const kn = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 6), M.dark); kn.position.set(0.052, -0.026, 0.02); P.boltRot.add(kn); travel = 0.085;
    if (!p.noIrons) { box(g, M.dark, 0.003, 0.012, 0.01, 0, by + 0.016, mz + 0.02); box(g, M.sight, 0.002, 0.003, 0.001, 0, by + 0.0205, mz + 0.0255); for (const sx of [-1, 1]) box(g, M.dark, 0.004, 0.008, 0.004, sx * 0.005, by + 0.018, rz - rl / 2 - 0.06); box(g, M.dark, 0.014, 0.004, 0.004, 0, by + 0.012, rz - rl / 2 - 0.06); sightY = by + 0.0215; rearZ = rz - rl / 2 - 0.06; }
    else { box(g, M.dark, 0.02, 0.006, rl + 0.08, 0, by + 0.02, rz - 0.03); sightY = by + 0.03; }
    P.safety = grp(g, 0.012, by + 0.012, rz + rl / 2 - 0.01); box(P.safety, M.steel, 0.004, 0.006, 0.016, 0, 0, 0);
    if (p.boxMag) { P.mag = grp(g, 0, by - 0.04, rz - 0.04); box(P.mag, M.dark, 0.026, 0.06, 0.075, 0, -0.025, 0); }
  }
  Object.assign(P, chamberBits(p.shell ? Object.assign({}, M, { brass: M.shell, lead: M.shell }) : M, g, port[0], port[1], port[2], p.shell ? 0.009 : 0.006, p.shell ? 0.05 : 0.045));
  const hand = grp(g); box(hand, M.glove, 0.05, 0.08, 0.06, 0.004, -0.05, 0.05, 0.3); const arm = box(hand, M.sleeve, 0.07, 0.07, 0.36, 0.05, -0.13, 0.25); arm.rotation.set(-0.3, -0.25, 0);
  const lh = grp(P.pumpHand ? P.slide : g); box(lh, M.glove, 0.06, 0.05, 0.08, -0.005, by - 0.06, rz - rl / 2 - 0.2); const la = box(lh, M.sleeve, 0.07, 0.07, 0.4, -0.12, by - 0.16, rz - rl / 2 - 0.04); la.rotation.set(-0.5, 0.75, 0); P.hand = hand; P.lhand = lh;
  return { group: g, P, M, travel, muzzle: new THREE.Vector3(0, by, mz), sightY, rearZ, mount: { optic: [by + (p.type === 'ar' || p.noIrons ? 0.025 : 0.018), rz - (p.type === 'ar' ? 0.02 : 0.03), g], rail: [by - (p.type === 'ar' ? 0.03 : 0.045), mz + 0.2], muzzleR: p.barrelR ?? 0.0095 }, magDrop: 0.18, kind: 'long', bolt: p.type === 'bolt', eyeZ: rz + rl / 2 };
}

const SPEC = {
  m1911: () => pistol('m1911', { len: 0.215, steel: 0x33363a, frame: 0x33363a, grip: 0x4a2f1c, hammer: true, safety: 'frame', rake: 0.3 }),
  g17: () => pistol('g17', { len: 0.2, steel: 0x1c1d1f, frame: 0x222325, grip: 0x1f2021, poly: true, rail: true, rake: 0.36 }),
  m9: () => pistol('m9', { len: 0.215, steel: 0x232528, frame: 0x26282b, grip: 0x1a1b1c, hammer: true, safety: 'slide', openTop: true, rail: true, rake: 0.26 }),
  model10: () => revolver('model10', { barrel: 0.1, steel: 0x2b2d33, grip: 0x4a3020 }),
  saa: () => revolver('saa', { barrel: 0.14, steel: 0x3a3c40, grip: 0x5a3a22, sa: true }),
  r870: () => longgun('r870', { type: 'pump', recv: 0.22, barrel: 0.47, steel: 0x2a2c2e, stock: 0x4a3322, barrelR: 0.011, shell: true }),
  m1014: () => longgun('m1014', { type: 'semi_shotgun', recv: 0.24, barrel: 0.47, steel: 0x1f2022, stock: 0x1e1f20, grip: 0x1e1f20, pistolGrip: true, barrelR: 0.011, ghost: true, shell: true }),
  ar15: () => longgun('ar15', { type: 'ar', recv: 0.2, barrel: 0.4, steel: 0x1d1e20, frame: 0x242527, stock: 0x1e1f20, grip: 0x1e1f20, pistolGrip: true, recvH: 0.06, barrelR: 0.008, poly: true }),
  model70: () => longgun('model70', { type: 'bolt', recv: 0.2, barrel: 0.56, steel: 0x2c2e31, stock: 0x5a3c24, barrelR: 0.0085 }),
  m40: () => longgun('m40', { type: 'bolt', recv: 0.21, barrel: 0.6, steel: 0x232426, stock: 0x4d5440, barrelR: 0.012, noIrons: true, boxMag: true }),
};

function buildAttachments(model, f) {
  if (model.attG) { model.group.remove(model.attG); if (model.attS) model.attS.parent.remove(model.attS); }
  const G = model.attG = new THREE.Group(), M = model.M; model.group.add(G); model.dot = null; model.attS = null; model.scopeY = null; model.lightPos = null;
  const o = f.att.optic, r = f.att.rail, mu = f.att.muzzle;
  if (o && model.mount.optic) {
    const [y, z, parent] = model.mount.optic; const S = model.attS = new THREE.Group(); parent.add(S);
    if (o.id === 'reddot') {
      box(S, M.dark, 0.026, 0.006, 0.045, 0, y + 0.003, z); for (const sx of [-1, 1]) box(S, M.dark, 0.003, 0.026, 0.008, sx * 0.012, y + 0.018, z - 0.016); box(S, M.dark, 0.027, 0.003, 0.008, 0, y + 0.031, z - 0.016);
      const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.022, 0.024), new THREE.MeshBasicMaterial({ color: 0x6a8f9a, transparent: true, opacity: 0.12 + (1 - o.cond) * 0.3, side: THREE.DoubleSide })); lens.position.set(0, y + 0.018, z - 0.016); S.add(lens);
      model.dot = new THREE.Mesh(new THREE.SphereGeometry(0.0011, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff2a1a })); model.dot.position.set(0, y + 0.018, z - 0.0165); S.add(model.dot); model.scopeY = y + 0.018;
    } else {
      const big = o.id === 'scope10', len = big ? 0.34 : 0.26; cyl(S, M.dark, 0.014, len, 0, y + 0.03, z - 0.02, 'z', 12); cyl(S, M.dark, big ? 0.026 : 0.021, 0.07, 0, y + 0.03, z - 0.02 - len / 2, 'z', 12); cyl(S, M.dark, 0.019, 0.05, 0, y + 0.03, z - 0.02 + len / 2, 'z', 12);
      box(S, M.dark, 0.014, 0.022, 0.016, 0, y + 0.012, z - 0.07); box(S, M.dark, 0.014, 0.022, 0.016, 0, y + 0.012, z + 0.03); cyl(S, M.dark, 0.008, 0.02, 0, y + 0.048, z - 0.02, 'y', 8); model.scopeY = y + 0.03;
    }
  }
  if (r && model.mount.rail) { const [y, z] = model.mount.rail; if (r.id === 'light') { cyl(G, M.dark, 0.012, 0.06, 0, y - 0.012, z, 'z', 10); cyl(G, mat(0xd8d2b0, 0.3, 0.2), 0.0105, 0.003, 0, y - 0.012, z - 0.031, 'z', 10); } else { box(G, M.dark, 0.02, 0.018, 0.04, 0, y - 0.01, z); cyl(G, new THREE.MeshBasicMaterial({ color: 0xff2010 }), 0.002, 0.002, 0, y - 0.01, z - 0.021, 'z', 6); } model.lightPos = new THREE.Vector3(0, y - 0.012, z - 0.04); }
  if (mu) { const big = mu.id === 'supp_rifle', len = big ? 0.19 : 0.15; cyl(G, M.dark, big ? 0.019 : 0.016, len, model.muzzle.x, model.muzzle.y, model.muzzle.z - len / 2 + 0.005, 'z', 12); model.muzzleLen = len; } else model.muzzleLen = 0;
}

export function buildWeaponModel(f, withHands = true) {
  const m = SPEC[f.id](); m.id = f.id; m.def = WEAPONS[f.id];
  if (!withHands) { m.P.hand.visible = false; if (m.P.lhand) m.P.lhand.visible = false; }
  m.base = { steel: m.M.steel.color.clone(), frame: m.M.frame.color.clone() }; m.lastCond = -1; m.lastAtt = '';
  m.vis = { slide: f.slide, mag: f.mag ? 0 : 1, trig: 0, hammer: f.hammer, cylAng: 0, cylOpen: 0, safety: f.safety ? 1 : 0, gate: 0, kick: 0 };
  m.sync = (dt) => syncModel(m, f, dt);
  m.sync(1); return m;
}

const RUST = new THREE.Color(0x6a4226), SOOT = new THREE.Color(0x0a0a0a);
function syncModel(m, f, dt) {
  const P = m.P, v = m.vis, D = f.def, k = Math.min(1, dt * 22);
  // wear
  const cq = Math.round(f.cond * 40) + (f.broken ? 100 : 0);
  if (cq !== m.lastCond) { m.lastCond = cq; const w = Math.min(1, Math.max(0, (0.85 - f.cond) / 0.8)); for (const key of ['steel', 'frame']) { m.M[key].color.copy(m.base[key]).lerp(f.broken ? SOOT : RUST, f.broken ? 0.6 : w * 0.75); m.M[key].roughness = 0.42 + w * 0.5; m.M[key].metalness = 0.3 - w * 0.25; } }
  const attKey = ['optic', 'rail', 'muzzle'].map(s => f.att[s] ? f.att[s].id : '-').join();
  if (attKey !== m.lastAtt) { m.lastAtt = attKey; buildAttachments(m, f); }
  // slide / bolt / pump
  let target = f.slide; if (v.kick > 0) { target = Math.max(target, v.kick); v.kick = Math.max(0, v.kick - dt * 9); }
  v.slide += (target - v.slide) * Math.min(1, dt * (f.grabbed ? 40 : 26));
  if (P.slide) {
    if (m.bolt) { const lift = Math.min(1, v.slide / 0.25), back = Math.max(0, (v.slide - 0.25) / 0.75); P.boltRot.rotation.z = lift * 1.1; P.slide.position.z = (P.slide.userData.z0 ??= P.slide.position.z) + back * m.travel; }
    else P.slide.position.z = v.slide * m.travel;
    if (f.broken && !m.bolt) { P.slide.rotation.z = 0.09; P.slide.rotation.y = 0.05; P.slide.position.y = 0.004; }
  }
  if (P.round) {
    const open = f.isAuto ? v.slide > 0.18 : v.slide > 0.5;
    const show = open && (f.chamber || f.staged || f.lifter || f.jam === 'ftf' || f.jam === 'doublefeed'); P.round.visible = !!show;
    if (show) { const spent = f.chamber === 'spent' && !f.jamRound; P.round.userData.tip.visible = !spent; P.round.rotation.x = f.jam === 'ftf' || f.jam === 'doublefeed' ? 0.35 : 0; }
    P.stove.visible = f.jam === 'stovepipe';
  }
  if (P.hammer) { const h = f.hammer === 2 ? 1 : f.hammer === 1 ? 0.45 : 0; v.hammer += (h - v.hammer) * Math.min(1, dt * 30); P.hammer.rotation.x = v.hammer * 0.95; }
  v.trig += ((f.triggerHeld ? 1 : 0) - v.trig) * Math.min(1, dt * 30); P.trigger.rotation.x = v.trig * 0.35;
  if (P.safety) { v.safety += ((f.safety ? 1 : 0) - v.safety) * k; if (m.kind === 'pistol') P.safety.rotation.x = (D.safety === 'decocker' ? -1 : 1) * v.safety * 0.6; else if (m.bolt) P.safety.rotation.y = v.safety * 0.9; else P.safety.rotation.x = v.safety * 1.4; }
  if (P.stop) P.stop.position.y = 0.034 + (f.slideLocked ? 0.004 : 0);
  if (P.mag) { v.mag += ((f.mag ? 0 : 1) - v.mag) * Math.min(1, dt * 9); P.mag.visible = v.mag < 0.97; P.mag.position.y = (P.mag.userData.y0 ??= P.mag.position.y) - v.mag * m.magDrop - (f.mag && !f.magSeated ? 0.006 : 0); }
  if (P.cyl) {
    const step = 6.2832 / D.cap; let ta = -f.cylIndex * step; while (ta - v.cylAng > Math.PI) ta -= 6.2832; while (ta - v.cylAng < -Math.PI) ta += 6.2832; v.cylAng += (ta - v.cylAng) * Math.min(1, dt * 20); P.cyl.rotation.z = v.cylAng;
    v.cylOpen += ((f.cylOpen ? 1 : 0) - v.cylOpen) * Math.min(1, dt * 12); P.crane.rotation.z = v.cylOpen * 1.25;
    if (P.gate) { v.gate += ((f.gateOpen ? 1 : 0) - v.gate) * k; P.gate.rotation.z = -v.gate * 1.3; }
    for (let i = 0; i < D.cap; i++) { const c = f.cyl[i], r = P.rounds[i]; r.rim.visible = !!c; r.primer.visible = !!c; r.hole.visible = !c; if (c) r.primer.material = c === 'spent' ? m.M.dark : m.M.steel; }
    if (f.broken) P.cyl.rotation.x = 0.12;
  }
  if (m.dot) { const a = f.att.optic; m.dot.visible = a.cond > 0.05 && !(a.cond < 0.4 && Math.random() < (0.4 - a.cond) * 1.2); m.dot.material.color.setScalar(1).setRGB(1, 0.16, 0.1).multiplyScalar(0.35 + a.cond * 0.65); }
}

// Magazine held in the support hand: shows the top round and a witness strip of how full it is.
export function buildMagModel(mag) {
  const M = baseMats(), g = new THREE.Group(), big = mag.type === 'ar15', box5 = mag.type === 'm40';
  const h = big ? 0.13 : box5 ? 0.06 : 0.115, d = big ? 0.058 : box5 ? 0.075 : 0.03, w = big ? 0.022 : box5 ? 0.026 : 0.021;
  box(g, M.steel, w, h, d, 0, 0, 0); box(g, M.dark, w + 0.006, 0.008, d + 0.01, 0, -h / 2, 0);
  const top = cyl(g, M.brass, 0.0048, d * 0.8, 0, h / 2 + 0.003, 0, 'z', 8); const strip = box(g, M.brass, w + 0.002, 0.001, 0.004, 0, 0, d / 2 - 0.006); const hand = box(g, M.glove, 0.06, 0.07, 0.07, -0.012, -h / 2 - 0.02, 0); const arm = box(g, M.sleeve, 0.07, 0.07, 0.35, -0.06, -h / 2 - 0.1, 0.2); arm.rotation.set(-0.4, 0.3, 0);
  const sync = () => { const fr = mag.rounds / mag.cap; top.visible = mag.rounds > 0; strip.visible = mag.rounds > 0; strip.scale.y = Math.max(1, fr * (h - 0.012) / 0.001); strip.position.y = -h / 2 + 0.008 + fr * (h - 0.012) / 2; };
  sync(); return { group: g, sync, mag };
}
export function buildRoundsModel(cal) { // loose rounds pinched in the support hand
  const M = baseMats(), g = new THREE.Group(), shell = cal === '12ga', r = shell ? 0.009 : cal === '.308' || cal === '5.56' ? 0.005 : 0.0048, l = shell ? 0.06 : cal === '.308' ? 0.065 : cal === '5.56' ? 0.05 : 0.026;
  cyl(g, shell ? M.shell : M.brass, r, l, 0, 0.02, 0, 'z', 8); box(g, M.glove, 0.06, 0.05, 0.07, -0.012, -0.02, 0.01); const arm = box(g, M.sleeve, 0.07, 0.07, 0.35, -0.06, -0.1, 0.2); arm.rotation.set(-0.4, 0.3, 0); return { group: g };
}

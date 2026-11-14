// Turns a generated layout into render meshes + the static collision world.
import * as THREE from '../vendor/three.module.js';
import { E, SURF } from './worldgen.js';
import { World } from './collision.js';
import { propBoxes, PROPS } from './data/props.js';
import { RNG } from './rng.js';

const TEXM = { concrete: 3, asphalt: 4, grass: 4, wood: 2, brick: 1.6, plaster: 3, metal: 2.5, roof: 2, tile: 2, fabric: 1.2, dirt: 3, moss: 1, paint: 1, ivy: 1, chain: 1 };
const CHUNK = 71;
const WALL_T = 0.2;

// ---------- procedural textures ----------
function canvasTex(size, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16; return t;
}
function noise(g, s, base, amp, seed = 1, grainX = 1, grainY = 1) {
  const img = g.createImageData(s, s), d = img.data; let r = seed * 9301 + 49297;
  const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  const cw = Math.ceil(s / grainX), ch = Math.ceil(s / grainY), cells = new Float32Array(cw * ch); for (let i = 0; i < cells.length; i++) cells[i] = rnd();
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const v = base + (cells[Math.floor(x / grainX) + Math.floor(y / grainY) * cw] - 0.5) * amp + (rnd() - 0.5) * amp * 0.5; const i = (x + y * s) * 4; d[i] = d[i + 1] = d[i + 2] = Math.max(0, Math.min(255, v)); d[i + 3] = 255; }
  g.putImageData(img, 0, 0); return rnd;
}
function blotches(g, s, rnd, n, color, rmin, rmax, alpha) { for (let i = 0; i < n; i++) { const x = rnd() * s, y = rnd() * s, r = rmin + rnd() * (rmax - rmin); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${color},${alpha})`); gr.addColorStop(1, `rgba(${color},0)`); g.fillStyle = gr; for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) { g.setTransform(1, 0, 0, 1, ox, oy); g.fillRect(x - r, y - r, r * 2, r * 2); } } g.setTransform(1, 0, 0, 1, 0, 0); }
function makeTextures() {
  const T = {};
  T.concrete = canvasTex(256, (g, s) => { const r = noise(g, s, 205, 46, 3, 2, 2); blotches(g, s, r, 14, '60,58,50', 10, 50, 0.22); g.strokeStyle = 'rgba(40,40,36,0.5)'; g.lineWidth = 1; for (let i = 0; i < 5; i++) { g.beginPath(); let x = r() * s, y = r() * s; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 60; y += (r() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); } });
  T.asphalt = canvasTex(256, (g, s) => { const r = noise(g, s, 190, 70, 5, 1, 1); blotches(g, s, r, 10, '30,30,30', 20, 70, 0.3); blotches(g, s, r, 6, '120,115,100', 10, 40, 0.15); g.strokeStyle = 'rgba(20,20,20,0.7)'; for (let i = 0; i < 4; i++) { g.beginPath(); let x = r() * s, y = r() * s; g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 70; y += (r() - 0.5) * 70; g.lineTo(x, y); } g.stroke(); } });
  T.grass = canvasTex(256, (g, s) => { const r = noise(g, s, 185, 90, 7, 1, 3); blotches(g, s, r, 20, '70,80,30', 15, 60, 0.3); blotches(g, s, r, 12, '150,140,80', 8, 30, 0.2); });
  T.dirt = canvasTex(256, (g, s) => { const r = noise(g, s, 195, 70, 9, 2, 2); blotches(g, s, r, 16, '60,45,30', 10, 50, 0.3); });
  T.wood = canvasTex(256, (g, s) => { const r = noise(g, s, 205, 40, 11, 12, 1); g.fillStyle = 'rgba(25,20,15,0.55)'; for (let y = 0; y < s; y += 32) g.fillRect(0, y, s, 2); blotches(g, s, r, 10, '50,40,30', 10, 40, 0.2); });
  T.brick = canvasTex(256, (g, s) => { const r = noise(g, s, 200, 40, 13, 2, 2); for (let row = 0; row < 16; row++) for (let col = 0; col < 8; col++) { g.fillStyle = `rgba(${90 + r() * 60 | 0},${50 + r() * 30 | 0},${40 + r() * 20 | 0},${0.12 + r() * 0.25})`; g.fillRect(col * 32 + (row % 2) * 16, row * 16, 30, 14); } g.fillStyle = 'rgba(210,205,190,0.55)'; for (let row = 0; row < 16; row++) { g.fillRect(0, row * 16 + 14, s, 2); for (let col = 0; col < 9; col++) g.fillRect(col * 32 + (row % 2) * 16 - 2, row * 16, 2, 14); } blotches(g, s, r, 8, '30,30,25', 20, 60, 0.25); });
  T.plaster = canvasTex(256, (g, s) => { const r = noise(g, s, 215, 26, 15, 3, 3); blotches(g, s, r, 8, '70,65,50', 20, 70, 0.1); blotches(g, s, r, 3, '40,50,30', 20, 50, 0.08); });
  T.metal = canvasTex(256, (g, s) => { const r = noise(g, s, 205, 36, 17, 8, 1); blotches(g, s, r, 12, '110,60,30', 6, 34, 0.33); g.fillStyle = 'rgba(20,20,20,0.3)'; for (let x = 0; x < s; x += 64) g.fillRect(x, 0, 1, s); });
  T.roof = canvasTex(256, (g, s) => { const r = noise(g, s, 190, 50, 19, 2, 2); g.fillStyle = 'rgba(15,15,15,0.5)'; for (let y = 0; y < s; y += 16) { g.fillRect(0, y, s, 2); for (let x = (y / 16 % 2) * 12; x < s; x += 24) g.fillRect(x, y, 1, 16); } blotches(g, s, r, 12, '60,80,40', 10, 40, 0.3); });
  T.tile = canvasTex(256, (g, s) => { const r = noise(g, s, 210, 30, 21, 2, 2); g.fillStyle = 'rgba(40,40,36,0.6)'; for (let i = 0; i < s; i += 64) { g.fillRect(i, 0, 2, s); g.fillRect(0, i, s, 2); } blotches(g, s, r, 10, '50,45,35', 14, 50, 0.3); });
  T.fabric = canvasTex(128, (g, s) => { const r = noise(g, s, 205, 50, 23, 1, 1); blotches(g, s, r, 6, '40,35,30', 10, 30, 0.25); });
  T.moss = canvasTex(128, (g, s) => { g.clearRect(0, 0, s, s); let r = 77; const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; }; for (let i = 0; i < 60; i++) { const a = rnd() * 6.28, d = rnd() * rnd() * s * 0.4, x = s / 2 + Math.cos(a) * d, y = s / 2 + Math.sin(a) * d, rad = 4 + rnd() * 14; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); } }, false);
  T.paint = canvasTex(64, (g, s) => { g.clearRect(0, 0, s, s); let r = 5; const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; }; for (let y = 0; y < s; y += 2) for (let x = 0; x < s; x += 2) if (rnd() > 0.38) { g.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.5})`; g.fillRect(x, y, 2, 2); } }, false);
  const leafy = (seed, n, sz) => canvasTex(256, (g, s) => { g.clearRect(0, 0, s, s); let r = seed; const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; }; for (let i = 0; i < n; i++) { const x = rnd() * s, y = rnd() * s, a = rnd() * 6.28, l = sz * (0.6 + rnd()); g.fillStyle = `rgb(${70 + rnd() * 60 | 0},${105 + rnd() * 70 | 0},${50 + rnd() * 40 | 0})`; g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(0, 0, l, l * 0.55, 0, 0, 6.28); g.fill(); g.restore(); } });
  T.ivy = leafy(31, 520, 7);
  T.chain = canvasTex(64, (g, s) => { g.clearRect(0, 0, s, s); g.strokeStyle = 'rgba(190,195,195,1)'; g.lineWidth = 1.6; for (let i = -s; i < s * 2; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + s, s); g.stroke(); g.beginPath(); g.moveTo(i, s); g.lineTo(i + s, 0); g.stroke(); } });
  T.blade = canvasTex(128, (g, s) => { g.clearRect(0, 0, s, s); let r = 3; const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; }; for (let i = 0; i < 26; i++) { const x = 10 + rnd() * (s - 20), h = s * (0.35 + rnd() * 0.6), lean = (rnd() - 0.5) * 40; g.strokeStyle = `rgb(${90 + rnd() * 70 | 0},${120 + rnd() * 70 | 0},${50 + rnd() * 40 | 0})`; g.lineWidth = 2 + rnd() * 3; g.beginPath(); g.moveTo(x, s); g.quadraticCurveTo(x + lean * 0.3, s - h * 0.6, x + lean, s - h); g.stroke(); } }, false);
  return T;
}

// ---------- geometry batcher ----------
class Batcher {
  constructor() { this.groups = new Map(); this.rnd = new RNG(4242); }
  group(mat, x, z) { const cx = Math.max(0, Math.min(3, Math.floor(x / CHUNK))), cz = Math.max(0, Math.min(3, Math.floor(z / CHUNK))); const k = mat + '|' + cx + '|' + cz; let g = this.groups.get(k); if (!g) { g = { mat, p: [], n: [], u: [], c: [] }; this.groups.set(k, g); } return g; }
  quad(g, v, n, uv, r, gg, b, k) { // v: 12 numbers, uv: 8, k: per-vertex brightness (4) or null
    for (const i of [0, 1, 2, 0, 2, 3]) { g.p.push(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]); g.n.push(n[0], n[1], n[2]); g.u.push(uv[i * 2], uv[i * 2 + 1]); const m = k ? k[i] : 1; g.c.push(r * m, gg * m, b * m); }
  }
  rgb(color, shade) { const j = shade * (0.95 + this.rnd.next() * 0.1); return [((color >> 16) & 255) / 255 * j, ((color >> 8) & 255) / 255 * j, (color & 255) / 255 * j]; }
  box(x0, y0, z0, x1, y1, z1, mat, color, shade = 1) {
    const g = this.group(mat, (x0 + x1) / 2, (z0 + z1) / 2), s = 1 / (TEXM[mat] || 2), [r, gg, b] = this.rgb(color, shade);
    const lo = y0 <= 0.01 && y1 - y0 > 1.2 ? 0.74 : 1, ks = [lo, lo, 1, 1];
    this.quad(g, [x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1], [1, 0, 0], [z1 * s, y0 * s, z0 * s, y0 * s, z0 * s, y1 * s, z1 * s, y1 * s], r, gg, b, ks);
    this.quad(g, [x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0], [-1, 0, 0], [z0 * s, y0 * s, z1 * s, y0 * s, z1 * s, y1 * s, z0 * s, y1 * s], r, gg, b, ks);
    this.quad(g, [x0, y1, z0, x0, y1, z1, x1, y1, z1, x1, y1, z0], [0, 1, 0], [x0 * s, z0 * s, x0 * s, z1 * s, x1 * s, z1 * s, x1 * s, z0 * s], r, gg, b, null);
    if (y0 > 0.01) this.quad(g, [x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1], [0, -1, 0], [x0 * s, z0 * s, x1 * s, z0 * s, x1 * s, z1 * s, x0 * s, z1 * s], r * 0.7, gg * 0.7, b * 0.7, null);
    this.quad(g, [x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], [0, 0, 1], [x0 * s, y0 * s, x1 * s, y0 * s, x1 * s, y1 * s, x0 * s, y1 * s], r, gg, b, ks);
    this.quad(g, [x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0], [0, 0, -1], [x1 * s, y0 * s, x0 * s, y0 * s, x0 * s, y1 * s, x1 * s, y1 * s], r, gg, b, ks);
  }
  cyl(x0, y0, z0, x1, y1, z1, mat, color, shade = 1) {
    const g = this.group(mat, (x0 + x1) / 2, (z0 + z1) / 2), s = 1 / (TEXM[mat] || 2), [r, gg, b] = this.rgb(color, shade);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, rx = (x1 - x0) / 2, rz = (z1 - z0) / 2, N = 8;
    for (let i = 0; i < N; i++) {
      const a0 = i / N * 6.2832, a1 = (i + 1) / N * 6.2832, am = (a0 + a1) / 2;
      const ax = cx + Math.cos(a0) * rx, az = cz + Math.sin(a0) * rz, bx = cx + Math.cos(a1) * rx, bz = cz + Math.sin(a1) * rz;
      this.quad(g, [bx, y0, bz, ax, y0, az, ax, y1, az, bx, y1, bz], [Math.cos(am), 0, Math.sin(am)], [a1 * rx * s, y0 * s, a0 * rx * s, y0 * s, a0 * rx * s, y1 * s, a1 * rx * s, y1 * s], r, gg, b, null);
      this.quad(g, [cx, y1, cz, ax, y1, az, bx, y1, bz, cx, y1, cz], [0, 1, 0], [0, 0, 0, 0, 0, 0, 0, 0], r, gg, b, null);
    }
  }
  // free quad with automatic winding from a normal hint; uv either planar scale or 0..1
  free(mat, v0, v1, v2, v3, hint, color, shade = 1, uv = null) {
    const g = this.group(mat, (v0[0] + v2[0]) / 2, (v0[2] + v2[2]) / 2), [r, gg, b] = this.rgb(color, shade);
    const e1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]], e2 = [v3[0] - v0[0], v3[1] - v0[1], v3[2] - v0[2]];
    let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; const l = Math.hypot(n[0], n[1], n[2]) || 1; n = [n[0] / l, n[1] / l, n[2] / l];
    let vs = [v0, v1, v2, v3], uvs = uv || null;
    if (n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] < 0) { vs = [v0, v3, v2, v1]; n = [-n[0], -n[1], -n[2]]; if (uvs) uvs = [uvs[0], uvs[1], uvs[6], uvs[7], uvs[4], uvs[5], uvs[2], uvs[3]]; }
    if (!uvs) { const s = 1 / (TEXM[mat] || 2); uvs = []; for (const v of vs) { if (Math.abs(n[1]) > 0.9) uvs.push(v[0] * s, v[2] * s); else uvs.push((Math.abs(n[0]) > Math.abs(n[2]) ? v[2] : v[0]) * s, v[1] * s); } }
    this.quad(g, vs.flat(), n, uvs, r, gg, b, null);
  }
  build(parent, mats) {
    const meshes = [];
    for (const g of this.groups.values()) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.n, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.u, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(g.c, 3));
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, mats[g.mat]); const flat = g.mat === 'moss' || g.mat === 'paint';
      m.castShadow = !flat && g.mat !== 'grass' && g.mat !== 'asphalt' && g.mat !== 'chain'; m.receiveShadow = !flat; if (flat) m.renderOrder = 1; m.matrixAutoUpdate = false;
      parent.add(m); meshes.push(m);
    }
    this.groups.clear(); return meshes;
  }
}

function signTexture(text, style) {
  const lines = text.split('\n'), c = document.createElement('canvas'); c.width = 512; c.height = style === 'graffiti' ? 128 : Math.max(96, 64 * lines.length + 32); const g = c.getContext('2d');
  if (style === 'sign') { g.fillStyle = '#2b2d2a'; g.fillRect(0, 0, c.width, c.height); g.strokeStyle = '#8f8a78'; g.lineWidth = 4; g.strokeRect(4, 4, c.width - 8, c.height - 8); g.fillStyle = '#c9c2a8'; }
  else if (style === 'board') { g.fillStyle = '#8f7f62'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = 'rgba(40,30,20,0.25)'; for (let i = 0; i < 30; i++) g.fillRect(0, Math.random() * c.height, c.width, 1); g.fillStyle = '#1b1a18'; }
  else g.fillStyle = ['#8a1f1a', '#d8d4c8', '#16181a', '#8a1f1a'][text.length % 4];
  g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = style === 'graffiti' ? 70 : 54; const font = style === 'graffiti' ? 'Impact, "Arial Narrow", sans-serif' : style === 'board' ? '"Courier New", monospace' : 'Georgia, serif';
  g.font = `bold ${fs}px ${font}`; const widest = Math.max(...lines.map(l => g.measureText(l).width)); if (widest > c.width - 30) { fs *= (c.width - 30) / widest; g.font = `bold ${fs}px ${font}`; }
  lines.forEach((l, i) => { if (style === 'graffiti') { g.save(); g.translate(c.width / 2, c.height / 2); g.rotate((text.length % 5 - 2) * 0.015); g.globalAlpha = 0.9; g.fillText(l, 0, 0); g.restore(); } else g.fillText(l, c.width / 2, c.height * (i + 0.5) / lines.length + (i === 1 ? -4 : 0), c.width - 24); if (i === 0 && lines.length > 1) g.font = `${fs * 0.55}px ${font}`; });
  if (style !== 'graffiti') { g.globalCompositeOperation = 'source-atop'; for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(60,55,40,${Math.random() * 0.25})`; const r = 10 + Math.random() * 40; g.beginPath(); g.arc(Math.random() * c.width, Math.random() * c.height, r, 0, 6.28); g.fill(); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return { tex: t, aspect: c.width / c.height };
}

const SURF_MAT = [['grass', 0x66783f], ['asphalt', 0x4a4b4d], ['concrete', 0x94928a], ['wood', 0x7a644b], ['tile', 0xa3a39a], ['dirt', 0x77664d]];
const INTERIOR = [0xd6cfba, 0xc9cdc0, 0xd3c4ac, 0xbdc5c9, 0xd8d1c2, 0xc4bca4];

export function buildWorld(L, scene) {
  const W = L.W, H = L.H, ci = (x, z) => x + z * W;
  const world = new World(W), bat = new Batcher(), group = new THREE.Group(); scene.add(group);
  const tex = makeTextures(), mats = {};
  for (const k of ['concrete', 'asphalt', 'grass', 'wood', 'brick', 'plaster', 'roof', 'tile', 'fabric', 'dirt']) mats[k] = new THREE.MeshStandardMaterial({ map: tex[k], vertexColors: true, roughness: 0.95, metalness: 0 });
  mats.metal = new THREE.MeshStandardMaterial({ map: tex.metal, vertexColors: true, roughness: 0.7, metalness: 0.25 });
  mats.moss = new THREE.MeshStandardMaterial({ map: tex.moss, vertexColors: true, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  mats.paint = new THREE.MeshStandardMaterial({ map: tex.paint, vertexColors: true, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  mats.ivy = new THREE.MeshStandardMaterial({ map: tex.ivy, vertexColors: true, alphaTest: 0.5, roughness: 1, side: THREE.DoubleSide });
  mats.chain = new THREE.MeshStandardMaterial({ map: tex.chain, vertexColors: true, alphaTest: 0.4, roughness: 0.6, metalness: 0.5, side: THREE.DoubleSide });
  const rng = new RNG(L.seed * 31 + 7);

  // ---------- ground ----------
  for (let z = 0; z < H; z++) {
    let x = 0;
    while (x < W) {
      const s = L.surf[ci(x, z)], inside = L.cellB[ci(x, z)] !== 0, b = L.cellB[ci(x, z)]; let x1 = x + 1;
      while (x1 < W && x1 % CHUNK !== 0 && L.surf[ci(x1, z)] === s && L.cellB[ci(x1, z)] === b) x1++;
      const [mat, col] = SURF_MAT[s], sc = 1 / TEXM[mat], g = bat.group(mat, (x + x1) / 2, z + 0.5), sh = inside ? 0.82 : 1;
      const r = ((col >> 16) & 255) / 255 * sh, gg = ((col >> 8) & 255) / 255 * sh, bb = (col & 255) / 255 * sh;
      bat.quad(g, [x, 0, z, x, 0, z + 1, x1, 0, z + 1, x1, 0, z], [0, 1, 0], [x * sc, z * sc, x * sc, (z + 1) * sc, x1 * sc, (z + 1) * sc, x1 * sc, z * sc], r, gg, bb, null);
      x = x1;
    }
  }
  // overgrowth & road paint
  const isRoad = (v) => (v % 68) < 12;
  for (let n = 0; n < 900; n++) { const x = rng.range(2, W - 2), z = rng.range(2, H - 2), c = ci(x | 0, z | 0); const s = L.surf[c]; if (s === SURF.GRASS || L.cellB[c] && !rng.chance(0.25)) continue; const r = rng.range(0.8, 3.2), col = rng.pick([0x55682f, 0x4a5a2c, 0x6a6a38, 0x3d3a30, 0x5a4a34]); bat.free('moss', [x - r, 0.02, z - r], [x - r, 0.02, z + r], [x + r, 0.02, z + r], [x + r, 0.02, z - r], [0, 1, 0], col, L.cellB[c] ? 0.6 : 1, [0, 0, 0, 1, 1, 1, 1, 0]); }
  for (let i = 0; i <= 4; i++) { const c = i * 68 + 6; for (let t = 4; t < W - 6; t += 6) { if (isRoad(t) || isRoad(t + 3) || rng.chance(0.3)) continue; bat.free('paint', [c - 0.08, 0.015, t], [c - 0.08, 0.015, t + 3], [c + 0.08, 0.015, t + 3], [c + 0.08, 0.015, t], [0, 1, 0], 0xb9a44a, 1, [0, 0, 0, 3, 0.2, 3, 0.2, 0]); bat.free('paint', [t, 0.015, c - 0.08], [t, 0.015, c + 0.08], [t + 3, 0.015, c + 0.08], [t + 3, 0.015, c - 0.08], [0, 1, 0], 0xb9a44a, 1, [0, 0, 0, 0.2, 3, 0.2, 3, 0]); } }

  // ---------- walls ----------
  const bh = (b) => b >= 0 ? L.buildings[b].h : 2.8;
  function wallRun(vert, line, a0, a1, code, b, inA, inB) {
    // run along z (vert) or x at constant `line`, from a0 to a1
    const B = b >= 0 ? L.buildings[b] : null, h = bh(b), t = WALL_T / 2;
    const bx = (p0, p1, y0, y1, o0, o1) => vert ? [line + o0, y0, p0, line + o1, y1, p1] : [p0, y0, line + o0, p1, y1, line + o1];
    const solid = (y0, y1, ext) => {
      const e = ext ? 0.1 : 0; const c = bx(a0 - e, a1 + e, y0, y1, -t, t); world.add(...c, B ? (B.mat === 'plaster' ? 'brick' : B.mat) : 'wood');
      const intC = INTERIOR[b % INTERIOR.length], sh = B.tint + 0.5;
      const halves = [[-t, 0, inA], [0, t, inB]];
      for (const [o0, o1, inside] of halves) { const v = bx(a0 - e, a1 + e, y0, y1, o0, o1); if (inside) bat.box(...v, 'plaster', intC, sh); else bat.box(...v, B.mat, B.color, 1.22); }
    };
    if (code === E.WALL) solid(0, h, true);
    else if (code === E.DOOR) solid(2.1, h, false);
    else if (code === E.WIN) { solid(0, 0.9, false); solid(2.1, h, false); const f = bx(a0, a1, 0.9, 0.96, -t - 0.04, t + 0.04); bat.box(...f, 'wood', 0xb8b4a6, 0.9); if (rng.chance(0.3)) for (const y of [1.15, 1.55, 1.9]) { if (rng.chance(0.8)) { const p = bx(a0, a1, y, y + 0.16, (inA ? t : -t - 0.03), (inA ? t + 0.03 : -t)); bat.box(...p, 'wood', 0x7d6a50, 1); const pc = bx(a0, a1, y, y + 0.16, -t, t); world.add(...pc, 'wood'); } } }
    else if (code === E.OPEN) { if (h > 2.7) solid(Math.min(h - 0.3, 3.4), h, false); }
    else if (code === E.FENCE) { const c = bx(a0, a1, 0, 1.75, -0.04, 0.04); world.add(...c, 'wood', { thin: true }); bat.box(...c, 'wood', 0x86795f, 1); }
    else if (code === E.CHAIN) {
      const c = bx(a0, a1, 0, 2.3, -0.03, 0.03); world.add(...c, 'chain', { see: true });
      const p0 = vert ? [line, 0, a0] : [a0, 0, line], p1 = vert ? [line, 0, a1] : [a1, 0, line];
      bat.free('chain', p0, p1, [p1[0], 2.3, p1[2]], [p0[0], 2.3, p0[2]], vert ? [1, 0, 0] : [0, 0, 1], 0xa9adaa, 1, [0, 0, (a1 - a0) * 2, 0, (a1 - a0) * 2, 4.6, 0, 4.6]);
      for (let p = a0; p <= a1; p += 3) { const q = vert ? [line - 0.04, 0, p - 0.04, line + 0.04, 2.35, p + 0.04] : [p - 0.04, 0, line - 0.04, p + 0.04, 2.35, line + 0.04]; bat.cyl(...q, 'metal', 0x8a8e8c); }
    }
  }
  // horizontal edges (constant z), then vertical
  for (let z = 0; z <= H; z++) { let x = 0; while (x < W) { const code = L.edgeH[x + z * W]; if (!code) { x++; continue; } const b = L.edgeHb[x + z * W]; const ia = (xx) => z > 0 && b >= 0 && L.cellB[ci(xx, z - 1)] === b + 1 || (z > 0 && L.cellB[ci(xx, z - 1)] !== 0 && b >= 0), ib = (xx) => z < H && b >= 0 && L.cellB[ci(xx, z)] !== 0; const A = ia(x), B = ib(x); let x1 = x + 1; const single = code === E.DOOR; while (!single && x1 < W && L.edgeH[x1 + z * W] === code && L.edgeHb[x1 + z * W] === b && ia(x1) === A && ib(x1) === B) x1++; wallRun(false, z, x, x1, code, b, A, B); x = x1; } }
  for (let x = 0; x <= W; x++) { let z = 0; while (z < H) { const code = L.edgeV[x + z * (W + 1)]; if (!code) { z++; continue; } const b = L.edgeVb[x + z * (W + 1)]; const ia = (zz) => x > 0 && b >= 0 && L.cellB[ci(x - 1, zz)] !== 0, ib = (zz) => x < W && b >= 0 && L.cellB[ci(x, zz)] !== 0; const A = ia(z), B = ib(z); let z1 = z + 1; const single = code === E.DOOR; while (!single && z1 < H && L.edgeV[x + z1 * (W + 1)] === code && L.edgeVb[x + z1 * (W + 1)] === b && ia(z1) === A && ib(z1) === B) z1++; wallRun(true, x, z, z1, code, b, A, B); z = z1; } }

  // ---------- roofs ----------
  for (const b of L.buildings) {
    const o = 0.35, x0 = b.x - o, x1 = b.x + b.w + o, z0 = b.z - o, z1 = b.z + b.d + o, h = b.h;
    world.add(b.x, h, b.z, b.x + b.w, h + 0.22, b.z + b.d, 'wood');
    bat.box(x0, h, z0, x1, h + 0.22, z1, 'roof', b.roof, 1);
    bat.box(b.x + 0.1, h - 0.04, b.z + 0.1, b.x + b.w - 0.1, h, b.z + b.d - 0.1, 'plaster', 0xb5b0a2, b.tint + 0.28);
    if (b.gable) {
      const yb = h + 0.22, yr = yb + 1.7;
      if (b.w >= b.d) { const zc = (z0 + z1) / 2; bat.free('roof', [x0, yb, z0], [x1, yb, z0], [x1, yr, zc], [x0, yr, zc], [0, 1, -0.5], b.roof); bat.free('roof', [x0, yb, z1], [x1, yb, z1], [x1, yr, zc], [x0, yr, zc], [0, 1, 0.5], b.roof); for (const [xx, nx] of [[b.x - 0.05, -1], [b.x + b.w + 0.05, 1]]) bat.free(b.mat, [xx, yb, z0], [xx, yb, z1], [xx, yr, zc], [xx, yr, zc], [nx, 0, 0], b.color); }
      else { const xc = (x0 + x1) / 2; bat.free('roof', [x0, yb, z0], [x0, yb, z1], [xc, yr, z1], [xc, yr, z0], [-0.5, 1, 0], b.roof); bat.free('roof', [x1, yb, z0], [x1, yb, z1], [xc, yr, z1], [xc, yr, z0], [0.5, 1, 0], b.roof); for (const [zz, nz] of [[b.z - 0.05, -1], [b.z + b.d + 0.05, 1]]) bat.free(b.mat, [x0, yb, zz], [x1, yb, zz], [xc, yr, zz], [xc, yr, zz], [0, 0, nz], b.color); }
    }
    if (b.steeple) { const cx = b.x + b.w / 2, cz = b.z + b.d / 2; bat.box(cx - 1.4, h, cz - 1.4, cx + 1.4, h + 6, cz + 1.4, 'wood', 0xb9b6aa); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = [cx + (dx ? dx * 1.6 : -1.6), h + 6, cz + (dz ? dz * 1.6 : -1.6)], c = [cx + (dx ? dx * 1.6 : 1.6), h + 6, cz + (dz ? dz * 1.6 : 1.6)]; bat.free('roof', a, c, [cx, h + 10.5, cz], [cx, h + 10.5, cz], [dx, 0.4, dz], 0x4a4743); } }
    if (b.type === 'school' || b.type === 'warehouse') { for (let n = 0; n < 4; n++) { const x = b.x + 3 + n * (b.w - 8) / 3, z = b.z + b.d / 2; bat.box(x, h + 0.22, z - 1, x + 2, h + 1.1, z + 1, 'metal', 0x7d8684); } }
  }
  // ivy on exterior walls
  for (const b of L.buildings) for (let n = 0; n < Math.ceil((b.w + b.d) / 5); n++) {
    const side = rng.int(0, 3), len = side % 2 === 0 ? b.w : b.d, w = Math.min(len - 0.4, rng.range(2, 6)), s0 = rng.range(0.2, len - w - 0.2), hh = rng.range(1.4, b.h + (b.gable ? 0.8 : 0.2)), off = 0.13 + n * 0.004;
    const col = rng.pick([0x5c7a3c, 0x4d6a36, 0x6a7f42, 0x556b2f]); let p0, p1, hint;
    if (side === 0) { p0 = [b.x + s0, 0, b.z - off]; p1 = [b.x + s0 + w, 0, b.z - off]; hint = [0, 0, -1]; } else if (side === 2) { p0 = [b.x + s0, 0, b.z + b.d + off]; p1 = [b.x + s0 + w, 0, b.z + b.d + off]; hint = [0, 0, 1]; }
    else if (side === 3) { p0 = [b.x - off, 0, b.z + s0]; p1 = [b.x - off, 0, b.z + s0 + w]; hint = [-1, 0, 0]; } else { p0 = [b.x + b.w + off, 0, b.z + s0]; p1 = [b.x + b.w + off, 0, b.z + s0 + w]; hint = [1, 0, 0]; }
    const u0 = rng.range(0, 1), v0 = rng.range(0, 1);
    bat.free('ivy', p0, p1, [p1[0], hh, p1[2]], [p0[0], hh, p0[2]], hint, col, 1, [u0, v0, u0 + w / 3, v0, u0 + w / 3, v0 + hh / 3, u0, v0 + hh / 3]);
  }

  // ---------- props ----------
  const propRt = [];
  for (const inst of L.props) {
    const sh = inst.b >= 0 ? L.buildings[inst.b].tint + 0.4 : 1, cols = [];
    for (const q of propBoxes(inst)) {
      if (q.col) cols.push(world.add(q.x0, q.y0, q.z0, q.x1, q.y1, q.z1, q.mat, { prop: true, thin: q.y1 - q.y0 < 0.3 || q.mat === 'fabric' }));
      if (q.vis) (q.cyl ? bat.cyl : bat.box).call(bat, q.x0, q.y0, q.z0, q.x1, q.y1, q.z1, q.mat, q.color || 0x808080, sh);
    }
    propRt.push(cols);
  }
  for (const q of L.boxes) { if (!q.vis) world.add(q.x0, q.y0, q.z0, q.x1, q.y1, q.z1, q.mat); bat.box(q.x0, q.y0, q.z0, q.x1, q.y1, q.z1, q.mat, q.color, 1); }

  // ---------- perimeter wall + gates ----------
  const gates = [];
  for (let side = 0; side < 4; side++) {
    const gs = L.gates.filter(g => g.side === side).sort((a, b) => a.c - b.c); let p = 0;
    const seg = (a, b) => { if (b - a < 0.1) return; const c = side === 0 ? [a, 0, 0, b, 5.2, 1] : side === 2 ? [a, 0, H - 1, b, 5.2, H] : side === 3 ? [0, 0, a, 1, 5.2, b] : [W - 1, 0, a, W, 5.2, b]; world.add(...c, 'concrete'); bat.box(...c, 'concrete', 0x8a8880, 1); bat.box(c[0] - 0.1, 5.2, c[2] - 0.1, c[3] + 0.1, 5.5, c[5] + 0.1, 'metal', 0x5d605c, 1); };
    for (const g of gs) {
      seg(p, g.c - 4); p = g.c + 4;
      const horiz = side === 0 || side === 2, mid = side === 0 ? 0.5 : side === 2 ? H - 0.5 : side === 3 ? 0.5 : W - 0.5;
      const cbox = horiz ? [g.c - 4, 0, mid - 0.25, g.c + 4, 5.2, mid + 0.25] : [mid - 0.25, 0, g.c - 4, mid + 0.25, 5.2, g.c + 4];
      const col = world.add(...cbox, 'metal');
      const hdr = horiz ? [g.c - 4, 4.6, mid - 0.5, g.c + 4, 5.2, mid + 0.5] : [mid - 0.5, 4.6, g.c - 4, mid + 0.5, 5.2, g.c + 4]; bat.box(...hdr, 'concrete', 0x8a8880, 1);
      const leafMat = new THREE.MeshStandardMaterial({ map: tex.metal, color: 0x5a5f58, roughness: 0.7, metalness: 0.3 }), leaves = [];
      for (const sgn of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(horiz ? 4 : 0.3, 4.6, horiz ? 0.3 : 4), leafMat); m.position.set(horiz ? g.c + sgn * 2 : mid, 2.3, horiz ? mid : g.c + sgn * 2); m.castShadow = true; m.userData = { sgn, horiz, base: horiz ? g.c + sgn * 2 : g.c + sgn * 2 }; group.add(m); leaves.push(m); }
      gates.push({ ...g, col, leaves, open: 0 });
      const ins = side === 0 ? [g.c, 2.6, 1.08, 2] : side === 2 ? [g.c, 2.6, H - 1.08, 0] : side === 3 ? [1.08, 2.6, g.c, 1] : [W - 1.08, 2.6, g.c, 3];
      L.signs.push({ text: g.kind === 'exit' ? 'GATE — AUTHORIZED RECOVERY ONLY' : 'QUARANTINE ZONE — NO EGRESS', x: ins[0], y: 3.6, z: ins[2], side: ins[3], w: 6, h: 0.9, style: 'board', _gate: true });
    }
    seg(p, side % 2 === 0 ? W : H);
  }
  bat.build(group, mats);

  // ---------- doors ----------
  const doorGeoV = new THREE.BoxGeometry(0.06, 2.06, 0.92), doorGeoH = new THREE.BoxGeometry(0.92, 2.06, 0.06);
  const doorMats = [0x6b5a48, 0x7a7466, 0x4f5a5c, 0x8a8576, 0x5c4a3c].map(c => new THREE.MeshStandardMaterial({ map: tex.wood, color: c, roughness: 0.9 }));
  const doors = L.doors.map((d, i) => {
    const pivot = new THREE.Group(), mesh = new THREE.Mesh(d.v ? doorGeoV : doorGeoH, doorMats[(d.b + (d.ext ? 2 : 0)) % doorMats.length]);
    if (d.v) { pivot.position.set(d.x, 0, d.z + 0.04); mesh.position.set(0, 1.03, 0.46); } else { pivot.position.set(d.x + 0.04, 0, d.z); mesh.position.set(0.46, 1.03, 0); }
    mesh.castShadow = true; pivot.add(mesh); group.add(pivot);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshStandardMaterial({ color: 0x9a9070, metalness: 0.8, roughness: 0.4 })); knob.position.set(d.v ? 0 : 0.82, 1.0, d.v ? 0.82 : 0); knob.scale.set(d.v ? 2.6 : 1, 1, d.v ? 1 : 2.6); pivot.add(knob);
    const box = d.v ? world.add(d.x - 0.05, 0, d.z, d.x + 0.05, 2.1, d.z + 1, 'wood', { thin: true }) : world.add(d.x, 0, d.z - 0.05, d.x + 1, 2.1, d.z + 0.05, 'wood', { thin: true });
    const rt = { i, d, pivot, box, open: d.open, ang: 0, target: 0, x: d.v ? d.x : d.x + 0.5, z: d.v ? d.z + 0.5 : d.z, v: d.v, sign: (i % 2 ? 1 : -1) };
    box.door = rt; if (rt.open) { box.off = true; rt.target = rt.ang = rt.sign * 1.75; pivot.rotation.y = rt.ang; }
    return rt;
  });

  // ---------- signs ----------
  for (const s of L.signs) {
    const { tex: t } = signTexture(s.text, s.style);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), new THREE.MeshStandardMaterial({ map: t, transparent: s.style === 'graffiti', roughness: 1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    m.position.set(s.x, s.y, s.z); m.rotation.y = [Math.PI, Math.PI / 2, 0, -Math.PI / 2][s.side]; group.add(m);
  }
  L.signs = L.signs.filter(s => !s._gate);

  // ---------- vegetation (instanced) ----------
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  const trees = L.plants.filter(p => p.kind === 'tree'), bushes = L.plants.filter(p => p.kind === 'bush');
  const trunkM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.24, 1, 6), new THREE.MeshStandardMaterial({ map: tex.wood, color: 0x54463a, roughness: 1 }), trees.length);
  const leafGeo = new THREE.IcosahedronGeometry(1, 1); { const p = leafGeo.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + Math.sin(p.getX(i) * 12.9 + p.getY(i) * 78.2 + p.getZ(i) * 37.7) * 0.16; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } leafGeo.computeVertexNormals(); }
  const leafMat = new THREE.MeshStandardMaterial({ map: tex.ivy, roughness: 1 }); leafMat.map.repeat.set(1, 1);
  const leafM = new THREE.InstancedMesh(leafGeo, leafMat, trees.length * 3), bushM = new THREE.InstancedMesh(leafGeo, leafMat, bushes.length);
  trees.forEach((t, i) => {
    const hgt = 3.2 * t.s + 1.2; dummy.position.set(t.x, hgt / 2, t.z); dummy.rotation.set(0, t.r, 0); dummy.scale.set(t.s, hgt, t.s); dummy.updateMatrix(); trunkM.setMatrixAt(i, dummy.matrix);
    world.add(t.x - 0.2, 0, t.z - 0.2, t.x + 0.2, hgt, t.z + 0.2, 'wood');
    for (let k = 0; k < 3; k++) { const a = t.r + k * 2.1, rr = k === 0 ? 0 : 0.9 * t.s, sc = (k === 0 ? 2.0 : 1.5) * t.s; dummy.position.set(t.x + Math.cos(a) * rr, hgt + (k === 0 ? 0.6 : -0.2) * t.s + (t.v === 2 ? 0.8 : 0), t.z + Math.sin(a) * rr); dummy.rotation.set(k, a, k * 2); dummy.scale.set(sc, sc * (t.v === 1 ? 1.25 : 0.85), sc); dummy.updateMatrix(); leafM.setMatrixAt(i * 3 + k, dummy.matrix); color.setHex([0x7d9a58, 0x6b8a4c, 0x8a9a55][t.v]).multiplyScalar(0.8 + ((i * 7 + k * 3) % 10) / 25); leafM.setColorAt(i * 3 + k, color); }
  });
  bushes.forEach((t, i) => { dummy.position.set(t.x, 0.3 * t.s, t.z); dummy.rotation.set(0, t.r, 0); dummy.scale.set(0.8 * t.s, 0.6 * t.s, 0.8 * t.s); dummy.updateMatrix(); bushM.setMatrixAt(i, dummy.matrix); color.setHex([0x6b8a4c, 0x5c7a40, 0x7a8a4a][t.v]).multiplyScalar(0.75 + (i % 10) / 30); bushM.setColorAt(i, color); });
  for (const m of [trunkM, leafM, bushM]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; group.add(m); }
  bushM.castShadow = false;
  // grass tufts per chunk
  const tuft = new THREE.BufferGeometry(); { const p = [], u = []; for (const a of [0, Math.PI / 2]) { const c = Math.cos(a) * 0.5, s = Math.sin(a) * 0.5; p.push(-c, 0, -s, c, 0, s, c, 1, s, -c, 0, -s, c, 1, s, -c, 1, -s, c, 0, s, -c, 0, -s, c, 1, s, c, 1, s, -c, 0, -s, -c, 1, -s); u.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 1); } tuft.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); tuft.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2)); const nn = []; for (let i = 0; i < 24; i++) nn.push(0, 1, 0); tuft.setAttribute('normal', new THREE.Float32BufferAttribute(nn, 3)); }
  const tuftMat = new THREE.MeshStandardMaterial({ map: tex.blade, alphaTest: 0.45, roughness: 1 });
  const chunks = Array.from({ length: 16 }, () => []);
  for (let z = 2; z < H - 2; z++) for (let x = 2; x < W - 2; x++) { const c = ci(x, z); if (L.cellB[c]) continue; const s = L.surf[c]; const p = s === SURF.GRASS ? 0.42 : s === SURF.DIRT ? 0.06 : 0.035; if (rng.next() < p) chunks[Math.min(3, (x / CHUNK) | 0) + Math.min(3, (z / CHUNK) | 0) * 4].push([x + rng.next(), z + rng.next(), s === SURF.GRASS ? rng.range(0.35, 0.95) : rng.range(0.25, 0.5), rng.next()]); }
  chunks.forEach((list, k) => { if (!list.length) return; const m = new THREE.InstancedMesh(tuft, tuftMat, list.length); list.forEach((t, i) => { dummy.position.set(t[0], 0, t[1]); dummy.rotation.set(0, t[3] * 6.28, 0); dummy.scale.set(0.9 + t[3], t[2], 0.9 + t[3]); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); color.setHSL(0.2 + t[3] * 0.08, 0.3, 0.42 + t[3] * 0.18); m.setColorAt(i, color); }); m.receiveShadow = true; m.computeBoundingSphere(); group.add(m); });

  // mast beacon lamp
  let lamp = null; const mast = L.props.find(p => p.kind === 'mast');
  if (mast) { lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a, fog: false })); lamp.position.set(mast.x + 0.5, 26.3, mast.z + 0.5); group.add(lamp); }

  let cullT = 0;
  return {
    world, group, doors, gates, tex, propCols: propRt,
    tick(t, dt, px = 0, pz = 0) {
      if (lamp) lamp.visible = (t % 2.4) < 0.5;
      cullT -= dt; if (cullT <= 0) { cullT = 0.5; for (const d of doors) d.pivot.visible = Math.abs(d.x - px) < 90 && Math.abs(d.z - pz) < 90; }
      for (const d of doors) if (d.ang !== d.target) { const k = Math.min(1, dt * 5); d.ang += (d.target - d.ang) * k; if (Math.abs(d.target - d.ang) < 0.01) d.ang = d.target; d.pivot.rotation.y = d.ang; }
      for (const g of gates) if (g.open > 0 && g.open < 1) { g.open = Math.min(1, g.open + dt * 0.22); for (const m of g.leaves) { const off = m.userData.base + m.userData.sgn * g.open * 3.9; if (m.userData.horiz) m.position.x = off; else m.position.z = off; } if (g.open > 0.85) g.col.off = true; }
    },
    setDoor(d, open, fromX, fromZ) {
      if (d.open === open) return; d.open = open; d.box.off = open;
      if (open) { const side = d.v ? fromX - d.x : fromZ - d.z; d.sign = d.v ? (side > 0 ? -1 : 1) : (side > 0 ? 1 : -1); d.target = d.sign * 1.75; } else d.target = 0;
    },
    dispose() { scene.remove(group); group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { if (m.map && !Object.values(tex).includes(m.map)) m.map.dispose(); m.dispose(); } } }); for (const t of Object.values(tex)) t.dispose(); },
  };
}

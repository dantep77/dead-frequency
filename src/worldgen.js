// Procedural generation of Bellwether. Pure data (no rendering) so it is deterministic and testable.
// The town is a grid of city blocks on a 1 m cell lattice; walls live on cell edges.
import { RNG } from './rng.js';
import { PROPS, propFootprint, propPoint } from './data/props.js';
import { assignLoot } from './loot.js';

export const SIZE = 284, NB = 4, BLOCK = 56, ROAD = 12, PITCH = 68;
export const E = { NONE: 0, WALL: 1, DOOR: 2, WIN: 3, FENCE: 4, OPEN: 5, CHAIN: 6 };
export const SURF = { GRASS: 0, ASPHALT: 1, CONCRETE: 2, WOOD: 3, TILE: 4, DIRT: 5 };
const PASS = (c) => c === E.NONE || c === E.DOOR || c === E.OPEN;

function place(o, X0, Z0, Su, Sv, u, v, w, d) {
  switch (o) {
    case 0: return { x: X0 + u, z: Z0 + v, w, d };
    case 2: return { x: X0 + Su - u - w, z: Z0 + Sv - v - d, w, d };
    case 1: return { x: X0 + Sv - v - d, z: Z0 + u, w: d, d: w };
    default: return { x: X0 + v, z: Z0 + Su - u - w, w: d, d: w };
  }
}
const SIDE = (o) => ({ front: o, back: (o + 2) % 4, right: [1, 2, 3, 0][o], left: [3, 0, 1, 2][o] });

// Fixed-plan building templates in a local frame (front wall at v = 0).
const T = {
  store:     { w: 16, d: 12, h: 3.3, mat: 'brick', floor: SURF.TILE, rooms: [[0, 0, 16, 8, 'sales'], [0, 8, 9, 4, 'storeroom'], [9, 8, 7, 4, 'office']], front: ['sales'], back: ['storeroom'], win: 0.75, names: ['QUIK-STOP MARKET', 'BELLWETHER FOODS', 'CORNER GROCER'] },
  diner:     { w: 12, d: 10, h: 3.1, mat: 'brick', floor: SURF.TILE, rooms: [[0, 0, 12, 7, 'diner'], [0, 7, 7, 3, 'kitchen'], [7, 7, 5, 3, 'storeroom']], front: ['diner'], back: ['kitchen'], win: 0.8, names: ["DOTTIE'S DINER", 'THE BELL GRILL'] },
  pharmacy:  { w: 12, d: 10, h: 3.1, mat: 'brick', floor: SURF.TILE, rooms: [[0, 0, 12, 6, 'sales'], [0, 6, 6, 4, 'nurse'], [6, 6, 6, 4, 'office']], front: ['sales'], back: ['office'], win: 0.6, names: ['WELLSPRING PHARMACY'] },
  hardware:  { w: 14, d: 12, h: 3.4, mat: 'brick', floor: SURF.CONCRETE, rooms: [[0, 0, 14, 8, 'sales'], [0, 8, 8, 4, 'garage'], [8, 8, 6, 4, 'storeroom']], front: ['sales'], back: ['garage'], win: 0.5, names: ['ARROYO HARDWARE', 'TRUE GRIT TOOL & FEED'] },
  laundry:   { w: 10, d: 10, h: 3.0, mat: 'brick', floor: SURF.TILE, rooms: [[0, 0, 10, 7, 'laundry'], [0, 7, 5, 3, 'office'], [5, 7, 5, 3, 'storeroom']], front: ['laundry'], back: ['storeroom'], win: 0.7, names: ['SUDS & SPIN'] },
  kiosk:     { w: 10, d: 6, h: 3.0, mat: 'plaster', floor: SURF.TILE, rooms: [[0, 0, 7, 6, 'sales'], [7, 0, 3, 6, 'storeroom']], front: ['sales'], back: null, win: 0.8, names: ['GAS · SNACKS · ICE'] },
  eoc:       { w: 20, d: 14, h: 4.4, mat: 'concrete', floor: SURF.CONCRETE, rooms: [[0, 0, 8, 14, 'bay'], [8, 0, 6, 6, 'hall'], [14, 0, 6, 8, 'dispatch'], [14, 8, 6, 6, 'armory'], [8, 6, 6, 8, 'office']], front: ['hall'], back: ['office'], open: [['front', 4, 'bay']], win: 0.3, names: ['BELLWETHER COUNTY EMERGENCY OPERATIONS'] },
  clinic:    { w: 14, d: 12, h: 3.1, mat: 'plaster', floor: SURF.TILE, rooms: [[0, 0, 14, 5, 'hall'], [0, 5, 8, 7, 'clinic'], [8, 5, 6, 7, 'nurse']], front: ['hall'], back: ['clinic'], win: 0.5, names: ['COUNTY HEALTH CLINIC'] },
  hall:      { w: 10, d: 18, h: 4.6, mat: 'wood', floor: SURF.WOOD, rooms: [[0, 0, 10, 4, 'hall'], [0, 4, 10, 14, 'nave']], front: ['hall'], back: ['nave'], win: 0.4, names: ['GRACE COMMUNITY HALL'] },
  school:    { w: 40, d: 28, h: 3.6, mat: 'brick', floor: SURF.TILE, rooms: [[0, 0, 8, 12, 'classroom'], [8, 0, 8, 12, 'classroom'], [16, 0, 8, 12, 'hall'], [24, 0, 8, 6, 'office'], [24, 6, 8, 6, 'nurse'], [32, 0, 8, 12, 'classroom'], [0, 12, 40, 4, 'corridor'], [0, 16, 16, 12, 'gym'], [16, 16, 8, 12, 'classroom'], [24, 16, 8, 12, 'classroom'], [32, 16, 8, 12, 'classroom']], front: ['hall'], back: ['gym'], sideDoors: ['corridor'], win: 0.55, names: ['BELLWETHER ELEMENTARY'] },
  warehouse: { w: 36, d: 26, h: 6.5, mat: 'metal', floor: SURF.CONCRETE, rooms: [[0, 0, 8, 6, 'office'], [8, 0, 8, 6, 'office'], [16, 0, 10, 6, 'storeroom'], [26, 0, 10, 6, 'storeroom'], [0, 6, 36, 20, 'floor']], front: ['office'], back: null, open: [['back', 4, 'floor'], ['right', 4, 'floor']], win: 0.1, names: ['HALE AGRONOMICS — DISTRIBUTION'] },
};
const HALLS = new Set(['hall', 'corridor', 'living', 'sales', 'floor', 'diner', 'laundry', 'nave']);
const FURN = {
  living: [['couch', 'wall', 1, 1], ['tvstand', 'wall', 1, 1], ['coffeetable', 'center', 1, 1], ['armchair', 'any', 0, 2], ['bookshelf', 'wall', 0, 1], ['table', 'any', 0, 1], ['debris', 'any', 0, 2]],
  kitchen: [['counter', 'wall', 1, 2], ['fridge', 'wall', 1, 1], ['stove', 'wall', 1, 1], ['table', 'center', 0, 1], ['debris', 'any', 0, 1]],
  bedroom: [['bed', 'wall', 1, 1], ['nightstand', 'wall', 1, 1], ['dresser', 'wall', 0, 1], ['wardrobe', 'wall', 0, 1], ['desk', 'wall', 0, 1]],
  bath: [['toilet', 'wall', 1, 1], ['sink', 'wall', 1, 1], ['bathtub', 'wall', 0, 1]],
  garage: [['workbench', 'wall', 1, 1], ['shelving', 'wall', 1, 2], ['toolchest', 'wall', 0, 1], ['car', 'any', 0, 1], ['crate', 'any', 0, 1]],
  sales: [['shopcounter', 'wall', 1, 1], ['cooler', 'wall', 1, 2], ['@gondola', 3, 2], ['debris', 'any', 1, 3]],
  storeroom: [['shelving', 'wall', 1, 3], ['crate', 'any', 1, 2], ['pallet', 'any', 0, 2]],
  office: [['desk', 'wall', 1, 2], ['filecab', 'wall', 1, 2], ['bookshelf', 'wall', 0, 1], ['debris', 'any', 0, 1]],
  classroom: [['desk', 'wall', 1, 1], ['@schooldesk', 2, 2], ['bookshelf', 'wall', 0, 1]],
  corridor: [['lockers', 'wall', 3, 6], ['debris', 'any', 1, 3]],
  gym: [['@cot', 2, 3], ['bodybag', 'any', 3, 6], ['crate', 'any', 1, 2], ['table', 'wall', 1, 1]],
  nurse: [['exambed', 'wall', 1, 1], ['medcab', 'wall', 1, 2], ['desk', 'wall', 1, 1]],
  floor: [['@rack', 4, 3], ['cratestack', 'any', 2, 4], ['crate', 'any', 2, 5], ['pallet', 'any', 2, 5], ['barrel', 'any', 1, 4], ['workbench', 'wall', 1, 1]],
  bay: [['firetruck', 'any', 1, 1], ['toolchest', 'wall', 1, 1], ['shelving', 'wall', 1, 2], ['lockers', 'wall', 1, 1]],
  dispatch: [['radiodesk', 'wall', 2, 2], ['maptable', 'center', 1, 1], ['filecab', 'wall', 1, 1]],
  armory: [['gunlocker', 'wall', 2, 3], ['shelving', 'wall', 1, 1], ['workbench', 'wall', 1, 1]],
  clinic: [['exambed', 'wall', 2, 3], ['medcab', 'wall', 1, 2], ['bodybag', 'any', 0, 2]],
  hall: [['bench', 'wall', 1, 2], ['desk', 'wall', 0, 1], ['debris', 'any', 0, 2]],
  diner: [['booth', 'wall', 2, 4], ['counter', 'wall', 1, 1], ['table', 'center', 0, 2]],
  laundry: [['washer', 'wall', 4, 7], ['bench', 'center', 1, 1]],
  nave: [['@pew', 4, 2], ['table', 'wall', 1, 1], ['cot', 'any', 0, 3]],
};
const HOUSE_COLORS = [0xa9a595, 0x8f9a8e, 0x9c8f7c, 0x7f8c95, 0xb0a17e, 0x8a7f74, 0x9aa39a, 0xa58e86, 0x77807a];
const CAR_COLORS = [0x5a626a, 0x6b3a32, 0x39506a, 0x7a7868, 0x2f3336, 0x8c8a82, 0x4a5a44, 0x6d5a3c];
const FABRIC = [0x5b6470, 0x6a4a40, 0x4e5a48, 0x70685a, 0x3f4650];
const GRAFFITI = ['NO SIRENS', 'THEY FOLLOW THE SOUND', 'HALE KNEW', 'QUIET', "DON'T TOUCH THE GREEN", 'DAY 19 STILL HERE', 'FORGIVE HER', 'MARSH LIED', 'WE WAITED FOR THE BUSES', 'GOD HELP BELLWETHER', 'IT IS IN THE SOIL', 'CHANNEL 9 IS DEAD'];

export function generate(seed) {
  for (let attempt = 0; attempt < 10; attempt++) { const L = tryGenerate(seed >>> 0, attempt); if (L) return L; }
  throw new Error('world generation failed for seed ' + seed);
}

function tryGenerate(seed, attempt) {
  const rng = new RNG((Math.imul(seed, 2654435761) ^ Math.imul(attempt + 1, 40503)) >>> 0);
  const W = SIZE, H = SIZE;
  const L = {
    seed, attempt, W, H, edgeV: new Uint8Array((W + 1) * H), edgeH: new Uint8Array(W * (H + 1)), edgeVb: new Int16Array((W + 1) * H).fill(-1), edgeHb: new Int16Array(W * (H + 1)).fill(-1),
    cellB: new Int16Array(W * H), cellRoom: new Int16Array(W * H).fill(-1), surf: new Uint8Array(W * H), blocked: new Uint8Array(W * H), keep: new Uint8Array(W * H), used: new Uint8Array(W * H),
    buildings: [], rooms: [], doors: [], props: [], spots: [], containers: [], plants: [], signs: [], zombies: [], boxes: [], blocks: [], items: [], tapes: [], gates: [],
  };
  const ci = (x, z) => x + z * W;
  const inb = (x, z) => x >= 1 && z >= 1 && x < W - 1 && z < H - 1;
  const setV = (x, z, c, b = -1) => { L.edgeV[x + z * (W + 1)] = c; L.edgeVb[x + z * (W + 1)] = b; };
  const setH = (x, z, c, b = -1) => { L.edgeH[x + z * W] = c; L.edgeHb[x + z * W] = b; };
  const getV = (x, z) => L.edgeV[x + z * (W + 1)], getH = (x, z) => L.edgeH[x + z * W];
  const isRoad = (v) => (v % PITCH) < ROAD;

  // ---------- base surfaces ----------
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    let s = SURF.GRASS;
    if (isRoad(x) || isRoad(z)) s = SURF.ASPHALT;
    else { const lx = (x % PITCH) - ROAD, lz = (z % PITCH) - ROAD; if (lx < 2 || lz < 2 || lx >= BLOCK - 2 || lz >= BLOCK - 2) s = SURF.CONCRETE; }
    L.surf[ci(x, z)] = s;
    if (x < 1 || z < 1 || x >= W - 1 || z >= H - 1) { L.blocked[ci(x, z)] = 1; L.used[ci(x, z)] = 1; }
  }
  const fillSurf = (r, s) => { for (let z = r.z; z < r.z + r.d; z++) for (let x = r.x; x < r.x + r.w; x++) if (inb(x, z) && !L.cellB[ci(x, z)]) L.surf[ci(x, z)] = s; };
  const keepRect = (r) => { for (let z = r.z; z < r.z + r.d; z++) for (let x = r.x; x < r.x + r.w; x++) if (inb(x, z)) L.keep[ci(x, z)] = 1; };

  // ---------- spawn / extraction gates ----------
  const gatePos = (side, j) => { const c = j * PITCH + 6; return side === 0 ? { x: c, z: 5 } : side === 1 ? { x: W - 5, z: c } : side === 2 ? { x: c, z: H - 5 } : { x: 5, z: c }; };
  const sSide = rng.int(0, 3), sJ = rng.int(1, 3);
  const eSide = (sSide + rng.pick([1, 2, 2, 3])) % 4, eJ = rng.int(1, 3);
  const sp = gatePos(sSide, sJ), ex = gatePos(eSide, eJ);
  L.spawn = { x: sp.x, z: sp.z, yaw: [Math.PI, Math.PI / 2, 0, -Math.PI / 2][sSide], side: sSide };
  L.extraction = { x: ex.x, z: ex.z, side: eSide };
  L.gates.push({ side: sSide, c: sJ * PITCH + 6, kind: 'spawn' }, { side: eSide, c: eJ * PITCH + 6, kind: 'exit' });
  keepRect({ x: sp.x - 6, z: sp.z - 6, w: 12, d: 12 }); keepRect({ x: ex.x - 7, z: ex.z - 7, w: 14, d: 14 });

  // ---------- buildings ----------
  function addBuilding(type, rect, orient, opt = {}) {
    const id = L.buildings.length, tpl = T[type];
    const Su = orient & 1 ? rect.d : rect.w, Sv = orient & 1 ? rect.w : rect.d;
    const b = { id, type, name: opt.name || (tpl ? rng.pick(tpl.names) : ''), x: rect.x, z: rect.z, w: rect.w, d: rect.d, orient, h: opt.h || (tpl ? tpl.h : 2.8), mat: opt.mat || (tpl ? tpl.mat : 'wood'), color: opt.color ?? 0x9a958a, roof: opt.roof ?? 0x4a4743, gable: !!opt.gable, rooms: [], win: opt.win ?? (tpl ? tpl.win : 0.35), tint: rng.range(0.42, 0.6) };
    L.buildings.push(b);
    const floor = opt.floor ?? (tpl ? tpl.floor : SURF.WOOD);
    let local = opt.rooms || (tpl ? tpl.rooms.map(r => ({ u: r[0], v: r[1], w: r[2], d: r[3], type: r[4] })) : bsp(Su, Sv, opt.maxRoom || 5, opt.types));
    for (const lr of local) {
      const wr = place(orient, rect.x, rect.z, Su, Sv, lr.u, lr.v, lr.w, lr.d);
      const room = { id: L.rooms.length, b: id, type: lr.type, x: wr.x, z: wr.z, w: wr.w, d: wr.d };
      L.rooms.push(room); b.rooms.push(room.id);
      for (let z = wr.z; z < wr.z + wr.d; z++) for (let x = wr.x; x < wr.x + wr.w; x++) { const c = ci(x, z); L.cellB[c] = id + 1; L.cellRoom[c] = room.id; L.surf[c] = (lr.type === 'garage' || lr.type === 'bay' || lr.type === 'floor') ? SURF.CONCRETE : (lr.type === 'bath' || lr.type === 'kitchen') ? SURF.TILE : floor; L.keep[c] = 0; }
    }
    // perimeter
    for (let x = rect.x; x < rect.x + rect.w; x++) { if (getH(x, rect.z) !== E.DOOR) setH(x, rect.z, E.WALL, id); if (getH(x, rect.z + rect.d) !== E.DOOR) setH(x, rect.z + rect.d, E.WALL, id); }
    for (let z = rect.z; z < rect.z + rect.d; z++) { if (getV(rect.x, z) !== E.DOOR) setV(rect.x, z, E.WALL, id); if (getV(rect.x + rect.w, z) !== E.DOOR) setV(rect.x + rect.w, z, E.WALL, id); }
    // interior walls + doors (spanning tree, hall-type rooms connected first)
    const pairs = new Map();
    const note = (ra, rb, e) => { const k = ra < rb ? ra + '|' + rb : rb + '|' + ra; if (!pairs.has(k)) pairs.set(k, { a: Math.min(ra, rb), b: Math.max(ra, rb), list: [] }); pairs.get(k).list.push(e); };
    for (let z = rect.z; z < rect.z + rect.d; z++) for (let x = rect.x; x < rect.x + rect.w; x++) {
      const r0 = L.cellRoom[ci(x, z)];
      if (x + 1 < rect.x + rect.w) { const r1 = L.cellRoom[ci(x + 1, z)]; if (r1 !== r0) { setV(x + 1, z, E.WALL, id); note(r0, r1, { v: true, x: x + 1, z }); } }
      if (z + 1 < rect.z + rect.d) { const r1 = L.cellRoom[ci(x, z + 1)]; if (r1 !== r0) { setH(x, z + 1, E.WALL, id); note(r0, r1, { v: false, x, z: z + 1 }); } }
    }
    const pl = rng.shuffle([...pairs.values()]);
    const isHall = (rid) => HALLS.has(L.rooms[rid].type);
    pl.sort((p, q) => (isHall(q.a) || isHall(q.b) ? 1 : 0) - (isHall(p.a) || isHall(p.b) ? 1 : 0));
    const par = new Map(); const find = (a) => { while (par.has(a) && par.get(a) !== a) a = par.get(a); return a; };
    for (const p of pl) {
      const fa = find(p.a), fb = find(p.b);
      if (fa === fb && !rng.chance(0.12)) continue;
      par.set(fa, fb); if (!par.has(fb)) par.set(fb, fb);
      const n = p.list.length, e = p.list[n >= 3 ? rng.int(1, n - 2) : rng.int(0, n - 1)];
      addDoor(e.v, e.x, e.z, id, false, L.rooms[p.a].type === 'gym' || L.rooms[p.b].type === 'gym');
    }
    // exterior doors / openings
    const S = SIDE(orient);
    if (tpl) {
      b.frontDoor = extDoor(b, S.front, tpl.front);
      if (tpl.back) extDoor(b, S.back, tpl.back);
      if (tpl.sideDoors) { extDoor(b, S.left, tpl.sideDoors); extDoor(b, S.right, tpl.sideDoors); }
      if (tpl.open) for (const o of tpl.open) extOpening(b, S[o[0]], o[1], o[2]);
    }
    return b;
  }
  function addDoor(v, x, z, b, ext, closed) {
    if (v) setV(x, z, E.DOOR, b); else setH(x, z, E.DOOR, b);
    const d = { v, x, z, b, ext, open: closed ? false : rng.chance(ext ? 0.25 : 0.4) }; L.doors.push(d);
    if (v) { if (inb(x - 1, z)) L.keep[ci(x - 1, z)] = 1; if (inb(x, z)) L.keep[ci(x, z)] = 1; } else { if (inb(x, z - 1)) L.keep[ci(x, z - 1)] = 1; if (inb(x, z)) L.keep[ci(x, z)] = 1; }
    return d;
  }
  // perimeter units of side: {v,x,z, ix,iz (inside cell), ox,oz (outside cell)}
  function sideUnits(b, side) {
    const u = [];
    if (side === 0) for (let x = b.x; x < b.x + b.w; x++) u.push({ v: false, x, z: b.z, ix: x, iz: b.z, ox: x, oz: b.z - 1 });
    else if (side === 2) for (let x = b.x; x < b.x + b.w; x++) u.push({ v: false, x, z: b.z + b.d, ix: x, iz: b.z + b.d - 1, ox: x, oz: b.z + b.d });
    else if (side === 3) for (let z = b.z; z < b.z + b.d; z++) u.push({ v: true, x: b.x, z, ix: b.x, iz: z, ox: b.x - 1, oz: z });
    else for (let z = b.z; z < b.z + b.d; z++) u.push({ v: true, x: b.x + b.w, z, ix: b.x + b.w - 1, iz: z, ox: b.x + b.w, oz: z });
    return u;
  }
  const edgeAt = (u) => u.v ? getV(u.x, u.z) : getH(u.x, u.z);
  function extDoor(b, side, prefer) {
    const us = sideUnits(b, side);
    const ok = (i, anyRoom) => { const u = us[i]; if (i < 1 || i >= us.length - 1 || edgeAt(u) !== E.WALL || L.cellB[ci(u.ox, u.oz)]) return false; const r = L.cellRoom[ci(u.ix, u.iz)]; if (L.cellRoom[ci(us[i - 1].ix, us[i - 1].iz)] !== r || L.cellRoom[ci(us[i + 1].ix, us[i + 1].iz)] !== r) return false; return anyRoom || !prefer || prefer.includes(L.rooms[r].type); };
    let c = us.map((_, i) => i).filter(i => ok(i, false)); if (!c.length) c = us.map((_, i) => i).filter(i => ok(i, true)); if (!c.length) return null;
    const u = us[rng.pick(c)]; const d = addDoor(u.v, u.x, u.z, b.id, true, false);
    d.side = side; d.ox = u.ox; d.oz = u.oz; L.keep[ci(u.ox, u.oz)] = 1;
    const dx = [0, 1, 0, -1][side], dz = [-1, 0, 1, 0][side];
    for (let k = 1; k < 4; k++) { const x = u.ox + dx * k, z = u.oz + dz * k; if (inb(x, z) && !L.cellB[ci(x, z)]) L.keep[ci(x, z)] = 1; }
    return d;
  }
  function extOpening(b, side, width, type) {
    const us = sideUnits(b, side); const starts = [];
    for (let i = 1; i + width < us.length; i++) { let ok = true; for (let k = 0; k < width; k++) { const u = us[i + k]; if (edgeAt(u) !== E.WALL || L.cellB[ci(u.ox, u.oz)] || L.rooms[L.cellRoom[ci(u.ix, u.iz)]].type !== type) { ok = false; break; } } if (ok) starts.push(i); }
    if (!starts.length) return null;
    const s = starts[Math.floor(starts.length / 2)];
    for (let k = 0; k < width; k++) { const u = us[s + k]; if (u.v) setV(u.x, u.z, E.OPEN, b.id); else setH(u.x, u.z, E.OPEN, b.id); L.keep[ci(u.ix, u.iz)] = 1; L.keep[ci(u.ox, u.oz)] = 1; const dx = [0, 1, 0, -1][side], dz = [-1, 0, 1, 0][side]; for (let q = 1; q < 3; q++) if (inb(u.ix - dx * q, u.iz - dz * q)) L.keep[ci(u.ix - dx * q, u.iz - dz * q)] = 1; }
    return us[s];
  }
  function bsp(Su, Sv, maxRoom, types) {
    const leaves = [];
    (function split(u, v, w, d) {
      const canW = w >= 6, canD = d >= 6;
      if ((w <= maxRoom && d <= maxRoom) || (!canW && !canD)) return leaves.push({ u, v, w, d });
      if ((w >= d && canW) || !canD) { const p = rng.int(3, w - 3); split(u, v, p, d); split(u + p, v, w - p, d); }
      else { const p = rng.int(3, d - 3); split(u, v, w, p); split(u, v + p, w, d - p); }
    })(0, 0, Su, Sv);
    leaves.sort((a, b) => b.w * b.d - a.w * a.d);
    const order = types || ['living', 'kitchen', 'bedroom', 'bedroom', 'bedroom'];
    leaves.forEach((l, i) => { l.type = order[Math.min(i, order.length - 1)]; });
    if (!types && leaves.length >= 4) leaves[leaves.length - 1].type = 'bath';
    return leaves;
  }

  // ---------- blocks ----------
  const center = rng.shuffle([[1, 1], [1, 2], [2, 1], [2, 2]]), cTypes = ['civic', 'commercial', 'gas', 'commercial'];
  const edge = []; for (let bz = 0; bz < NB; bz++) for (let bx = 0; bx < NB; bx++) if (!(bx >= 1 && bx <= 2 && bz >= 1 && bz <= 2)) edge.push([bx, bz]);
  rng.shuffle(edge); const eTypes = ['school', 'warehouse', 'park'];
  const blockType = new Map(); center.forEach((c, i) => blockType.set(c + '', cTypes[i])); edge.forEach((c, i) => blockType.set(c + '', eTypes[i] || 'residential'));
  const lotOrient = (i, j) => rng.pick([i === 0 ? 3 : 1, j === 0 ? 0 : 2]);
  const blockOrient = (bx, bz) => { // face the street towards the town centre
    const o = []; if (bx < 2) o.push(1); else o.push(3); if (bz < 2) o.push(2); else o.push(0); return rng.pick(o);
  };
  function outProp(kind, x, z, rot, tint, opt = {}) {
    const inst = { kind, x, z, rot: rot & 3, tint, b: -1, room: -1 }; const [fw, fd] = propFootprint(inst);
    for (let cz = z; cz < z + fd; cz++) for (let cx = x; cx < x + fw; cx++) { if (!inb(cx, cz)) return null; const c = ci(cx, cz); if (L.used[c] || L.cellB[c] || (L.keep[c] && !opt.force)) return null; }
    if (!slotsOk(inst)) return null;
    commitProp(inst, opt.ctx || 'street'); return inst;
  }
  function slotsOk(inst) {
    const P = PROPS[inst.kind]; if (!P.container) return true; const [fw, fd] = propFootprint(inst);
    for (const s of P.container.slots) { const p = propPoint(inst, s); const cx = Math.floor(p.x), cz = Math.floor(p.z); if (cx >= inst.x && cx < inst.x + fw && cz >= inst.z && cz < inst.z + fd) continue; if (!inb(cx, cz)) return false; const c = ci(cx, cz); if (L.used[c] || (inst.room >= 0 ? L.cellRoom[c] !== inst.room : L.cellB[c])) return false; }
    return true;
  }
  function commitProp(inst, ctx) {
    const P = PROPS[inst.kind]; const [fw, fd] = propFootprint(inst); inst.idx = L.props.length; L.props.push(inst);
    for (let cz = inst.z; cz < inst.z + fd; cz++) for (let cx = inst.x; cx < inst.x + fw; cx++) { const c = ci(cx, cz); L.used[c] = 1; if (!P.noBlock) L.blocked[c] = 1; }
    if (P.spots) for (const s of P.spots) { const p = propPoint(inst, s); L.spots.push({ x: p.x, y: p.y, z: p.z, ctx, b: inst.b, room: inst.room, prop: inst.idx, kind: inst.kind }); }
    if (P.container) { const slots = P.container.slots.map(s => propPoint(inst, s)); for (const p of slots) { const c = ci(Math.floor(p.x), Math.floor(p.z)); L.used[c] = 1; L.keep[c] = 1; } L.containers.push({ prop: inst.idx, slots, ctx, kind: inst.kind, b: inst.b }); }
  }
  const lprop = (o, X0, Z0, S, kind, u, v, lrot, tint, opt) => { const P = PROPS[kind]; const fp = lrot & 1 ? [P.fp[1], P.fp[0]] : P.fp; const r = place(o, X0, Z0, S, S, u, v, fp[0], fp[1]); return outProp(kind, r.x, r.z, lrot + o, tint, opt); };

  for (let bz = 0; bz < NB; bz++) for (let bx = 0; bx < NB; bx++) {
    const type = blockType.get([bx, bz] + ''), X0 = ROAD + bx * PITCH, Z0 = ROAD + bz * PITCH;
    const blk = { bx, bz, type, x: X0, z: Z0, label: '' }; L.blocks.push(blk);
    if (type === 'residential' || type === 'commercial' || type === 'gas' || type === 'civic') {
      let kinds;
      if (type === 'residential') { kinds = ['house', 'house', 'house', 'house']; if (rng.chance(0.35)) kinds[rng.int(0, 3)] = 'empty'; blk.label = 'Homes'; }
      else if (type === 'commercial') { kinds = rng.shuffle(['store', 'diner', 'pharmacy', 'hardware', 'laundry', 'office']).slice(0, 4); blk.label = 'Main St. shops'; }
      else if (type === 'gas') { kinds = rng.shuffle(['gas', rng.pick(['store', 'diner']), rng.pick(['hardware', 'laundry', 'pharmacy']), 'office']); blk.label = 'Gas station'; }
      else { kinds = rng.shuffle(['eoc', 'clinic', 'hall', 'townoffice']); blk.label = 'Civic center'; }
      let k = 0;
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) buildLot(kinds[k++], X0 + i * 28, Z0 + j * 28, lotOrient(i, j));
      if (type === 'residential') { // back-yard fences on the lot lines, with gaps
        for (let s = 0; s < 4; s++) { const g1 = rng.int(4, 12), g2 = rng.int(15, 23); for (let t = 3; t < 26; t++) { if (t === g1 || t === g1 + 1 || t === g2 || t === g2 + 1) continue; if (s === 0) setV(X0 + 28, Z0 + t, E.FENCE); else if (s === 1) setV(X0 + 28, Z0 + 28 + t - 1, E.FENCE); else if (s === 2) setH(X0 + t, Z0 + 28, E.FENCE); else setH(X0 + 28 + t - 1, Z0 + 28, E.FENCE); } }
      }
    } else if (type === 'school') {
      const o = blockOrient(bx, bz); blk.label = 'Elementary school';
      const b = addBuilding('school', place(o, X0, Z0, 56, 56, 8, 10, 40, 28), o, { color: 0x8a6a58 });
      fillSurf(place(o, X0, Z0, 56, 56, 2, 2, 52, 8), SURF.CONCRETE);
      fillSurf(place(o, X0, Z0, 56, 56, 6, 40, 24, 13), SURF.DIRT);
      lprop(o, X0, Z0, 56, 'flagpole', 12, 5, 0); lprop(o, X0, Z0, 56, 'swing', 9, 43, 0); lprop(o, X0, Z0, 56, 'swing', 16, 47, 0); lprop(o, X0, Z0, 56, 'slide', 23, 42, 0); lprop(o, X0, Z0, 56, 'sandbox', 10, 49, 0);
      lprop(o, X0, Z0, 56, 'bus', 36, 41, 1, undefined); lprop(o, X0, Z0, 56, 'bench', 20, 51, 2); lprop(o, X0, Z0, 56, 'tent', 44, 46, 0, undefined, { ctx: 'medical' });
      sign(b, b.frontDoor, 'BELLWETHER ELEMENTARY', 'sign'); L.school = b.id;
    } else if (type === 'warehouse') {
      const o = blockOrient(bx, bz); blk.label = 'Hale distribution yard';
      fillSurf({ x: X0 + 2, z: Z0 + 2, w: 52, d: 52 }, SURF.ASPHALT);
      const b = addBuilding('warehouse', place(o, X0, Z0, 56, 56, 6, 12, 36, 26), o, { color: 0x77807c, roof: 0x5a5e5c });
      for (let t = 2; t < 54; t++) { const gap = (t >= 24 && t < 30); if (!gap) { setH(X0 + t, Z0 + 2, E.CHAIN); setH(X0 + t, Z0 + 54, E.CHAIN); setV(X0 + 2, Z0 + t, E.CHAIN); setV(X0 + 54, Z0 + t, E.CHAIN); } }
      lprop(o, X0, Z0, 56, 'watertower', 46, 44, 0); L.landmark = L.landmark || {};
      for (const [u, v, r] of [[45, 12, 0], [49, 12, 0], [45, 22, 0], [8, 42, 1], [18, 42, 1]]) if (rng.chance(0.8)) lprop(o, X0, Z0, 56, 'container', u, v, r, rng.pick([0x7a4a2e, 0x3d5a6a, 0x5a6b4a, 0x6a6258]));
      for (let n = 0; n < 8; n++) lprop(o, X0, Z0, 56, rng.pick(['pallet', 'barrel', 'crate', 'cratestack']), rng.int(5, 50), rng.int(40, 51), rng.int(0, 3), undefined, { ctx: 'warehouse' });
      lprop(o, X0, Z0, 56, 'pickup', 30, 4, 1, rng.pick(CAR_COLORS)); lprop(o, X0, Z0, 56, 'van', 12, 5, 1, 0xb5b3aa);
      sign(b, b.frontDoor, 'HALE AGRONOMICS', 'sign');
    } else { // park
      blk.label = 'Founders Park';
      fillSurf({ x: X0 + 2, z: Z0 + 27, w: 52, d: 2 }, SURF.DIRT); fillSurf({ x: X0 + 27, z: Z0 + 2, w: 2, d: 52 }, SURF.DIRT);
      keepRect({ x: X0 + 2, z: Z0 + 27, w: 52, d: 2 }); keepRect({ x: X0 + 27, z: Z0 + 2, w: 2, d: 52 });
      outProp('gazebo', X0 + 31, Z0 + 31, 0, undefined, { ctx: 'park' });
      fillSurf({ x: X0 + 6, z: Z0 + 6, w: 18, d: 16 }, SURF.DIRT);
      outProp('swing', X0 + 8, Z0 + 8, 0); outProp('slide', X0 + 15, Z0 + 8, 0); outProp('sandbox', X0 + 18, Z0 + 15, 0); outProp('swing', X0 + 8, Z0 + 16, 0);
      for (let n = 0; n < 3; n++) outProp('tent', X0 + 33 + n * 6, Z0 + 8, 2, undefined, { ctx: 'medical' });
      for (let n = 0; n < 6; n++) outProp(rng.pick(['bodybag', 'bodybag', 'crate', 'barrier']), X0 + rng.int(31, 50), Z0 + rng.int(16, 22), rng.int(0, 3), undefined, { ctx: 'medical' });
      for (let n = 0; n < 8; n++) outProp('bench', X0 + rng.pick([25, 29]) , Z0 + rng.int(4, 50), rng.pick([1, 3]), undefined, { ctx: 'park' });
      L.signs.push({ text: 'GREENER BELLWETHER INITIATIVE\nA gift from Hale Agronomics', x: X0 + 28, y: 1.6, z: Z0 + 3.2, side: 0, w: 3.6, h: 1.4, style: 'board' });
      L.signs.push({ text: 'TRIAGE — WAIT TO BE CALLED', x: X0 + 40, y: 1.3, z: Z0 + 15.5, side: 2, w: 3, h: 0.7, style: 'board' });
      L.park = { x: X0, z: Z0 };
    }
  }

  function buildLot(kind, LX, LZ, o) {
    const lp = (u, v, w, d) => place(o, LX, LZ, 28, 28, u, v, w, d);
    if (kind === 'empty') { for (let n = 0; n < 5; n++) lprop(o, LX, LZ, 28, rng.pick(['rubble', 'debris', 'wreck', 'crate']), rng.int(4, 20), rng.int(5, 20), rng.int(0, 3)); return; }
    if (kind === 'house') {
      const w = rng.int(9, 12), d = rng.int(7, 9), v0 = rng.int(6, 8), gLeft = rng.chance(0.5);
      const u0 = 3 + rng.int(0, 22 - (w + 4));
      const hu = gLeft ? u0 + 4 : u0, gu = gLeft ? u0 : u0 + w;
      const color = rng.pick(HOUSE_COLORS), roof = rng.pick([0x4a4541, 0x57483c, 0x3d4244, 0x5a5650]);
      const h = addBuilding('house', lp(hu, v0, w, d), o, { color, roof, gable: true, win: 0.4, name: '' });
      const S = SIDE(o); h.frontDoor = extDoor(h, S.front, ['living']); extDoor(h, S.back, null);
      const g = addBuilding('garage', lp(gu, v0, 4, 6), o, { color, roof, rooms: [{ u: 0, v: 0, w: 4, d: 6, type: 'garage' }], h: 2.8, win: 0.1, name: '' });
      // connecting door on the shared wall
      const us = sideUnits(g, gLeft ? S.right : S.left).filter(u => L.cellB[ci(u.ox, u.oz)] === h.id + 1);
      if (us.length > 2) { const u = us[rng.int(1, us.length - 2)]; addDoor(u.v, u.x, u.z, g.id, false, false); }
      if (rng.chance(0.55)) extOpening(g, S.front, 3, 'garage'); else if (us.length <= 2) extDoor(g, S.front, null);
      fillSurf(lp(gu, 0, 4, v0), SURF.CONCRETE); keepRect(lp(gu, 0, 4, v0));
      if (h.frontDoor) { const fd = h.frontDoor; const dx = [0, 1, 0, -1][S.front], dz = [-1, 0, 1, 0][S.front]; for (let k = 0; k < v0; k++) { const x = fd.ox + dx * k, z = fd.oz + dz * k; if (inb(x, z) && !L.cellB[ci(x, z)]) { L.surf[ci(x, z)] = SURF.CONCRETE; L.keep[ci(x, z)] = 1; } } }
      if (rng.chance(0.5)) lprop(o, LX, LZ, 28, 'mailbox', gLeft ? gu + 5 : gu - 2, 2, 0);
      if (rng.chance(0.4)) lprop(o, LX, LZ, 28, rng.pick(['car', 'pickup', 'van']), gu + 1, 1, 0, rng.pick(CAR_COLORS), { force: true });
      if (rng.chance(0.3)) lprop(o, LX, LZ, 28, rng.pick(['bench', 'crate', 'barrel', 'trashcan']), rng.int(4, 22), rng.int(19, 24), rng.int(0, 3));
      return;
    }
    if (kind === 'gas') {
      fillSurf(lp(0, 0, 28, 28), SURF.ASPHALT);
      const b = addBuilding('kiosk', lp(9, 17, 10, 6), o, { color: 0xb3ae9f });
      for (const [u, v] of [[8, 6], [19, 6], [8, 12], [19, 12]]) lprop(o, LX, LZ, 28, 'pillar', u, v, 0);
      for (const [u, v] of [[11, 7], [16, 7], [11, 11], [16, 11]]) lprop(o, LX, LZ, 28, 'pump', u, v, 0);
      const c = lp(7, 5, 14, 9); L.boxes.push({ x0: c.x, y0: 4.4, z0: c.z, x1: c.x + c.w, y1: 4.9, z1: c.z + c.d, mat: 'metal', color: 0xb9b5a8 }, { x0: c.x - 0.1, y0: 4.3, z0: c.z - 0.1, x1: c.x + c.w + 0.1, y1: 4.75, z1: c.z + c.d + 0.1, mat: 'metal', color: 0xa63f2b, vis: true });
      lprop(o, LX, LZ, 28, 'gassign', 3, 3, 0); lprop(o, LX, LZ, 28, rng.pick(['car', 'pickup']), 13, 7, 0, rng.pick(CAR_COLORS)); lprop(o, LX, LZ, 28, 'dumpster', 21, 18, 3);
      sign(b, b.frontDoor, b.name, 'sign'); L.gas = { x: c.x + c.w / 2, z: c.z + c.d / 2 };
      return;
    }
    if (rng.chance(0.6) || kind === 'eoc') fillSurf(lp(0, 0, 28, 28), SURF.ASPHALT);
    let b;
    if (kind === 'office' || kind === 'townoffice') {
      const w = rng.int(12, 15), d = rng.int(9, 12);
      b = addBuilding(kind, lp(3 + rng.int(0, 22 - w), rng.int(4, 9), w, d), o, { mat: 'brick', color: kind === 'townoffice' ? 0x8f8676 : 0x7d6a5c, h: 3.2, maxRoom: 6, types: ['hall', 'office', 'office', 'office', 'storeroom'], floor: SURF.TILE, win: 0.55, name: kind === 'townoffice' ? 'BELLWETHER TOWN OFFICES' : rng.pick(['LARKSPUR INSURANCE', 'COUNTY CREDIT UNION', 'HOLLIS & PRICE LAW']) });
      const S = SIDE(o); b.frontDoor = extDoor(b, S.front, ['hall']); extDoor(b, S.back, null);
    } else {
      const t = T[kind];
      b = addBuilding(kind, lp(3 + rng.int(0, 22 - t.w), kind === 'hall' ? 5 : rng.int(4, 23 - t.d), t.w, t.d), o, { color: { store: 0x8d7b6a, diner: 0x9a8f7e, pharmacy: 0x9aa09a, hardware: 0x7c5f4c, laundry: 0x8b9396, eoc: 0x8a8a84, clinic: 0xb5b3a8, hall: 0xb9b6aa }[kind] });
      if (kind === 'eoc') { L.eoc = b.id; lprop(o, LX, LZ, 28, 'mast', 1, 24, 0); lprop(o, LX, LZ, 28, 'policecar', 24, 3, 0); }
      if (kind === 'hall') b.steeple = true;
    }
    sign(b, b.frontDoor, b.name, 'sign');
    if (rng.chance(0.7)) lprop(o, LX, LZ, 28, 'dumpster', rng.int(3, 22), 25, 2);
    for (let n = 0; n < 2; n++) if (rng.chance(0.5)) lprop(o, LX, LZ, 28, rng.pick(['car', 'pickup', 'van', 'wreck']), rng.int(3, 23), 2, 0, rng.pick(CAR_COLORS));
  }
  function sign(b, door, text, style) {
    if (!door || !text) return; const s = door.side, cx = door.v ? door.x : door.x + 0.5, cz = door.v ? door.z + 0.5 : door.z;
    const off = 0.14; L.signs.push({ text, x: cx + [0, off, 0, -off][s], y: Math.min(b.h - 0.45, 2.75), z: cz + [-off, 0, off, 0][s], side: s, w: Math.min(7, 0.34 * text.length + 0.6), h: 0.62, style });
  }

  // ---------- windows ----------
  for (const b of L.buildings) for (let side = 0; side < 4; side++) {
    const us = sideUnits(b, side);
    for (let i = 1; i < us.length - 1; i++) {
      const u = us[i]; if (edgeAt(u) !== E.WALL || !inb(u.ox, u.oz) || L.cellB[ci(u.ox, u.oz)]) continue;
      const r = L.cellRoom[ci(u.ix, u.iz)]; if (L.cellRoom[ci(us[i - 1].ix, us[i - 1].iz)] !== r || L.cellRoom[ci(us[i + 1].ix, us[i + 1].iz)] !== r) continue;
      const t = L.rooms[r].type; if (t === 'bath' || t === 'armory' || t === 'gym' && rng.chance(0.7)) continue;
      if (edgeAt(us[i - 1]) === E.DOOR || edgeAt(us[i + 1]) === E.DOOR) continue;
      if (rng.chance(b.win)) { if (u.v) setV(u.x, u.z, E.WIN, b.id); else setH(u.x, u.z, E.WIN, b.id); }
    }
  }

  // ---------- furniture ----------
  const roomFree = (room, x, z, fw, fd) => { for (let cz = z; cz < z + fd; cz++) for (let cx = x; cx < x + fw; cx++) { const c = ci(cx, cz); if (L.cellRoom[c] !== room.id || L.used[c] || L.keep[c]) return false; } return true; };
  function roomConnected(room) {
    let total = 0, start = -1; for (let z = room.z; z < room.z + room.d; z++) for (let x = room.x; x < room.x + room.w; x++) if (!L.blocked[ci(x, z)]) { total++; if (start < 0) start = ci(x, z); }
    if (start < 0) return false; const seen = new Set([start]), q = [start];
    while (q.length) { const c = q.pop(), x = c % W, z = (c / W) | 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (nx < room.x || nz < room.z || nx >= room.x + room.w || nz >= room.z + room.d) continue; const n = ci(nx, nz); if (L.blocked[n] || seen.has(n)) continue; seen.add(n); q.push(n); } }
    return seen.size === total;
  }
  function tryFurn(room, kind, rule, fixed) {
    const P = PROPS[kind];
    for (let a = 0; a < (fixed ? 1 : 16); a++) {
      const rot = fixed ? fixed.rot : rng.int(0, 3); const [fw, fd] = rot & 1 ? [P.fp[1], P.fp[0]] : P.fp;
      if (fw > room.w || fd > room.d) continue; let x, z;
      if (fixed) { x = fixed.x; z = fixed.z; }
      else if (rule === 'wall') { if (rot === 0) { z = room.z; x = rng.int(room.x, room.x + room.w - fw); } else if (rot === 2) { z = room.z + room.d - fd; x = rng.int(room.x, room.x + room.w - fw); } else if (rot === 1) { x = room.x + room.w - fw; z = rng.int(room.z, room.z + room.d - fd); } else { x = room.x; z = rng.int(room.z, room.z + room.d - fd); } }
      else if (rule === 'center') { if (room.w - fw < 2 || room.d - fd < 2) continue; x = rng.int(room.x + 1, room.x + room.w - fw - 1); z = rng.int(room.z + 1, room.z + room.d - fd - 1); }
      else { x = rng.int(room.x, room.x + room.w - fw); z = rng.int(room.z, room.z + room.d - fd); }
      if (!roomFree(room, x, z, fw, fd)) continue;
      const tint = kind === 'couch' || kind === 'armchair' ? rng.pick(FABRIC) : kind === 'car' ? rng.pick(CAR_COLORS) : kind === 'bed' ? rng.pick([0x9a978c, 0x77808a, 0x8a7a70]) : kind === 'barrel' ? rng.pick([0x34506b, 0x6a3a2c, 0x4a5140]) : undefined;
      const inst = { kind, x, z, rot, tint, b: room.b, room: room.id };
      if (!slotsOk(inst)) continue;
      if (!P.noBlock) { for (let cz = z; cz < z + fd; cz++) for (let cx = x; cx < x + fw; cx++) L.blocked[ci(cx, cz)] = 1; const ok = roomConnected(room); for (let cz = z; cz < z + fd; cz++) for (let cx = x; cx < x + fw; cx++) L.blocked[ci(cx, cz)] = 0; if (!ok) continue; }
      commitProp(inst, room.type); return inst;
    }
    return null;
  }
  for (const room of L.rooms) {
    const rec = FURN[room.type]; if (!rec) continue;
    for (const r of rec) {
      if (r[0][0] === '@') { // rows with aisles
        const kind = r[0].slice(1), P = PROPS[kind], along = room.w >= room.d, rot = along ? 0 : 1; const [fw, fd] = rot & 1 ? [P.fp[1], P.fp[0]] : P.fp;
        const m = r[1] >= 3 ? 2 : 1;
        for (let z = room.z + m; z + fd <= room.z + room.d - m; z += fd + (along ? r[2] : 1) - (along ? 0 : 0)) for (let x = room.x + m; x + fw <= room.x + room.w - m; x += fw + (along ? 1 : r[2])) if (rng.chance(0.85)) tryFurn(room, kind, 'any', { x, z, rot: rot + (rng.chance(0.5) ? 2 : 0) });
      } else { const n = rng.int(r[2], r[3]); for (let i = 0; i < n; i++) tryFurn(room, r[0], r[1]); }
    }
  }

  // ---------- streets ----------
  const cpI = rng.int(1, 3), cpJ = rng.int(1, 3), cpx = cpI * PITCH, cpz = cpJ * PITCH; // military checkpoint at an interior intersection
  L.checkpoint = { x: cpx + 6, z: cpz + 6 };
  if (Math.hypot(cpx + 6 - sp.x, cpz + 6 - sp.z) > 30) {
    outProp('miltruck', cpx + 1, cpz - 9, 0, undefined, { ctx: 'military' }); outProp('tent', cpx + 13, cpz + 1, 3, undefined, { ctx: 'military' });
    for (const [dx, dz, r] of [[0, -2, 0], [4, -2, 0], [9, 13, 0], [5, 13, 0], [-2, 2, 1], [-2, 7, 1], [13, 8, 1]]) outProp(rng.pick(['barrier', 'sandbags']), cpx + dx, cpz + dz, r, undefined);
    outProp('crate', cpx + 8, cpz - 3, 0, undefined, { ctx: 'military' }); outProp('crate', cpx + 2, cpz + 14, 0, undefined, { ctx: 'military' });
    L.signs.push({ text: 'CHECKPOINT 4 — LETHAL FORCE AUTHORIZED', x: cpx + 3, y: 0.95, z: cpz - 1.2, side: 0, w: 3.6, h: 0.5, style: 'board' });
  }
  const VEH = [['car', 5], ['pickup', 2], ['van', 1.5], ['wreck', 1.5], ['policecar', 0.5]];
  for (let n = 0; n < 85; n++) {
    const vert = rng.chance(0.5), i = rng.int(0, NB), along = rng.int(3, SIZE - 9), kind = rng.weighted(VEH);
    if (isRoad(along) || isRoad(along + 5)) { if (!rng.chance(0.15)) continue; }
    const lat = i * PITCH + (rng.chance(0.75) ? rng.pick([1, ROAD - 3]) : rng.int(3, ROAD - 5));
    if (vert) outProp(kind, lat, along, rng.pick([0, 2]), rng.pick(CAR_COLORS)); else outProp(kind, along, lat, rng.pick([1, 3]), rng.pick(CAR_COLORS));
  }
  for (let n = 0; n < 3; n++) { const vert = rng.chance(0.5), i = rng.int(1, NB - 1), along = rng.int(20, SIZE - 30); if (vert) outProp('bus', i * PITCH + 2, along, 0); else outProp('bus', along, i * PITCH + 2, 1); }
  for (let bz = 0; bz < NB; bz++) for (let bx = 0; bx < NB; bx++) {
    const X0 = ROAD + bx * PITCH, Z0 = ROAD + bz * PITCH;
    for (let t = 6; t < BLOCK; t += 14) { outProp(rng.chance(0.75) ? 'streetlight' : 'powerpole', X0 + t, Z0, 0); outProp('streetlight', X0 + t + 5, Z0 + BLOCK - 1, 2); outProp(rng.chance(0.7) ? 'streetlight' : 'powerpole', X0, Z0 + t + 3, 3); outProp('streetlight', X0 + BLOCK - 1, Z0 + t + 8, 1); }
    for (let n = 0; n < 5; n++) { const t = rng.int(3, BLOCK - 4), s = rng.int(0, 3); const x = s === 3 ? X0 + 1 : s === 1 ? X0 + BLOCK - 2 : X0 + t, z = s === 0 ? Z0 + 1 : s === 2 ? Z0 + BLOCK - 2 : Z0 + t; outProp(rng.pick(['hydrant', 'trashcan', 'trashcan', 'bench', 'debris']), x, z, s); }
  }
  for (let n = 0; n < 40; n++) { const x = rng.int(3, W - 4), z = rng.int(3, H - 4); if (L.surf[ci(x, z)] === SURF.ASPHALT && (isRoad(x) || isRoad(z))) outProp(rng.pick(['debris', 'barrel', 'rubble', 'barrier']), x, z, rng.int(0, 3)); }

  // ---------- vegetation ----------
  const tree = (x, z, s) => { const c = ci(x, z); if (!inb(x, z) || L.used[c] || L.keep[c] || L.cellB[c] || L.surf[c] !== SURF.GRASS) return false; for (const p of L.plants) if (p.kind === 'tree' && Math.abs(p.x - x - 0.5) < 3 && Math.abs(p.z - z - 0.5) < 3) return false; L.used[c] = 1; L.blocked[c] = 1; L.plants.push({ kind: 'tree', x: x + 0.5, z: z + 0.5, s, v: rng.int(0, 2), r: rng.range(0, 6.28) }); return true; };
  for (let n = 0; n < 520; n++) tree(rng.int(13, W - 14), rng.int(13, H - 14), rng.range(0.8, 1.5));
  if (L.park) for (let n = 0; n < 90; n++) tree(L.park.x + rng.int(3, 52), L.park.z + rng.int(3, 52), rng.range(1.0, 1.7));
  for (let n = 0; n < 1500; n++) { const x = rng.range(2, W - 2), z = rng.range(2, H - 2), c = ci(x | 0, z | 0); if (L.cellB[c] || L.blocked[c]) continue; const s = L.surf[c]; if (s === SURF.GRASS || (s !== SURF.DIRT && rng.chance(0.18))) L.plants.push({ kind: 'bush', x, z, s: rng.range(0.5, 1.4), v: rng.int(0, 2), r: rng.range(0, 6.28) }); }
  // graffiti on exterior walls
  for (let n = 0; n < 26; n++) { const b = rng.pick(L.buildings), side = rng.int(0, 3), us = sideUnits(b, side); if (us.length < 7) continue; const i = rng.int(2, us.length - 4); let ok = true; for (let k = -1; k <= 2; k++) if (edgeAt(us[i + k]) !== E.WALL || L.cellB[ci(us[i + k].ox, us[i + k].oz)]) ok = false; if (!ok) continue; const u = us[i]; const off = 0.13; const text = b.type === 'school' && rng.chance(0.6) ? rng.pick(['GYM SEALED — 214 SOULS', 'SHELTER FULL', 'DO NOT OPEN THE GYM']) : rng.pick(GRAFFITI);
    L.signs.push({ text, x: (u.v ? u.x : u.x + 1) + [0, off, 0, -off][side], y: rng.range(1.2, 1.7), z: (u.v ? u.z + 1 : u.z) + [-off, 0, off, 0][side], side, w: Math.min(3.6, 0.3 * text.length + 0.4), h: 0.7, style: 'graffiti' }); }

  // ---------- reachability ----------
  const reach = new Uint8Array(W * H); L.reach = reach;
  { const s = ci(Math.floor(sp.x), Math.floor(sp.z)); if (L.blocked[s]) return null; reach[s] = 1; const q = [s];
    while (q.length) { const c = q.pop(), x = c % W, z = (c / W) | 0;
      if (x + 1 < W && !reach[c + 1] && !L.blocked[c + 1] && PASS(getV(x + 1, z))) { reach[c + 1] = 1; q.push(c + 1); }
      if (x > 0 && !reach[c - 1] && !L.blocked[c - 1] && PASS(getV(x, z))) { reach[c - 1] = 1; q.push(c - 1); }
      if (z + 1 < H && !reach[c + W] && !L.blocked[c + W] && PASS(getH(x, z + 1))) { reach[c + W] = 1; q.push(c + W); }
      if (z > 0 && !reach[c - W] && !L.blocked[c - W] && PASS(getH(x, z))) { reach[c - W] = 1; q.push(c - W); } } }
  if (!reach[ci(Math.floor(ex.x), Math.floor(ex.z))]) return null;
  const propReach = (inst) => { if (inst.reach !== undefined) return inst.reach; const [fw, fd] = propFootprint(inst); let r = false; for (let z = inst.z - 1; z <= inst.z + fd && !r; z++) for (let x = inst.x - 1; x <= inst.x + fw; x++) { if (!inb(x, z)) continue; const onX = x >= inst.x && x < inst.x + fw, onZ = z >= inst.z && z < inst.z + fd; if (onX === onZ && !PROPS[inst.kind].noBlock) continue; const c = ci(x, z); if (reach[c] && (inst.room < 0 || L.cellRoom[c] === inst.room)) { r = true; break; } } return (inst.reach = r); };
  L.spots = L.spots.filter(s => propReach(L.props[s.prop]));
  L.containers = L.containers.filter(c => propReach(L.props[c.prop]) && c.slots.every(p => { const cc = ci(Math.floor(p.x), Math.floor(p.z)); return reach[cc] || L.blocked[cc]; }));

  // ---------- tapes: one per building, spread across the map ----------
  const TAPE_OK = new Set(['table', 'desk', 'counter', 'radiodesk', 'nightstand', 'workbench', 'coffeetable', 'shopcounter', 'maptable', 'exambed', 'pew', 'booth', 'tvstand']);
  const cand = rng.shuffle(L.spots.filter(s => s.b >= 0 && TAPE_OK.has(s.kind) && Math.hypot(s.x - sp.x, s.z - sp.z) > 28));
  const chosen = [];
  for (const minD of [62, 48, 36, 24, 12, 0]) { for (const s of cand) { if (chosen.length >= 10) break; if (chosen.includes(s) || chosen.some(c => c.b === s.b || Math.hypot(c.x - s.x, c.z - s.z) < minD)) continue; chosen.push(s); } if (chosen.length >= 10) break; }
  if (chosen.length < 10) return null;
  L.tapes = chosen.map((s, i) => ({ id: i, x: s.x, y: s.y, z: s.z, b: s.b, room: s.room }));
  L.spots = L.spots.filter(s => !chosen.includes(s));

  // extraction beacon
  { const lat = [[4, 0], [0, 4], [4, 0], [0, 4]][eSide]; const bp = outProp('beacon', Math.floor(ex.x) + lat[0], Math.floor(ex.z) + lat[1], 0, undefined, { force: true }); L.extraction.beacon = bp ? { x: bp.x + 0.5, z: bp.z + 0.5 } : { x: ex.x, z: ex.z }; }

  // ---------- loot ----------
  assignLoot(L, rng.fork());

  // ---------- infected ----------
  const far = (x, z, d) => Math.hypot(x - sp.x, z - sp.z) > d;
  const zt = (bias) => rng.weighted([['standard', 55], ['runner', 13], ['crawler', 12], ['bloater', 9], ['armored', bias === 'armored' ? 45 : 8]]);
  const freeCell = (x, z) => inb(x, z) && reach[ci(x, z)] && !L.blocked[ci(x, z)];
  const INDOOR = { living: 0.22, kitchen: 0.14, bedroom: 0.2, garage: 0.14, sales: 0.75, storeroom: 0.25, office: 0.3, classroom: 0.75, corridor: 2.2, gym: 5, nurse: 0.4, floor: 3, bay: 0.8, dispatch: 0.5, armory: 0.5, clinic: 1.2, hall: 0.5, diner: 0.9, laundry: 0.5, nave: 2.2, bath: 0.06 };
  for (const room of L.rooms) {
    let n = INDOOR[room.type] || 0; if (n < 3) n *= 0.28; n = Math.floor(n) + (rng.chance(n % 1) ? 1 : 0);
    for (let i = 0; i < n; i++) for (let a = 0; a < 8; a++) { const x = rng.int(room.x, room.x + room.w - 1), z = rng.int(room.z, room.z + room.d - 1); if (!freeCell(x, z) || !far(x, z, 38)) continue; L.zombies.push({ x: x + 0.5, z: z + 0.5, type: zt(L.buildings[room.b].type === 'eoc' ? 'armored' : ''), room: room.id }); break; }
  }
  const packs = rng.int(4, 6);
  for (let p = 0; p < packs; p++) for (let a = 0; a < 30; a++) {
    const x = rng.int(4, W - 5), z = rng.int(4, H - 5); if (!freeCell(x, z) || L.cellB[ci(x, z)] || !far(x, z, 55)) continue;
    const n = rng.int(2, 3), bias = Math.hypot(x - L.checkpoint.x, z - L.checkpoint.z) < 25 ? 'armored' : '';
    for (let i = 0; i < n; i++) { const xx = x + rng.int(-3, 3), zz = z + rng.int(-3, 3); if (freeCell(xx, zz) && !L.cellB[ci(xx, zz)]) L.zombies.push({ x: xx + 0.5, z: zz + 0.5, type: zt(bias), room: -1 }); }
    break;
  }
  for (let n = 0; n < 6; n++) for (let a = 0; a < 20; a++) { const x = rng.int(4, W - 5), z = rng.int(4, H - 5); if (!freeCell(x, z) || L.cellB[ci(x, z)] || !far(x, z, 42)) continue; L.zombies.push({ x: x + 0.5, z: z + 0.5, type: zt(''), room: -1 }); break; }

  L.startHour = rng.range(7.5, 15.5);
  return L;
}

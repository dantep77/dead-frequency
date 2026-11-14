// Contextual loot assignment (pure). Loot is random, but the room/context decides what is plausible.
import { WEAPONS, MAGS, SIDEARMS, PRIMARIES } from './data/weapons.js';
import { NOTES } from './data/story.js';

const CTX = {
  living: { p: 0.2, w: { ammo: 2, bandage: 2, note: 1.5, mag: 0.5, att: 0.3 } },
  kitchen: { p: 0.22, w: { bandage: 3, medkit: 0.6, ammo: 1, note: 0.5 } },
  bedroom: { p: 0.28, w: { sidearm: 1.1, ammo: 3, mag: 1.5, bandage: 1, note: 1, att: 0.5 } },
  bath: { p: 0.5, w: { bandage: 4, medkit: 1.3 } },
  garage: { p: 0.3, w: { ammo: 4, primary: 0.8, att: 1.5, mag: 1, bandage: 0.5 } },
  sales: { p: 0.16, w: { bandage: 3, medkit: 0.7, att: 1, ammo: 1.5, sidearm: 0.35 } },
  storeroom: { p: 0.25, w: { ammo: 2, bandage: 2, medkit: 0.8, att: 1, primary: 0.35 } },
  office: { p: 0.22, w: { note: 2.5, sidearm: 0.8, ammo: 1.5, mag: 1, bandage: 1 } },
  classroom: { p: 0.06, w: { note: 2, bandage: 2, ammo: 0.5 } },
  corridor: { p: 0.25, w: { bandage: 2, ammo: 1, note: 1, mag: 0.5 } },
  gym: { p: 0.18, w: { bandage: 3, medkit: 1, note: 2, ammo: 1 } },
  nurse: { p: 0.55, w: { bandage: 4, medkit: 2.6 } },
  clinic: { p: 0.5, w: { bandage: 4, medkit: 2.6, note: 0.5 } },
  medical: { p: 0.45, w: { bandage: 4, medkit: 2.2, note: 0.5 } },
  floor: { p: 0.22, w: { ammo: 3, att: 1.5, primary: 0.6, mag: 1, medkit: 0.5, plate: 0.4 } },
  warehouse: { p: 0.22, w: { ammo: 3, att: 1.5, mag: 1, medkit: 0.5 } },
  bay: { p: 0.35, w: { medkit: 2, bandage: 2, att: 1.5, plate: 0.5, ammo: 1 } },
  dispatch: { p: 0.35, w: { note: 3, mag: 1, ammo: 1, att: 1 } },
  armory: { p: 0.8, w: { primary: 2.2, sidearm: 1, ammo: 4, mag: 3, plate: 1.5, att: 2.5 } },
  military: { p: 0.85, w: { primary: 1.6, ammo: 4, mag: 3, plate: 2, att: 2.5, medkit: 1.5 } },
  hall: { p: 0.12, w: { bandage: 2, note: 1, ammo: 1 } },
  diner: { p: 0.1, w: { bandage: 2, note: 1, ammo: 1, sidearm: 0.3 } },
  laundry: { p: 0.12, w: { bandage: 2, ammo: 1, note: 1 } },
  nave: { p: 0.12, w: { bandage: 2, note: 1.5, ammo: 1, medkit: 0.4 } },
  street: { p: 0.28, w: { ammo: 2, bandage: 1.5, mag: 1, sidearm: 0.45, att: 0.6, primary: 0.25 } },
  park: { p: 0.15, w: { bandage: 2, ammo: 1, note: 1 } },
};
const AMMO_N = { '9mm': [5, 12], '.45': [4, 9], '.38': [4, 9], '12ga': [2, 6], '5.56': [6, 15], '.308': [2, 6] };
const ATT_W = [['reddot', 2], ['scope4', 1.2], ['scope10', 0.5], ['light', 2.5], ['laser', 1.5], ['supp_pistol', 1], ['supp_rifle', 0.7]];

export function assignLoot(L, rng) {
  const startId = rng.pick(SIDEARMS);
  L.start = { weapon: startId, seed: rng.int(1, 1e9), spare: rng.int(0, 1), loose: rng.int(4, 14), spareFill: rng.range(0.3, 1) };
  const picks = []; // {pos, cat, container, ctx}
  const roll = (ctx) => { const c = CTX[ctx] || CTX.street; return { c, cat: rng.weighted(Object.entries(c.w)) }; };
  for (const s of L.spots) { const c = CTX[s.ctx] || CTX.street; if (rng.chance(c.p * 0.36)) picks.push({ pos: s, cat: roll(s.ctx).cat, container: -1 }); }
  L.containers.forEach((ct, i) => {
    const c = CTX[ct.ctx] || CTX.street; if (!rng.chance(Math.min(0.92, c.p * 1.15))) return;
    const n = rng.int(1, ct.slots.length);
    for (let k = 0; k < n; k++) picks.push({ pos: ct.slots[k], cat: roll(ct.ctx).cat, container: i });
  });
  // guaranteed minimums so every town is survivable
  const count = (cat) => picks.filter(p => p.cat === cat).length;
  const free = rng.shuffle(L.spots.filter(s => !picks.some(p => p.pos === s)));
  const ensure = (cat, n) => { while (count(cat) < n && free.length) picks.push({ pos: free.pop(), cat, container: -1 }); };
  ensure('primary', 3); ensure('sidearm', 3); ensure('medkit', 5); ensure('plate', 2); ensure('note', NOTES.length); ensure('bandage', 10); ensure('att', 6); ensure('ammo', 20); ensure('mag', 8);
  // weapons first so ammunition can favour calibres that exist in this town
  const cals = [WEAPONS[startId].cal, WEAPONS[startId].cal, WEAPONS[startId].cal], magTypes = WEAPONS[startId].magType ? [WEAPONS[startId].magType, WEAPONS[startId].magType] : [];
  let noteI = 0; const noteOrder = rng.shuffle(NOTES.map((_, i) => i));
  const mk = (p) => {
    switch (p.cat) {
      case 'sidearm': case 'primary': {
        const id = rng.pick(p.cat === 'sidearm' ? SIDEARMS : PRIMARIES), d = WEAPONS[id];
        cals.push(d.cal, d.cal); if (d.magType) magTypes.push(d.magType);
        return { kind: 'weapon', id, seed: rng.int(1, 1e9) };
      }
      case 'bandage': return { kind: 'med', id: 'bandage' };
      case 'medkit': return { kind: 'med', id: 'medkit' };
      case 'plate': return { kind: 'plate', dur: Math.round(rng.range(45, 100)) };
      case 'att': return { kind: 'att', id: rng.weighted(ATT_W), cond: +rng.range(0.25, 1).toFixed(2) };
      case 'note': return noteI < noteOrder.length ? { kind: 'note', id: noteOrder[noteI++] } : { kind: 'med', id: 'bandage' };
      default: return null;
    }
  };
  for (const p of picks) p.item = mk(p);
  for (const p of picks) {
    if (p.item) continue;
    if (p.cat === 'mag') { const type = magTypes.length && rng.chance(0.75) ? rng.pick(magTypes) : rng.pick(Object.keys(MAGS)); p.item = { kind: 'mag', type, cal: MAGS[type].cal, cap: MAGS[type].cap, rounds: rng.chance(0.3) ? 0 : rng.int(1, MAGS[type].cap) }; }
    else { const cal = rng.chance(0.65) ? rng.pick(cals) : rng.pick(Object.keys(AMMO_N)); const r = AMMO_N[cal]; p.item = { kind: 'ammo', cal, n: rng.int(r[0], r[1]) }; }
  }
  for (const p of picks) L.items.push({ x: p.pos.x, y: p.pos.y, z: p.pos.z, item: p.item, container: p.container });
}

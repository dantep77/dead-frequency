// Procedural generation invariants across many seeds: node tests/worldgen.test.mjs [count]
import { generate, E, SIZE } from '../src/worldgen.js';
import assert from 'node:assert/strict';
const N = Number(process.argv[2] || 40);
let sig = new Set(), stats = [];
const t0 = Date.now();
for (let seed = 1; seed <= N; seed++) {
  const L = generate(seed), W = L.W, ci = (x, z) => Math.floor(x) + Math.floor(z) * W;
  const again = generate(seed);
  assert.equal(JSON.stringify(L.tapes), JSON.stringify(again.tapes), 'deterministic tapes');
  assert.equal(JSON.stringify(L.items), JSON.stringify(again.items), 'deterministic loot');
  assert.equal(L.tapes.length, 10, 'exactly 10 tapes');
  assert(L.reach[ci(L.spawn.x, L.spawn.z)], 'spawn reachable'); assert(L.reach[ci(L.extraction.x, L.extraction.z)], 'extraction reachable');
  const nearReach = (x, z, r = 2) => { for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { const c = ci(x + dx, z + dz); if (L.reach[c]) return true; } return false; };
  for (const t of L.tapes) { assert(nearReach(t.x, t.z), `tape reachable seed ${seed}`); assert(L.cellB[ci(t.x, t.z)], 'tape indoors'); }
  assert.equal(new Set(L.tapes.map(t => t.b)).size, 10, 'tapes in distinct buildings');
  for (const it of L.items) assert(nearReach(it.x, it.z, 3), `loot reachable seed ${seed} ${JSON.stringify(it)}`);
  for (const z of L.zombies) { assert(L.reach[ci(z.x, z.z)], 'zombie on navigable cell'); assert(Math.hypot(z.x - L.spawn.x, z.z - L.spawn.z) > 35, 'no zombie at spawn'); }
  for (const r of L.rooms) { let ok = false; for (let z = r.z; z < r.z + r.d && !ok; z++) for (let x = r.x; x < r.x + r.w; x++) if (L.reach[x + z * W]) { ok = true; break; } assert(ok, `room reachable seed ${seed} ${r.type}`); }
  const types = new Set(L.buildings.map(b => b.type));
  for (const t of ['house', 'garage', 'school', 'warehouse', 'eoc', 'kiosk']) assert(types.has(t), 'has ' + t);
  assert(L.blocks.some(b => b.type === 'park'));
  const kinds = {}; for (const it of L.items) kinds[it.item.kind] = (kinds[it.item.kind] || 0) + 1;
  assert(kinds.weapon >= 6 && kinds.med >= 15 && kinds.plate >= 2 && kinds.note === 10, 'loot minimums ' + JSON.stringify(kinds));
  sig.add(L.tapes.map(t => (t.x | 0) + ',' + (t.z | 0)).join(';') + L.spawn.x);
  stats.push({ seed, attempt: L.attempt, b: L.buildings.length, rooms: L.rooms.length, props: L.props.length, items: L.items.length, z: L.zombies.length, ammo: L.items.filter(i => i.item.kind === 'ammo').reduce((a, i) => a + i.item.n, 0) });
}
assert.equal(sig.size, N, 'every seed gives a different town');
const avg = k => (stats.reduce((a, s) => a + s[k], 0) / N).toFixed(1);
console.log(`worldgen ok: ${N} seeds in ${Date.now() - t0}ms | avg buildings ${avg('b')} rooms ${avg('rooms')} props ${avg('props')} items ${avg('items')} zombies ${avg('z')} loose rounds ${avg('ammo')} | retries ${stats.filter(s => s.attempt).length}`);

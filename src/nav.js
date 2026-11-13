// Grid navigation (1 m cells, walls on edges) with A* for the infected.
import { E } from './worldgen.js';
const PASS = (c) => c === E.NONE || c === E.DOOR || c === E.OPEN;

export class Nav {
  constructor(L) {
    this.L = L; this.W = L.W; this.H = L.H; const n = L.W * L.H;
    this.g = new Float32Array(n); this.f = new Float32Array(n); this.par = new Int32Array(n); this.stamp = new Uint32Array(n); this.closed = new Uint32Array(n); this.cur = 0; this.heap = [];
  }
  free(x, z) { return x >= 0 && z >= 0 && x < this.W && z < this.H && !this.L.blocked[x + z * this.W]; }
  step(x, z, dx, dz) { // orthogonal step legality
    const L = this.L, W = this.W, nx = x + dx, nz = z + dz;
    if (!this.free(nx, nz)) return false;
    if (dx === 1) return PASS(L.edgeV[x + 1 + z * (W + 1)]); if (dx === -1) return PASS(L.edgeV[x + z * (W + 1)]);
    if (dz === 1) return PASS(L.edgeH[x + (z + 1) * W]); return PASS(L.edgeH[x + z * W]);
  }
  canMove(x, z, dx, dz) {
    if (dx === 0 || dz === 0) return this.step(x, z, dx, dz);
    return this.step(x, z, dx, 0) && this.step(x, z, 0, dz) && this.step(x + dx, z, 0, dz) && this.step(x, z + dz, dx, 0);
  }
  nearestFree(x, z, reachOnly = true) {
    x = Math.max(1, Math.min(this.W - 2, Math.floor(x))); z = Math.max(1, Math.min(this.H - 2, Math.floor(z)));
    const ok = (a, b) => this.free(a, b) && (!reachOnly || this.L.reach[a + b * this.W]);
    if (ok(x, z)) return [x, z];
    for (let r = 1; r < 8; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; if (ok(x + dx, z + dz)) return [x + dx, z + dz]; }
    return null;
  }
  // Returns array of {x,z} waypoints (cell centres) or null.
  findPath(sx, sz, tx, tz, maxExpand = 5000) {
    const s = this.nearestFree(sx, sz, false), t = this.nearestFree(tx, tz, true); if (!s || !t) return null;
    const W = this.W, start = s[0] + s[1] * W, goal = t[0] + t[1] * W; if (start === goal) return [{ x: t[0] + 0.5, z: t[1] + 0.5 }];
    const cur = ++this.cur, { g, f, par, stamp, closed } = this, heap = this.heap; heap.length = 0;
    const h = (c) => { const dx = Math.abs((c % W) - t[0]), dz = Math.abs(((c / W) | 0) - t[1]); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    const push = (c) => { heap.push(c); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (f[heap[p]] <= f[heap[i]]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l; if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    g[start] = 0; f[start] = h(start); par[start] = -1; stamp[start] = cur; push(start);
    let n = 0, best = start, bestH = h(start);
    while (heap.length && n++ < maxExpand) {
      const c = pop(); if (closed[c] === cur) continue; closed[c] = cur;
      if (c === goal) { best = c; break; }
      const hc = f[c] - g[c]; if (hc < bestH) { bestH = hc; best = c; }
      const x = c % W, z = (c / W) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue; if (!this.canMove(x, z, dx, dz)) continue;
        const nc = c + dx + dz * W; if (closed[nc] === cur) continue;
        const ng = g[c] + (dx && dz ? 1.414 : 1);
        if (stamp[nc] !== cur || ng < g[nc]) { stamp[nc] = cur; g[nc] = ng; f[nc] = ng + h(nc); par[nc] = c; push(nc); }
      }
    }
    const path = []; for (let c = best; c !== -1 && path.length < 600; c = par[c]) path.push({ x: (c % W) + 0.5, z: ((c / W) | 0) + 0.5 });
    path.reverse(); if (path.length > 1) path.shift();
    return path.length ? path : null;
  }
}

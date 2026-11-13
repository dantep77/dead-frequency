// Static collision world: axis-aligned boxes in a uniform grid. Used for player/zombie
// movement, line of sight and ballistics (with per-box material for penetration).
export class World {
  constructor(size) { this.size = size; this.cs = 4; this.n = Math.ceil(size / this.cs); this.cells = Array.from({ length: this.n * this.n }, () => []); this.stamp = 0; this.count = 0; }
  add(x0, y0, z0, x1, y1, z1, mat = 'concrete', opt) {
    const b = { x0, y0, z0, x1, y1, z1, mat, off: false, see: false, stamp: 0 };
    if (opt) Object.assign(b, opt);
    const n = this.n, cs = this.cs;
    const cx0 = Math.max(0, Math.floor(x0 / cs)), cx1 = Math.min(n - 1, Math.floor(x1 / cs)), cz0 = Math.max(0, Math.floor(z0 / cs)), cz1 = Math.min(n - 1, Math.floor(z1 / cs));
    for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) this.cells[cx + cz * n].push(b);
    this.count++; return b;
  }
  query(x0, z0, x1, z1, cb) {
    const n = this.n, cs = this.cs, st = ++this.stamp;
    const cx0 = Math.max(0, Math.floor(x0 / cs)), cx1 = Math.min(n - 1, Math.floor(x1 / cs)), cz0 = Math.max(0, Math.floor(z0 / cs)), cz1 = Math.min(n - 1, Math.floor(z1 / cs));
    for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
      const list = this.cells[cx + cz * n];
      for (let i = 0; i < list.length; i++) { const b = list[i]; if (b.off || b.stamp === st) continue; b.stamp = st; if (b.x1 < x0 || b.x0 > x1 || b.z1 < z0 || b.z0 > z1) continue; cb(b); }
    }
  }
  // Ray vs boxes (+ ground plane y=0). filter(box) may reject boxes. Returns {t,tExit,box,mat,nx,ny,nz} or null.
  raycast(ox, oy, oz, dx, dy, dz, maxT, filter) {
    const st = ++this.stamp, cs = this.cs, n = this.n;
    let best = maxT, hit = null;
    if (dy < 0) { const t = -oy / dy; if (t >= 0 && t < best) { best = t; hit = { t, tExit: t, box: null, mat: 'ground', nx: 0, ny: 1, nz: 0 }; } }
    let cx = Math.floor(ox / cs), cz = Math.floor(oz / cs);
    const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const adx = Math.abs(dx), adz = Math.abs(dz);
    const tdx = adx > 1e-9 ? cs / adx : Infinity, tdz = adz > 1e-9 ? cs / adz : Infinity;
    let tmx = adx > 1e-9 ? (dx > 0 ? (cx + 1) * cs - ox : ox - cx * cs) / adx : Infinity;
    let tmz = adz > 1e-9 ? (dz > 0 ? (cz + 1) * cs - oz : oz - cz * cs) / adz : Infinity;
    let tcur = 0, guard = 0;
    const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
    while (tcur <= best && guard++ < 400) {
      if (cx >= 0 && cz >= 0 && cx < n && cz < n) {
        const list = this.cells[cx + cz * n];
        for (let i = 0; i < list.length; i++) {
          const b = list[i]; if (b.off || b.stamp === st) continue; b.stamp = st;
          if (filter && !filter(b)) continue;
          let t1 = (b.x0 - ox) * ix, t2 = (b.x1 - ox) * ix; let tn = Math.min(t1, t2), tf = Math.max(t1, t2), ax = 0;
          t1 = (b.y0 - oy) * iy; t2 = (b.y1 - oy) * iy; let a = Math.min(t1, t2), c = Math.max(t1, t2); if (a > tn) { tn = a; ax = 1; } if (c < tf) tf = c;
          t1 = (b.z0 - oz) * iz; t2 = (b.z1 - oz) * iz; a = Math.min(t1, t2); c = Math.max(t1, t2); if (a > tn) { tn = a; ax = 2; } if (c < tf) tf = c;
          if (!(tn <= tf) || tn < 0 || tn >= best) continue;
          best = tn; hit = { t: tn, tExit: tf, box: b, mat: b.mat, nx: ax === 0 ? -sx : 0, ny: ax === 1 ? (dy > 0 ? -1 : 1) : 0, nz: ax === 2 ? -sz : 0 };
        }
      } else if ((cx < 0 && sx < 0) || (cx >= n && sx > 0) || (cz < 0 && sz < 0) || (cz >= n && sz > 0)) break;
      if (tmx < tmz) { tcur = tmx; tmx += tdx; cx += sx; } else { tcur = tmz; tmz += tdz; cz += sz; }
    }
    return hit;
  }
  // Line of sight between two points (vision-blocking boxes only).
  los(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.hypot(dx, dy, dz); if (d < 1e-4) return true;
    return !this.raycast(ax, ay, az, dx / d, dy / d, dz / d, d, losFilter);
  }
  // Push a vertical cylinder (x,z,r spanning y0..y1) out of solid boxes. Mutates p {x,z}. Returns true if touched.
  collide(p, r, y0, y1, ignore) {
    let touched = false;
    for (let it = 0; it < 3; it++) {
      let any = false;
      this.query(p.x - r, p.z - r, p.x + r, p.z + r, (b) => {
        if (b.noMove || b === ignore || b.y1 <= y0 || b.y0 >= y1) return;
        const px = Math.max(b.x0, Math.min(p.x, b.x1)), pz = Math.max(b.z0, Math.min(p.z, b.z1));
        let ddx = p.x - px, ddz = p.z - pz; const d2 = ddx * ddx + ddz * ddz;
        if (d2 >= r * r) return;
        any = true;
        if (d2 > 1e-10) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += ddx * k; p.z += ddz * k; }
        else { // centre inside the box: exit along the shallowest axis
          const l = p.x - b.x0, rr = b.x1 - p.x, n = p.z - b.z0, f = b.z1 - p.z, m = Math.min(l, rr, n, f);
          if (m === l) p.x = b.x0 - r; else if (m === rr) p.x = b.x1 + r; else if (m === n) p.z = b.z0 - r; else p.z = b.z1 + r;
        }
      });
      if (!any) break; touched = true;
    }
    return touched;
  }
  groundAt(x, z, r, feetY) {
    let g = 0; const e = r * 0.7;
    this.query(x - e, z - e, x + e, z + e, (b) => { if (!b.noMove && b.y1 <= feetY + 0.45 && b.y1 > g) g = b.y1; });
    return g;
  }
  ceilingAt(x, z, r, headY) {
    let c = Infinity; const e = r * 0.7;
    this.query(x - e, z - e, x + e, z + e, (b) => { if (!b.noMove && b.y0 >= headY - 0.15 && b.y0 < c) c = b.y0; });
    return c;
  }
}
const losFilter = (b) => !b.see;

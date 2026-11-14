// End-to-end game-loop test in a real browser (headless Chromium via Playwright).
// Usage: start `node server.js`, then `NODE_PATH=<dir containing playwright> node tests/e2e.cjs [seed]`
// It drives the real game through window.DF using simulated key/mouse input.
const { chromium } = require('playwright');
const SEED = Number(process.argv[2] || 11);

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 960, height: 600 } });
  const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); }); p.on('pageerror', e => errs.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  await p.addInitScript(() => localStorage.setItem('df_settings', JSON.stringify({ shadows: false, renderScale: 0.5, voice: false })));
  await p.goto('http://localhost:8080/'); await p.waitForTimeout(400);
  const start = async (seed) => { await p.evaluate((s) => { document.getElementById('seed').value = s === null ? '' : String(s); }, seed); await p.evaluate(() => document.querySelector('#menu:not(.hidden) button[data-act=new], #dead:not(.hidden) button[data-act=new], #end:not(.hidden) button[data-act=new]').click()); await p.waitForFunction(() => window.DF && DF.state === 'play' && DF.player, null, { timeout: 120000 }); await p.evaluate(() => { DF.render = () => { }; DF.input.noLock = true; }); };
  await start(SEED);

  const results = await p.evaluate(async () => {
    const g = DF, out = [], ok = (name, cond, extra = '') => { out.push((cond ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };
    const { Firearm, makeMag } = await import('/src/firearm.js'); const { WEAPONS } = await import('/src/data/weapons.js');
    const inp = g.input, P = () => g.player, b = g.settings.binds;
    const step = (n = 1, dt = 0.05) => { for (let i = 0; i < n; i++) { g.step(dt); inp.endFrame(); } };
    const tap = (action) => { const c = b[action]; inp.keys.add(c); inp.pressed.add(c); step(); inp.keys.delete(c); inp.released.add(c); step(); };
    const hold = (action, on) => { const c = b[action]; if (on) { inp.keys.add(c); inp.pressed.add(c); } else { inp.keys.delete(c); inp.released.add(c); } step(); };
    const drag = (dy) => { inp.dy = dy; step(); };
    const click = () => { inp.lmb = true; inp.lmbP = true; step(); inp.lmb = false; inp.lmbR = true; step(); };
    const rack = () => { hold('action', true); drag(260); hold('action', false); };
    const lookAt = (x, y, z) => { const pl = P(), e = pl.eye, dx = x - e.x, dy = y - e.y, dz = z - e.z; pl.yaw = Math.atan2(-dx, -dz); pl.pitch = Math.atan2(dy, Math.hypot(dx, dz)); };
    const standNear = (x, z, min = 0.6, y = 1.0) => { const L = g.L; let best = null; for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) { const cx = Math.floor(x) + dx, cz = Math.floor(z) + dz, c = cx + cz * L.W; if (!L.reach[c] || L.blocked[c]) continue; const d = Math.hypot(cx + 0.5 - x, cz + 0.5 - z); if (d >= min && (!best || d < best.d) && (L.cellRoom[c] === L.cellRoom[Math.floor(x) + Math.floor(z) * L.W] || g.world.los(cx + 0.5, 1.6, cz + 0.5, x + (cx + 0.5 - x) / d * 0.12, y + 0.08, z + (cz + 0.5 - z) / d * 0.12))) best = { d, x: cx + 0.5, z: cz + 0.5 }; } if (!best) return false; const pl = P(); pl.pos.x = best.x; pl.pos.z = best.z; pl.pos.y = 0; pl.vel.x = pl.vel.y = pl.vel.z = 0; return true; };
    const use = () => { const pl = P(); g.target = g.pickups.findTarget(pl.eye, pl.forward()); const t = g.target; if (t) g.interact(); return t; };
    const zUpdate = g.zombies.update.bind(g.zombies); const freezeZ = (f) => { g.zombies.update = f ? () => { } : zUpdate; };
    freezeZ(true); const realDamage = P().damage.bind(P());
    step(5);

    // ---------- every firearm: pick up from the ground, make ready with real inputs, fire ----------
    const fired = (f, n0) => f.shots > n0;
    for (const id of Object.keys(WEAPONS)) {
      const pl = P(), D = WEAPONS[id], f = new Firearm(id, { cond: 1, rand: () => 0.999 });
      pl.pos.x = g.L.spawn.x; pl.pos.z = g.L.spawn.z; pl.pos.y = 0; pl.inv.items.length = 0; if (pl.hand) { pl.hand = null; g.vm.setHand(null); }
      const fw = pl.forward(), e = g.pickups.spawn(f, { x: pl.pos.x + fw.x * 1.0, y: 0.5, z: pl.pos.z + fw.z * 1.0 }); step(20);
      lookAt(e.x, e.y + 0.04, e.z); const t = use(); pl.pitch = 0; step(12);
      const have = pl[D.slot] === f && pl.weapon === f; pl.inv.add({ kind: 'ammo', cal: D.cal, n: 12 });
      const n0 = f.shots; click(); const dry = !fired(f, n0);   // an unloaded gun must not fire
      if (D.feed === 'mag') { pl.inv.add(makeMag(D.magType, 0)); tap('drawMag'); for (let i = 0; i < 3; i++) { tap('loadRound'); step(10); } tap('mag'); tap('tap'); }
      if (D.action === 'pistol' || D.action === 'rifle_semi') rack();
      else if (D.action === 'semi_shotgun') { for (let i = 0; i < 3; i++) { tap('loadRound'); step(10); } rack(); if (f.slideLocked) tap('slideStop'); }
      else if (D.action === 'pump') { for (let i = 0; i < 3; i++) { tap('loadRound'); step(10); } hold('action', true); drag(260); drag(-260); hold('action', false); }
      else if (D.action === 'bolt') { hold('action', true); drag(260); if (D.feed === 'internal') for (let i = 0; i < 3; i++) { tap('loadRound'); step(10); } drag(-260); hold('action', false); }
      else if (D.revolver === 'da') { tap('mag'); for (let i = 0; i < 3; i++) { tap('loadRound'); step(10); } tap('mag'); }
      else { tap('hammer'); tap('mag'); for (let i = 0; i < 3; i++) { tap('loadRound'); step(10); inp.wheel = 1; step(); } tap('mag'); tap('hammer'); }
      if (f.safety) tap('safety');
      let shots = 0; for (let k = 0; k < 8 && shots < 2; k++) { const s0 = f.shots; click(); step(3); if (fired(f, s0)) shots++; else { if (D.action === 'pump') { hold('action', true); drag(260); drag(-260); hold('action', false); } else if (D.action === 'bolt') { hold('action', true); drag(260); drag(-260); hold('action', false); } else if (D.revolver === 'sa') { tap('hammer'); if (f.hammer === 1) tap('hammer'); } } }
      ok(`weapon ${id}: picked up, refused to fire empty, fired after its own procedure`, !!t && have && dry && shots >= 2, `(pickup=${!!t && have} dry=${dry} shots=${shots})`);
    }
    // ---------- malfunction, wear, catastrophic failure in-engine ----------
    {
      const pl = P(), f = new Firearm('g17', { cond: 0.9, rand: () => 0.999 }); f.mag = makeMag('g17', 10); pl.equip(f, true); pl.drawT = 0; step(2); rack();
      f.jam = 'stovepipe'; f.slide = 0.35; f.chamber = null; let s0 = f.shots; click(); const blockedByJam = f.shots === s0; rack(); click(); ok('stovepipe blocks firing until racked', blockedByJam && f.shots === s0 + 1);
      const c0 = f.cond; for (let i = 0; i < 4; i++) { click(); step(3); } ok('weapon condition degrades with use', f.cond < c0);
      f.att.optic = { kind: 'att', id: 'reddot', cond: 1 }; click(); step(3); ok('attachment degrades with use', f.att.optic.cond < 1);
      f.cond = 0.03; { let k = 0; f.rand = () => (k++ === 0 ? 0.999 : 0); } f.jam = null; f.chamber = 'live'; f.slide = 0; f.slideLocked = false; f.hammer = 2; click(); const broke = f.broken; s0 = f.shots; f.rand = () => 0.999; rack(); click(); click(); ok('catastrophic failure permanently disables the weapon', broke && f.shots === s0 && f.conditionText().startsWith('DESTROYED'));
      tap('drop'); ok('weapon can be dropped', pl.sidearm === null && g.pickups.entries.some(e => e.item === f));
    }
    // ---------- loot: take, containers, inventory attach / drop ----------
    {
      const pl = P(); pl.inv.items.length = 0; let took = 0, tried = 0;
      for (const e of [...g.pickups.entries]) { if (e.hidden || e.item.kind === 'weapon' || e.item.kind === 'note' || tried >= 12) continue; tried++; if (!standNear(e.x, e.z, 0.6, e.y)) continue; step(2); lookAt(e.x, e.y + 0.04, e.z); const n = g.pickups.entries.length, t = use(); if (t && t.type === 'item' && g.pickups.entries.length < n) took++; }
      ok('loose loot can be collected', took >= 8, `(${took}/${tried})`);
      let opened = 0, ctried = 0; for (const c of g.pickups.containers) { if (ctried >= 8) break; ctried++; if (!standNear(c.x, c.z, 0.9, 3)) continue; step(2); lookAt(Math.max(c.x0, Math.min(P().pos.x, c.x1)), Math.min(1.2, c.top), Math.max(c.z0, Math.min(P().pos.z, c.z1))); const t = use(); if (c.opened) opened++; }
      ok('containers can be searched', opened >= 5, `(${opened}/${ctried})`);
      const f = new Firearm('ar15', { cond: 0.9, rand: () => 0.999 }); pl.equip(f, true); pl.inv.items.length = 0; pl.inv.add({ kind: 'att', id: 'reddot', cond: 0.9 }); pl.inv.add({ kind: 'att', id: 'supp_pistol', cond: 0.9 }); pl.inv.add({ kind: 'med', id: 'bandage' });
      g.openOverlay('inventory'); const btn = (label) => [...document.querySelectorAll('#inventory button')].find(x => x.textContent === label);
      const attachCount = [...document.querySelectorAll('#inventory button')].filter(x => x.textContent === 'ATTACH').length; btn('ATTACH').click();
      ok('compatible attachment mounts; incompatible one is not offered', f.att.optic && f.att.optic.id === 'reddot' && attachCount === 1);
      btn('DETACH').click(); ok('attachment detaches back to the pack', !f.att.optic && pl.inv.items.some(i => i.id === 'reddot'));
      const n = g.pickups.entries.length, k = pl.inv.items.length; btn('DROP').click(); ok('inventory item can be dropped into the world', g.pickups.entries.length === n + 1 || pl.inv.items.length === k - 1);
      const full = pl.inv.add({ kind: 'ammo', cal: '12ga', n: 500 }); ok('pack capacity limits ammunition', full > 0 && full < 500 && pl.inv.free < 0.31, `(accepted ${full})`);
      g.closeOverlay(); pl.inv.items.length = 0;
    }
    // ---------- doors ----------
    { const d = g.wb.doors.find(d => !d.open && g.L.reach[Math.floor(d.x) + Math.floor(d.z) * g.L.W]) || g.wb.doors.find(d => !d.open); const pl = P(); pl.pos.x = d.x + (d.v ? 1.2 : 0); pl.pos.z = d.z + (d.v ? 0 : 1.2); pl.pos.y = 0; step(2); lookAt(d.x, 1.1, d.z); const t = use(); step(10); ok('doors open', !!t && t.type === 'door' && d.open && d.box.off); }
    // ---------- infected batter a closed door open when something behind it draws them ----------
    { const L = g.L, d = g.wb.doors.find(d => !d.open && !d.d.ext && L.reach[Math.floor(d.v ? d.x - 1 : d.x) + Math.floor(d.v ? d.z : d.z - 1) * L.W] && L.reach[Math.floor(d.v ? d.x + 0.5 : d.x) + Math.floor(d.v ? d.z : d.z + 0.5) * L.W]);
      if (d) { for (const z of [...g.zombies.list]) g.zombies.kill(z); const ax = d.v ? d.x - 0.5 : d.x, az = d.v ? d.z : d.z - 0.5, bx = d.v ? d.x + 0.5 : d.x, bz = d.v ? d.z : d.z + 0.5; P().pos.x = 5; P().pos.z = 5;
        const zb = g.zombies.spawn(ax, az, 'standard'); zb.percT = 1e9; zb.state = 'investigate'; zb.tx = bx; zb.tz = bz; zb.fast = true; freezeZ(false); for (let i = 0; i < 160 && !d.open; i++) step(); freezeZ(true);
        ok('infected batter a closed door open', d.open); g.zombies.kill(zb); } else ok('infected batter a closed door open (no suitable door on this seed — skipped)', true); }
    // ---------- infected: detection, pursuit, damage, armor, death ----------
    {
      const pl = P(); pl.pos.x = g.L.spawn.x; pl.pos.z = g.L.spawn.z; pl.pos.y = 0; pl.pitch = 0; pl.hp = 100; pl.bleed = 0; pl.armor = { kind: 'plate', dur: 100 }; g.sky.hour = 12; step(2);
      const fw = pl.forward(); for (const z of [...g.zombies.list]) g.zombies.kill(z);
      const zb = g.zombies.spawn(pl.pos.x + fw.x * 14, pl.pos.z + fw.z * 14, 'standard'); zb.face = Math.atan2(-fw.x, -fw.z); freezeZ(false);
      let detected = false, i = 0; for (; i < 200 && !detected; i++) { step(); detected = zb.state === 'chase'; } const d0 = Math.hypot(zb.x - pl.pos.x, zb.z - pl.pos.z);
      for (i = 0; i < 400 && pl.hp >= 100; i++) step(); const d1 = Math.hypot(zb.x - pl.pos.x, zb.z - pl.pos.z);
      ok('infected sees the player, pursues and attacks', detected && d1 < 2.2 && pl.hp < 100, `(d ${d0.toFixed(1)} -> ${d1.toFixed(1)}, hp ${pl.hp.toFixed(0)})`);
      ok('armor plate absorbs part of the hit and wears', pl.armor && pl.armor.dur < 100 && pl.hp > 100 - 23);
      // a deaf, unseen zombie behind the player hears a gunshot
      const z2 = g.zombies.spawn(pl.pos.x + fw.x * 30, pl.pos.z + fw.z * 30, 'standard'); z2.face = Math.atan2(fw.x, fw.z); z2.percT = 1e9; g.noise(pl.pos.x, pl.pos.z, 85, 'gunshot'); ok('gunshots attract infected that have not seen the player', z2.state === 'investigate');
      freezeZ(true); for (const z of [...g.zombies.list]) g.zombies.kill(z); const f = new Firearm('ar15', { cond: 1, rand: () => 0.999 }); f.mag = makeMag('ar15', 30); pl.equip(f, true); pl.drawT = 0; step(2); rack();
      const zt = g.zombies.spawn(pl.pos.x + fw.x * 9, pl.pos.z + fw.z * 9, 'standard'); inp.rmb = true; step(30); lookAt(zt.x, 1.66, zt.z); step(1); lookAt(zt.x, 1.66, zt.z); const n = g.zombies.list.length; click(); step(6); inp.rmb = false;
      ok('aimed headshot kills a standard infected', !zt.alive && g.zombies.list.length === n - 1);
      const za = g.zombies.spawn(pl.pos.x + fw.x * 9, pl.pos.z + fw.z * 9, 'bloater'); lookAt(za.x, 1.3, za.z); step(1); const hp0 = za.hp; pl.aim = 1; click(); step(6); ok('torso hit wounds but does not kill a bloater', za.alive && za.hp < hp0, `(${hp0} -> ${za.hp.toFixed(0)})`);
      for (const z of [...g.zombies.list]) g.zombies.kill(z);
      pl.hp = 60; pl.bleed = 2; const h0 = pl.hp; step(40); const bled = pl.hp < h0; pl.inv.add({ kind: 'med', id: 'bandage' }); tap('bandage'); step(60); ok('bleeding drains health until bandaged', bled && pl.bleed === 0);
      pl.inv.add({ kind: 'med', id: 'medkit' }); const h1 = pl.hp; tap('medkit'); step(100); ok('trauma kit restores health', pl.hp > h1 + 30); pl.damage = () => { };
    }
    // ---------- objective: ten tapes, in order; extraction gated on all ten ----------
    {
      const pl = P(), ex = g.L.extraction; let order = true, got = 0;
      standNear(ex.beacon.x, ex.beacon.z, 0.8); step(2); lookAt(ex.beacon.x, 1.0, ex.beacon.z); use(); ok('extraction refused before all tapes are recovered', g.ext.phase === 0);
      for (const t of g.pickups.tapes) { if (!standNear(t.x, t.z, 0.6, t.y)) continue; step(2); lookAt(t.x, t.y + 0.03, t.z); const tg = use(); if (tg && tg.type === 'tape' && t.taken) { got++; if (!g.tapes.cur || g.tapes.cur.i !== got - 1) order = false; step(4); } }
      ok('all 10 tapes reachable and collectable', got === 10 && g.tapeCount === 10, `(${got}/10)`); ok('each pickup plays the next recording in narrative order', order);
      let lines = 0; const cur = g.tapes.cur; for (let i = 0; i < 4000 && g.tapes.cur === cur; i++) { step(1, 0.05); if (cur.line > lines) lines = cur.line; } ok('a recording plays through all of its lines and stops', lines === cur.T.lines.length && !g.tapes.playing, `(${lines} lines)`);
      ok('extraction becomes available at 10/10', g.ext.phase === 1);
      standNear(ex.beacon.x, ex.beacon.z, 0.8); step(2); lookAt(ex.beacon.x, 1.0, ex.beacon.z); use(); ok('beacon starts the extraction sequence', g.ext.phase === 2);
      for (let i = 0; i < 400 && g.ext.phase === 2; i++) step(); ok('gate opens and the truck arrives', g.ext.phase === 3 && g.wb.gates.find(q => q.kind === 'exit').open >= 1);
      const x = g.pickups.extra[g.pickups.extra.length - 1]; standNear(x.x, x.z, 0.8); step(2); lookAt(x.x, x.y, x.z); use(); ok('boarding the truck completes the run', g.state === 'end');
    }
    return out;
  });
  console.log(results.join('\n'));
  await p.waitForTimeout(3500);
  const endShown = await p.evaluate(() => !document.getElementById('end').classList.contains('hidden') && document.querySelectorAll('#end-text p').length > 5);
  console.log((endShown ? 'ok   ' : 'FAIL ') + 'ending screen is presented');
  // ---------- new run after extraction; death resets; new town differs ----------
  const sig = () => p.evaluate(() => DF.L.seed + ':' + DF.L.tapes.map(t => (t.x | 0) + ',' + (t.z | 0)).join(';'));
  await p.waitForSelector('#end-btn:not(.hidden)', { timeout: 60000 }); await start(null); const s1 = await sig();
  const fresh = await p.evaluate(() => DF.tapeCount === 0 && DF.player.hp === 100 && !DF.player.primary && DF.ext.phase === 0);
  console.log((fresh ? 'ok   ' : 'FAIL ') + 'a new run starts immediately with reset equipment and objectives');
  await p.evaluate(() => { DF.player.damage(500, { by: 'runner' }); }); await p.waitForFunction(() => DF.state === 'dead', null, { timeout: 15000 });
  const deadShown = await p.evaluate(() => !document.getElementById('dead').classList.contains('hidden') && DF.player === null || !document.getElementById('dead').classList.contains('hidden'));
  console.log((deadShown ? 'ok   ' : 'FAIL ') + 'death ends the run and shows the death screen');
  await start(null); const s2 = await sig();
  console.log((s1 !== s2 ? 'ok   ' : 'FAIL ') + 'a new run after death generates a different town');
  // pause menu
  const paused = await p.evaluate(() => { DF.pause(); const a = DF.state === 'pause' && !document.getElementById('pause').classList.contains('hidden'); DF.resume(); return a && DF.state === 'play'; });
  console.log((paused ? 'ok   ' : 'FAIL ') + 'pause and resume');
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console or page errors');
  const fails = results.filter(r => r.startsWith('FAIL')).length; await b.close(); process.exit(fails || errs.length ? 1 : 0);
})();

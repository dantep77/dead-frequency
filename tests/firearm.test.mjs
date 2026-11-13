// Unit tests for the mechanical firearm simulation: node tests/firearm.test.mjs
import { Firearm, makeMag } from '../src/firearm.js';
import { WEAPONS } from '../src/data/weapons.js';
import assert from 'node:assert/strict';

let ev = [];
const mk = (id, cond = 1, rand = () => 0.999) => { const f = new Firearm(id, { cond, rand, emit: (t, d) => ev.push(t) }); return f; };
const rack = f => { f.grab(); f.drag(1); f.release(); };
const pump = f => { f.grab(); f.drag(1); f.drag(-1); f.release(); };
const pull = f => { ev = []; f.triggerPull(); f.triggerRelease(); return ev.includes('fire'); };
let n = 0; const ok = (name) => { n++; console.log('  ok  ' + name); };

// --- 1911: single action, safety locks slide, hammer needed
{ const f = mk('m1911'); f.insertMag(makeMag('m1911', 7));
  assert(!pull(f), 'no round chambered & hammer down'); assert(ev.includes('dead_trigger'));
  rack(f); assert.equal(f.chamber, 'live'); assert.equal(f.mag.rounds, 6); assert.equal(f.hammer, 2);
  f.toggleSafety(); assert(f.safety); assert(!pull(f)); f.grab(); f.drag(1); f.release(); assert.equal(f.mag.rounds, 6, 'safety locks slide');
  f.toggleSafety(); let shots = 0; while (pull(f)) shots++; assert.equal(shots, 7); assert(f.slideLocked, 'locks back on empty');
  const m = f.magRelease(); assert.equal(m.rounds, 0); m.rounds = 3; f.insertMag(m); assert(f.slideLocked); f.slideStop(true); f.slideStop(false);
  assert.equal(f.chamber, 'live'); assert.equal(f.mag.rounds, 2);
  // press check does not change state
  f.grab(); f.drag(0.4); f.release(); assert.equal(f.chamber, 'live'); assert.equal(f.mag.rounds, 2);
  // racking a live round ejects it
  ev = []; rack(f); assert(ev.includes('eject_round')); assert.equal(f.mag.rounds, 1);
  // decock then trigger is dead until hammer cocked
  f.triggerPull(); // fires
  f.triggerRelease(); f.triggerHeld = true; f.hammerKey(); f.triggerHeld = false; assert.equal(f.hammer, 0); assert(!pull(f)); f.hammerKey(); assert(pull(f));
  ok('M1911A1 procedure'); }
// --- Glock: striker needs rack after dry fire, no safety
{ const f = mk('g17'); f.insertMag(makeMag('g17', 2)); f.hammer = 2; ev = []; f.toggleSafety(); assert(ev.includes('no_safety'));
  assert(!pull(f)); assert(ev.includes('click')); assert(!pull(f)); assert(ev.includes('dead_trigger'), 'striker not reset');
  rack(f); assert(pull(f)); assert(pull(f)); assert(f.slideLocked); assert(!pull(f));
  ok('G17 procedure'); }
// --- M9: DA first shot, decocker
{ const f = mk('m9'); f.insertMag(makeMag('m9', 15)); rack(f); f.toggleSafety(); assert.equal(f.hammer, 0); assert(!pull(f)); f.toggleSafety();
  ev = []; f.triggerPull(); f.triggerRelease(); assert(ev.includes('fire')); assert.equal(f.hammer, 2, 'SA after first shot');
  ok('M9 procedure'); }
// --- Model 10
{ const f = mk('model10'); assert(!pull(f)); assert(!f.loadRound(), 'cannot load closed'); f.cylinderKey(); for (let i = 0; i < 6; i++) assert(f.loadRound()); assert(!f.loadRound());
  assert(!pull(f), 'open cylinder'); f.cylinderKey(); let s = 0; for (let i = 0; i < 8; i++) if (pull(f)) s++; assert.equal(s, 6);
  f.cylinderKey(); ev = []; f.ejectorRod(); assert.equal(ev.filter(e => e === 'eject_case').length, 6); assert.equal(f.countRounds(), 0);
  f.cylinderKey(); f.hammerKey(); assert.equal(f.hammer, 2); ev = []; f.cylinderKey(); assert(!f.cylOpen, 'cannot open cocked');
  ok('Model 10 procedure'); }
// --- SAA
{ const f = mk('saa'); f.cylinderKey(); assert(!f.loadRound(), 'needs half cock'); f.hammerKey(); assert.equal(f.hammer, 1);
  for (let i = 0; i < 6; i++) { assert(f.loadRound()); assert(!f.loadRound()); f.spinCylinder(1); }
  f.cylinderKey(); assert(!pull(f)); f.hammerKey(); assert.equal(f.hammer, 2); assert(pull(f)); assert(!pull(f), 'must recock'); let s = 1;
  for (let i = 0; i < 7; i++) { f.hammerKey(); f.hammerKey(); if (pull(f)) s++; } assert.equal(s, 6);
  f.hammerKey(); f.cylinderKey(); let c = 0; for (let i = 0; i < 6; i++) { ev = []; f.ejectorRod(); c += ev.filter(e => e === 'eject_case').length; f.spinCylinder(1); } assert.equal(c, 6);
  ok('Single Action Army procedure'); }
// --- 870
{ const f = mk('r870'); for (let i = 0; i < 5; i++) assert(f.loadRound()); assert(!f.loadRound()); assert(!pull(f));
  pump(f); assert.equal(f.chamber, 'live'); assert.equal(f.internal, 4); assert(f.actionLocked);
  f.grab(); f.drag(1); assert.equal(f.slide, 0, 'action locked'); f.release();
  assert(pull(f)); assert(!pull(f), 'must pump'); 
  f.grab(); f.drag(0.5); f.drag(-1); f.release(); assert.equal(f.chamber, 'spent', 'short stroke leaves the empty in the chamber'); assert(!pull(f));
  pump(f); assert(pull(f));
  pump(f); f.slideStop(true); f.grab(); f.drag(1); f.slideStop(false); assert.equal(f.chamber, null); ev=[]; f.drag(-1); f.release(); assert.equal(f.chamber, 'live');
  // port load
  const g = mk('r870'); g.grab(); g.drag(1); g.release(); assert(g.loadRound()); assert(g.staged); g.grab(); g.drag(-1); g.release(); assert.equal(g.chamber, 'live'); assert(pull(g));
  ok('Model 870 procedure'); }
// --- M1014
{ const f = mk('m1014'); for (let i = 0; i < 6; i++) f.loadRound(); rack(f); assert.equal(f.chamber, 'live'); let s = 0; while (pull(f)) s++; assert.equal(s, 6); assert(f.slideLocked);
  assert(f.loadRound()); assert(f.staged); f.slideStop(true); f.slideStop(false); assert.equal(f.chamber, 'live'); assert(pull(f));
  ok('M1014 procedure'); }
// --- AR-15
{ const f = mk('ar15'); f.toggleSafety(); assert(!f.safety, 'cannot safe uncocked'); f.insertMag(makeMag('ar15', 30)); rack(f); f.toggleSafety(); assert(f.safety); assert(!pull(f)); f.toggleSafety();
  let s = 0; while (pull(f)) s++; assert.equal(s, 30); assert(f.slideLocked);
  ok('AR-15 procedure'); }
// --- Model 70
{ const f = mk('model70'); assert(!f.loadRound(), 'bolt closed'); f.grab(); f.drag(1); for (let i = 0; i < 5; i++) assert(f.loadRound()); f.drag(-0.5); assert.equal(f.chamber, 'live'); assert(!pull(f), 'bolt not closed'); f.drag(-1); f.release();
  assert(pull(f)); assert(!pull(f)); let s = 1; for (let i = 0; i < 6; i++) { f.grab(); f.drag(1); f.drag(-1); f.release(); if (pull(f)) s++; } assert.equal(s, 5);
  ok('Model 70 procedure'); }
// --- M40
{ const f = mk('m40'); f.insertMag(makeMag('m40', 5)); f.grab(); f.drag(1); f.drag(-1); f.release(); assert(pull(f)); assert.equal(f.mag.rounds, 4); ok('M40A5 procedure'); }

// --- Malfunctions and their distinct clearances
{ // stovepipe: rack clears
  const f = mk('g17'); f.insertMag(makeMag('g17', 17)); rack(f); f.jam = 'stovepipe'; f.slide = 0.35; f.chamber = null; assert(!pull(f)); rack(f); assert.equal(f.jam, null); assert(pull(f));
  // failure to feed
  f.jam = 'ftf'; f.slide = 0.3; f.chamber = null; assert(!pull(f)); rack(f); assert(pull(f));
  // double feed: rack does NOT clear; mag stuck until slide locked; then strip, rack, reload
  const before = f.mag.rounds; f.jam = 'doublefeed'; f.jamRound = true; f.mag.rounds--; f.chamber = 'spent'; f.slide = 0.4;
  rack(f); assert.equal(f.jam, 'doublefeed'); assert.equal(f.magRelease(), null);
  f.grab(); f.drag(1); f.slideStop(true); f.release(); f.slideStop(false); assert(f.slideLocked);
  const m = f.magRelease(); assert(m); ev = []; rack(f); assert.equal(f.jam, null); assert(ev.includes('eject_round')); f.insertMag(m); rack(f); assert(pull(f));
  // stuck case: needs repeated tugs
  f.jam = 'stuck'; f.tugs = 3; f.tugArmed = true; f.chamber = 'spent'; f.hammer = 0;
  f.grab(); f.drag(1); assert(f.slide <= 0.12); f.drag(-1); f.drag(1); f.drag(-1); assert.equal(f.jam, 'stuck'); f.drag(1); assert.equal(f.jam, null); f.drag(-1); f.drag(1); f.release(); assert(pull(f));
  // unseated magazine does not feed; tap fixes
  const h = mk('m9'); h.insertMag(makeMag('m9', 5)); h.magSeated = false; rack(h); assert.equal(h.chamber, null); h.tapMag(); rack(h); assert.equal(h.chamber, 'live');
  // revolver bind: opening the cylinder frees it
  const r = mk('model10'); r.cylinderKey(); r.loadRound(); r.cylinderKey(); r.jam = 'bind'; assert(!pull(r)); r.cylinderKey(); r.cylinderKey(); assert.equal(r.jam, null);
  // light strike: DA gun can re-strike
  let k = 0; const l = mk('m9'); l.insertMag(makeMag('m9', 3)); rack(l); l.rand = () => (k++ === 0 ? 0 : 0.999); assert(!pull(l)); assert.equal(l.chamber, 'live'); assert(pull(l));
  ok('malfunction clearances'); }
// --- statistical: malfunctions scale with wear; ammo is conserved; catastrophic failure is permanent
{ let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const run = (cond) => { let jams = 0; for (let t = 0; t < 400; t++) { const f = new Firearm('g17', { cond, rand: rnd }); f.insertMag(makeMag('g17', 17)); rack(f); f.cond = cond; f.triggerPull(); f.triggerRelease(); if (f.jam) jams++; } return jams; };
  const a = run(0.95), b = run(0.5), c = run(0.2); assert(a < b && b < c, `jam rates ${a} ${b} ${c}`); console.log(`     jam rate per shot: 95%→${a / 4}%  50%→${b / 4}%  20%→${c / 4}%`);
  let broke = null; for (let t = 0; t < 400 && !broke; t++) { const f = new Firearm('m1911', { cond: 0.04, rand: rnd, emit: () => {} }); f.insertMag(makeMag('m1911', 7)); rack(f); f.triggerPull(); f.triggerRelease(); if (f.broken) broke = f; }
  assert(broke, 'catastrophic occurs at very low condition'); const live = broke.countRounds(); ev = []; broke.emit = (t) => ev.push(t); broke.triggerPull(); broke.triggerRelease(); assert(!ev.includes('fire')); broke.grab(); broke.drag(1); broke.release(); assert.equal(broke.countRounds(), live); assert(broke.conditionText().startsWith('DESTROYED')); assert(broke.magRelease());
  // wear accumulates
  const w = mk('ar15', 0.9); w.insertMag(makeMag('ar15', 30)); rack(w); for (let i = 0; i < 30; i++) pull(w); assert(w.cond < 0.9);
  w.att.optic = { kind: 'att', id: 'reddot', cond: 1 }; w.mag.rounds = 5; w.slideStop(true); w.slideStop(false); pull(w); assert(w.att.optic.cond < 1);
  // conservation over random operation fuzz on every weapon
  for (const id of Object.keys(WEAPONS)) for (let t = 0; t < 60; t++) {
    let ej = 0, fired = 0, loaded = 0; const f = new Firearm(id, { cond: 0.2 + rnd() * 0.8, rand: rnd, emit: (e, d) => { if (e === 'eject_round') ej++; if (e === 'fire') fired++; if (e === 'mag_drop') ej += d.mag.rounds; } });
    let hand = null; if (f.def.feed === 'mag') { hand = makeMag(f.def.magType); loaded += hand.rounds; }
    for (let s = 0; s < 250; s++) { const o = Math.floor(rnd() * 12);
      if (o === 0) { f.triggerPull(); f.triggerRelease(); } else if (o === 1) { f.grab(); f.drag(rnd() * 1.2); f.drag(-rnd() * 1.2); f.release(); } else if (o === 2) rack(f);
      else if (o === 3) { if (hand) { if (f.insertMag(hand)) hand = null; } else { hand = f.magRelease(); } } else if (o === 4) f.tapMag(); else if (o === 5) f.toggleSafety(); else if (o === 6) f.hammerKey();
      else if (o === 7) { if (f.loadRound()) loaded++; } else if (o === 8) f.cylinderKey(); else if (o === 9) f.ejectorRod(); else if (o === 10) f.spinCylinder(1); else { f.slideStop(true); f.slideStop(false); }
      assert.equal(f.countRounds() + (hand ? hand.rounds : 0) + ej + fired, loaded, `${id} conservation at op ${o}`);
      assert(f.slide >= 0 && f.slide <= 1);
    } }
  ok('wear scaling, catastrophic failure, ammunition conservation fuzz'); }
console.log(`firearm tests passed (${n} groups)`);

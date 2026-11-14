// Player controller: movement, health, hands and all firearm manipulation input.
import { Firearm, makeMag } from './firearm.js';
import { Inventory, itemLabel } from './inventory.js';
import { CALIBERS, WEAPONS, MAGS } from './data/weapons.js';
import { RNG } from './rng.js';
import { SURF } from './worldgen.js';

const R = 0.3, STAND = 1.75, CROUCH = 1.05;
const STEP = ['step_grass', 'step_asphalt', 'step_concrete', 'step_wood', 'step_tile', 'step_dirt'];
// firearm event -> [sound, volume]
const SND = {
  click: ['click', 0.9], dead_trigger: ['dead', 0.5], safety_block: ['dead', 0.35], slide_back: ['slide_back', 0.8], slide_fwd: ['slide_fwd', 0.9], slide_partial: ['slide_part', 0.6], slide_lock: ['slide_back', 0.7], slide_jam: ['tug', 0.7],
  mag_out: ['mag_out', 0.8], mag_tap: ['mag_tap', 0.9], mag_stuck: ['blocked', 0.9], safety: ['safety', 0.8], hammer: ['hammer', 0.8], cyl_open: ['cyl_open', 0.8], cyl_close: ['cyl_close', 0.8], cyl_spin: ['cyl_tick', 0.8], cyl_step: ['cyl_tick', 0.5],
  ejector: ['ejector', 0.8], gate: ['safety', 0.9], pump_back: ['pump_back', 0.9], pump_fwd: ['pump_fwd', 0.9], bolt_up: ['bolt_up', 0.8], bolt_back: ['bolt_back', 0.8], bolt_fwd: ['bolt_fwd', 0.8], bolt_down: ['bolt_down', 0.8],
  action_release: ['safety', 0.7], action_button: ['safety', 0.5], tug: ['tug', 0.9], tug_free: ['free', 0.9], blocked: ['blocked', 0.7], bind: ['blocked', 0.9], attach: ['attach', 0.8], slide_release: ['safety', 0.5],
};

export class Player {
  constructor(game, L) {
    this.g = game; this.pos = { x: L.spawn.x, y: 0, z: L.spawn.z }; this.vel = { x: 0, y: 0, z: 0 }; this.yaw = L.spawn.yaw; this.pitch = 0;
    this.onGround = true; this.crouched = false; this.h = STAND; this.eyeH = 1.62; this.stamina = 1; this.sprintCd = 0; this.sprinting = false; this.speed = 0;
    this.hp = 100; this.bleed = 0; this.limp = false; this.armor = { kind: 'plate', dur: 45 }; this.dead = false; this.hurtT = 0;
    this.inv = new Inventory(); this.sidearm = null; this.primary = null; this.held = null; this.hand = null; this.busy = null;
    this.aim = 0; this.inspect = 0; this.insRot = { x: 0, y: 0 }; this.lightOn = false; this.laserOn = true; this.stepAcc = 0; this.bob = 0; this.drawT = 0; this.loadT = 0; this.recP = 0; this.recY = 0; this.recRet = 0; this.shake = 0; this.lastShot = -9;
    this.journal = []; this.blockedHint = 0;
    // starting loadout: one random sidearm in a random mechanical state
    const rng = new RNG(L.start.seed), f = new Firearm(L.start.weapon).randomize(rng, { cond: rng.range(0.55, 0.85), fill: rng.range(0.4, 0.9), magChance: 1 });
    this.equip(f, true); const d = f.def;
    this.inv.add({ kind: 'ammo', cal: d.cal, n: L.start.loose });
    if (d.magType && L.start.spare) this.inv.add(makeMag(d.magType, Math.round(MAGS[d.magType].cap * L.start.spareFill)));
    this.inv.add({ kind: 'med', id: 'bandage' });
  }
  get weapon() { return this.held ? this[this.held] : null; }
  get eye() { return { x: this.pos.x, y: this.pos.y + this.eyeH, z: this.pos.z }; }
  forward() { const cp = Math.cos(this.pitch); return { x: -Math.sin(this.yaw) * cp, y: Math.sin(this.pitch), z: -Math.cos(this.yaw) * cp }; }

  // ---------- weapons ----------
  equip(f, silent) {
    const slot = f.def.slot; if (this[slot]) this.dropWeapon(slot);
    f.emit = (t, d) => this.onGunEvent(f, t, d); this[slot] = f; this.setHeld(slot); if (!silent) this.g.audio.play('cloth', 0.8);
  }
  setHeld(slot) { const w = this.weapon; if (w) { w.release(); w.triggerRelease(); w.stopHeld = false; } this.held = slot; this.drawT = 0.4; this.aim = 0; this.g.vm.setWeapon(this.weapon); }
  dropWeapon(slot) {
    const f = this[slot]; if (!f) return; f.release(); f.triggerRelease(); f.emit = () => { };
    this[slot] = null; if (this.held === slot) { this.held = null; this.g.vm.setWeapon(null); }
    const fw = this.forward(); this.g.pickups.spawn(f, { x: this.pos.x + fw.x * 0.7, y: this.pos.y + 1.0, z: this.pos.z + fw.z * 0.7 });
    this.g.audio.play('shell_drop', 0.8);
  }
  onGunEvent(f, t, d) {
    const g = this.g, a = g.audio; if (f !== this.weapon && t !== 'eject_round' && t !== 'mag_drop') return;
    const s = SND[t]; if (s) { a.play(s[0], s[1], f.def.long ? 0.82 : 1); if (f.cond < 0.4 && /slide|pump|bolt|cyl/.test(t)) a.play('grit', 0.5 * (1 - f.cond)); g.noise(this.pos.x, this.pos.z, 3, 'mech'); }
    switch (t) {
      case 'fire': this.onFire(f, d); break;
      case 'cycle': case 'cycle_lock': case 'jam_cycle': g.vm.kickSlide(); break;
      case 'eject_case': setTimeout(() => a.play(f.def.cal === '12ga' ? 'shell_drop' : 'casing', 0.5), 380); g.vm.ejectCase(f.def.cal === '12ga'); break;
      case 'eject_round': { const fw = this.forward(); g.pickups.spawn({ kind: 'ammo', cal: d.cal, n: 1 }, { x: this.pos.x + fw.x * 0.5 + fw.z * 0.3, y: this.pos.y + 1.1, z: this.pos.z + fw.z * 0.5 - fw.x * 0.3 }); setTimeout(() => a.play('casing', 0.5), 380); break; }
      case 'mag_drop': g.pickups.spawn(d.mag, { x: this.pos.x, y: this.pos.y + 0.8, z: this.pos.z }); a.play('mag_out', 0.9); setTimeout(() => a.play('shell_drop', 0.8), 350); break;
      case 'mag_in': a.play(d.seated ? 'mag_in' : 'mag_soft', 0.85); break;
      case 'round_in': a.play(f.def.cal === '12ga' ? 'shell_in' : 'round_in', 0.8); break;
      case 'catastrophic': a.play('kaboom', 1, 1, 0.5); this.shake = 0.5; this.damage(7, { self: true }); g.ui.flash(); g.noise(this.pos.x, this.pos.z, 90, 'gunshot'); break;
      case 'no_safety': case 'no_hammer': if (g.time - this.blockedHint > 6) { this.blockedHint = g.time; g.ui.msg(t === 'no_safety' ? 'This weapon has no manual safety.' : 'No external hammer on this weapon.'); } break;
    }
  }
  onFire(f, d) {
    const g = this.g, D = f.def, cal = CALIBERS[D.cal], supp = f.suppressed, sc = supp ? f.att.muzzle.cond : 0;
    if (supp && sc > 0.25) { g.audio.play('shot_supp', 0.5 + (1 - sc) * 0.5, D.long ? 0.8 : 1, 0.2); if (sc < 0.6) g.audio.play('shot_' + D.cal, (0.6 - sc) * 0.9, 1, 0.5); }
    else g.audio.play('shot_' + D.cal, 1, 1, 0.55);
    const loud = cal.noise * (supp ? 0.22 + (1 - sc) * 0.6 : 1) * (g.indoorAt(this.pos.x, this.pos.z) ? 0.75 : 1);
    g.noise(this.pos.x, this.pos.z, loud, 'gunshot');
    // recoil: fixed per-weapon pattern with a little variance; never scaled by enemy proximity
    const rc = D.recoil, k = (this.aim > 0.5 ? 0.85 : 1) * (this.crouched ? 0.9 : 1) * (d.da ? 1.1 : 1);
    this.recP += rc.pitch * 0.01745 * k * (0.88 + Math.random() * 0.24); this.recY += rc.yaw * 0.01745 * k * (Math.random() * 2 - 1); this.recRecover = rc.recover;
    g.vm.kick(rc.back, rc.pitch); this.lastShot = g.time;
    const moving = Math.min(1, this.speed / 3.3);
    let spread = (D.spread.hip + (D.spread.ads - D.spread.hip) * this.aim) * f.spreadMult() * (1 + moving * 0.5) * (d.da ? 1.35 : 1) * (this.onGround ? 1 : 2);
    if (f.att.rail && f.att.rail.id === 'laser' && this.laserOn && f.att.rail.cond > 0.2) spread = Math.min(spread, D.spread.hip * 0.45 + D.spread.ads * 0.55);
    g.ballistics.fire(this.eye, this.forward(), f, spread);
    g.onShot(f, supp);
  }

  // ---------- damage / healing ----------
  damage(amount, o = {}) {
    if (this.dead) return; const a = this.g.audio;
    if (!o.legs && !o.self && this.armor && this.armor.dur > 0) { const abs = amount * 0.6; this.armor.dur -= abs * 1.7; amount -= abs; a.play('armor_hit', 0.8); if (this.armor.dur <= 0) { this.armor = null; this.g.ui.msg('Your armor plate has shattered.'); a.play('plate', 1); } }
    this.hp -= amount; this.hurtT = 1; this.shake = Math.max(this.shake, 0.35); a.play('hurt', 0.9);
    if (!o.self) { if (Math.random() < (o.legs ? 0.6 : 0.35)) this.bleed = Math.max(this.bleed, 1); if (amount >= 20) this.bleed = 2; if (o.legs && Math.random() < 0.4 && !this.limp) { this.limp = true; this.g.ui.msg('Your leg is badly hurt.'); } }
    if (this.busy) { this.busy = null; this.g.ui.msg('Interrupted.'); }
    if (this.hp <= 0) { this.hp = 0; this.dead = true; this.g.onDeath(o.by); }
  }
  useMed(id) {
    if (this.busy || this.dead) return; const it = this.inv.first('med', id); if (!it) return this.g.ui.msg(id === 'medkit' ? 'No trauma kit.' : 'No bandages.');
    if (id === 'bandage' && !this.bleed && this.hp >= 100) return this.g.ui.msg('Nothing to bandage.');
    this.busy = { type: id, t: 0, dur: id === 'medkit' ? 4.5 : 2.4, item: it }; this.g.audio.play('bandage', 1); if (id === 'medkit') setTimeout(() => this.busy && this.g.audio.play('bandage', 1), 2000);
  }
  swapPlate(it) { const old = this.armor; this.inv.remove(it); this.armor = it; this.g.audio.play('plate', 1); if (old) { if (!this.inv.add(old)) this.g.pickups.spawn(old, this.dropPos()); } }
  dropPos() { const fw = this.forward(); return { x: this.pos.x + fw.x * 0.6, y: this.pos.y + 0.9, z: this.pos.z + fw.z * 0.6 }; }

  // ---------- item pickup ----------
  take(it) { // returns true if the world item should be removed
    const g = this.g;
    if (it.kind === 'weapon') { this.equip(it); g.ui.msg('Picked up ' + it.def.name + '. Inspect it before you trust it.'); return true; }
    if (it.kind === 'note') { if (!this.journal.includes(it.id)) this.journal.push(it.id); g.ui.showNote(it.id); g.audio.play('t_paper', 1); return true; }
    if (it.kind === 'plate' && !this.armor) { this.armor = it; g.audio.play('plate', 1); g.ui.msg('Armor plate fitted.'); return true; }
    if (it.kind === 'ammo') { const n = this.inv.add(it); if (!n) { g.ui.msg('Your pack is full.'); return false; } g.audio.play('pickup', 1); g.ui.msg(`Took ${n} × ${CALIBERS[it.cal].name}`); it.n -= n; if (it.n > 0) { g.ui.msg('Pack full — left the rest.'); return false; } return true; }
    if (it.kind === 'mag' && !this.hand && this.weapon && this.weapon.def.magType === it.type && !this.inv.add(it)) { this.hand = it; g.vm.setHand(it); g.audio.play('pickup', 1); return true; }
    if (this.inv.items.includes(it) || this.inv.add(it)) { g.audio.play('pickup', 1); g.ui.msg('Took ' + itemLabel(it)); return true; }
    g.ui.msg('Your pack is full.'); return false;
  }
  stowHand() { const h = this.hand; if (!h) return; this.hand = null; this.g.vm.setHand(null); if (h.kind === 'mag') { if (!this.inv.add(h)) { this.g.pickups.spawn(h, this.dropPos()); this.g.ui.msg('No room — dropped the magazine.'); } } }

  // ---------- per-frame ----------
  update(dt, inp, active) {
    const g = this.g, W = g.world; if (this.dead) return;
    const f = this.weapon, grabbing = !!(f && f.grabbed); this.lookDX = 0; this.lookDY = 0;
    // ----- look -----
    const zoom = g.zoom || 1, s = 0.0022 * g.settings.sens / zoom;
    const inspecting = active && inp.down('inspect');
    this.inspect += ((inspecting ? 1 : 0) - this.inspect) * Math.min(1, dt * 9);
    if (active) {
      if (grabbing) f.drag(inp.dy / 150);
      else if (inspecting) { this.insRot.y += inp.dx * 0.006; this.insRot.x = Math.max(-1.2, Math.min(1.2, this.insRot.x + inp.dy * 0.006)); }
      else { this.yaw -= inp.dx * s; this.pitch -= inp.dy * s * (g.settings.invertY ? -1 : 1); this.lookDX = inp.dx; this.lookDY = inp.dy; }
    }
    if (!inspecting) { this.insRot.x *= 1 - Math.min(1, dt * 6); this.insRot.y *= 1 - Math.min(1, dt * 6); }
    // recoil impulse then partial recovery
    if (this.recP > 1e-5 || Math.abs(this.recY) > 1e-5) { const k = Math.min(1, dt * 28), ap = this.recP * k, ay = this.recY * k; this.pitch += ap; this.yaw += ay; this.recP -= ap; this.recY -= ay; this.recRet += ap * (this.recRecover ?? 0.6); }
    else if (this.recRet > 1e-5) { const r = this.recRet * Math.min(1, dt * 6); this.pitch -= r; this.recRet -= r; }
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
    // ----- movement -----
    let mx = 0, mz = 0; if (active) { if (inp.down('forward')) mz += 1; if (inp.down('back')) mz -= 1; if (inp.down('right')) mx += 1; if (inp.down('left')) mx -= 1; }
    if (active && inp.hit('crouch')) { if (!this.crouched) this.crouched = true; else if (W.ceilingAt(this.pos.x, this.pos.z, R, this.pos.y + CROUCH) >= this.pos.y + STAND) this.crouched = false; }
    const th = this.crouched ? CROUCH : STAND; this.h += (th - this.h) * Math.min(1, dt * 12); this.eyeH = this.h - 0.13;
    const wantAim = active && inp.rmb && f && !this.busy && !inspecting && this.drawT <= 0;
    this.sprinting = active && inp.down('sprint') && mz > 0 && !this.crouched && !wantAim && this.stamina > 0.02 && !this.busy && !this.limp;
    if (this.sprinting) { this.stamina = Math.max(0, this.stamina - dt / 8); this.sprintCd = 1.2; } else { this.sprintCd -= dt; if (this.sprintCd <= 0) this.stamina = Math.min(1, this.stamina + dt / 6); }
    let sp = this.crouched ? 1.7 : this.sprinting ? 6.0 : 3.3; if (wantAim) sp = Math.min(sp, 2.0); if (this.limp) sp *= 0.7; if (this.busy) sp *= 0.5; if (f && f.def.mass > 5 && !this.crouched) sp *= 0.93;
    const len = Math.hypot(mx, mz) || 1, sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const wx = (-sy * mz + cy * mx) / len * sp * (mx || mz ? 1 : 0), wz = (-cy * mz - sy * mx) / len * sp * (mx || mz ? 1 : 0);
    const acc = this.onGround ? 14 : 2.5; this.vel.x += (wx - this.vel.x) * Math.min(1, dt * acc); this.vel.z += (wz - this.vel.z) * Math.min(1, dt * acc);
    if (active && inp.hit('jump') && this.onGround && !this.busy) { this.vel.y = 4.7; this.onGround = false; }
    this.vel.y -= 13 * dt;
    const steps = Math.max(1, Math.ceil(Math.hypot(this.vel.x, this.vel.z) * dt / 0.2));
    for (let i = 0; i < steps; i++) { this.pos.x += this.vel.x * dt / steps; this.pos.z += this.vel.z * dt / steps; W.collide(this.pos, R, this.pos.y + 0.45, this.pos.y + this.h); }
    this.pos.x = Math.max(1.4, Math.min(W.size - 1.4, this.pos.x)); this.pos.z = Math.max(1.4, Math.min(W.size - 1.4, this.pos.z));
    if (this.vel.y > 0) { const c = W.ceilingAt(this.pos.x, this.pos.z, R, this.pos.y + this.h); if (this.pos.y + this.h + this.vel.y * dt > c - 0.05) this.vel.y = 0; }
    this.pos.y += this.vel.y * dt;
    const ground = W.groundAt(this.pos.x, this.pos.z, R, this.pos.y);
    if (this.pos.y <= ground + 0.001 && this.vel.y <= 0) { if (!this.onGround && this.vel.y < -5) { g.audio.play('land', 0.8); g.noise(this.pos.x, this.pos.z, 9, 'step'); if (this.vel.y < -9.5) this.damage((-this.vel.y - 9) * 6, { self: true }); } this.pos.y += (ground - this.pos.y) * Math.min(1, dt * 18); if (ground - this.pos.y < 0.02) this.pos.y = ground; this.vel.y = 0; this.onGround = true; }
    else this.onGround = this.pos.y - ground < 0.05 && this.vel.y <= 0;
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && this.speed > 0.5) {
      this.stepAcc += this.speed * dt; this.bob += this.speed * dt * (this.sprinting ? 1.5 : 1.9);
      if (this.stepAcc > (this.sprinting ? 2.1 : this.crouched ? 1.2 : 1.6)) { this.stepAcc = 0; const surf = this.pos.y > 0.2 ? SURF.WOOD : g.L.surf[(this.pos.x | 0) + (this.pos.z | 0) * g.L.W]; g.audio.play(STEP[surf] || 'step_concrete', this.crouched ? 0.25 : this.sprinting ? 0.9 : 0.55, this.limp ? 0.85 : 1, g.indoor ? 0.4 : 0.1); g.noise(this.pos.x, this.pos.z, this.crouched ? 2.5 : this.sprinting ? 15 : 7, 'step'); }
    }
    // ----- status -----
    if (this.bleed) { this.hp -= (this.bleed === 2 ? 0.9 : 0.35) * dt; if (this.hp <= 0) { this.hp = 0; this.dead = true; g.onDeath('blood loss'); return; } }
    this.hurtT = Math.max(0, this.hurtT - dt * 1.2); this.shake = Math.max(0, this.shake - dt * 1.5);
    if (this.busy) { this.busy.t += dt; if (this.busy.t >= this.busy.dur) { const b = this.busy; this.busy = null; this.inv.remove(b.item); if (b.type === 'medkit') { this.hp = Math.min(100, this.hp + 50); this.bleed = 0; this.limp = false; g.ui.msg('Wounds dressed.'); } else { this.hp = Math.min(100, this.hp + 6); this.bleed = 0; g.ui.msg('Bleeding stopped.'); } } }
    this.drawT = Math.max(0, this.drawT - dt);
    const aimSpeed = f ? (f.def.mass > 5 ? 3.2 : f.def.long ? 4.5 : 8) : 8; this.aim += ((wantAim ? 1 : 0) - this.aim) * Math.min(1, dt * aimSpeed); if (this.aim < 0.002) this.aim = 0;
    if (!active) { if (f) { f.triggerRelease(); if (f.grabbed) f.release(); } return; }
    // ----- hands / weapon manipulation -----
    if (inp.hit('sidearm')) this.setHeld(this.held === 'sidearm' ? null : this.sidearm ? 'sidearm' : this.held);
    if (inp.hit('primary')) this.setHeld(this.held === 'primary' ? null : this.primary ? 'primary' : this.held);
    if (inp.hit('bandage')) this.useMed('bandage'); if (inp.hit('medkit')) this.useMed('medkit');
    if (inp.hit('light')) { this.lightOn = !this.lightOn; g.audio.play('safety', 0.6); }
    if (inp.hit('laser')) { this.laserOn = !this.laserOn; g.audio.play('safety', 0.4); }
    if (this.busy) { if (f) { f.triggerRelease(); if (f.grabbed) f.release(); } return; }
    if (inp.hit('drawMag')) {
      if (this.hand) this.stowHand();
      else { const type = f && f.def.magType, list = this.inv.mags(type || undefined).sort((a, b) => (inp.down('sprint') ? a.rounds - b.rounds : b.rounds - a.rounds)); if (list.length) { this.hand = list[0]; this.inv.remove(list[0]); g.vm.setHand(this.hand); g.audio.play('cloth', 0.7); } else g.ui.msg(type ? 'No spare magazine for this weapon.' : 'No magazines in your pack.'); }
    }
    this.loadT -= dt;
    if (inp.hit('loadRound')) this.loadT = 0;
    if (inp.down('loadRound') && this.loadT <= 0) {
      this.loadT = 0.42;
      if (this.hand && this.hand.kind === 'mag') { const m = this.hand; if (m.rounds >= m.cap) g.ui.msg('Magazine is full.'); else if (this.inv.takeRound(m.cal)) { m.rounds++; g.audio.play('round_in', 0.8); g.vm.handBump(); } else g.ui.msg(`No loose ${CALIBERS[m.cal].name}.`); }
      else if (f) { if (this.inv.ammo(f.def.cal) <= 0) g.ui.msg(`No loose ${CALIBERS[f.def.cal].name}.`); else if (f.loadRound()) { this.inv.takeRound(f.def.cal); g.vm.handBump(f.def.cal); } else g.audio.play('blocked', 0.5); }
    }
    if (!f || this.drawT > 0) return;
    if (inp.lmbP && !grabbing) f.triggerPull(); if (inp.lmbR || !inp.lmb) f.triggerRelease();
    if (inp.hit('action')) f.grab(); if (f.grabbed && !inp.down('action')) f.release();
    if (inp.hit('slideStop')) f.slideStop(true); if (inp.up('slideStop')) f.slideStop(false);
    if (inp.hit('safety')) f.toggleSafety(); if (inp.hit('hammer')) f.hammerKey();
    if (inp.wheel && f.cyl) f.spinCylinder(inp.wheel);
    if (inp.hit('tap')) { if (f.cyl) f.ejectorRod(); else if (!f.tapMag()) g.audio.play('blocked', 0.4); }
    if (inp.hit('mag')) {
      if (f.cyl) f.cylinderKey();
      else if (f.def.feed === 'mag') {
        if (f.mag) { const m = f.magRelease(); if (m) { if (this.hand) { g.pickups.spawn(m, { x: this.pos.x, y: this.pos.y + 0.9, z: this.pos.z }); setTimeout(() => g.audio.play('shell_drop', 0.8), 350); } else { this.hand = m; g.vm.setHand(m); } } }
        else if (this.hand && this.hand.kind === 'mag') { if (f.insertMag(this.hand)) { this.hand = null; g.vm.setHand(null); } else { g.audio.play('blocked', 0.8); g.ui.msg('That magazine does not fit.'); } }
        else g.ui.msg('No magazine in hand — draw one first.');
      }
    }
    if (inp.hit('drop')) this.dropWeapon(this.held);
  }
}

// Mechanical firearm simulation. Pure logic (no rendering) so it can be unit-tested.
// Every weapon is an internal mechanical state; the player manipulates components and
// the gun only fires if the mechanism is actually ready.
import { WEAPONS, MAGS, ATTACHMENTS } from './data/weapons.js';

export function makeMag(type, rounds) {
  const m = MAGS[type];
  return { kind: 'mag', type, cal: m.cal, cap: m.cap, rounds: Math.max(0, Math.min(rounds ?? m.cap, m.cap)) };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Firearm {
  constructor(id, opts = {}) {
    this.kind = 'weapon';
    this.id = id; this.def = WEAPONS[id];
    this.rand = opts.rand || Math.random;
    this.emit = opts.emit || (() => {});
    this.cond = opts.cond ?? 0.8;
    this.broken = false; this.brokenText = '';
    this.mag = null; this.magSeated = true;
    this.internal = 0;            // rounds in tube / internal magazine
    this.chamber = null;          // null | 'live' | 'spent'
    this.staged = false;          // loose round dropped into the open action
    this.lifter = false;          // pump: shell on the carrier
    this.slide = 0;               // slide / bolt / pump position: 0 = in battery, 1 = fully rearward
    this.slideLocked = false;
    this.hammer = 0;              // 0 down, 1 half-cock (SAA), 2 cocked (also striker / internal hammer)
    this.safety = false;
    this.jam = null;              // null | 'ftf' | 'stovepipe' | 'doublefeed' | 'stuck' | 'bind'
    this.jamRound = false; this.tugs = 0; this.tugArmed = true;
    this.pulledFull = false; this.wentBack = false;
    this.grabbed = false; this.stopHeld = false; this.triggerHeld = false; this.actionLocked = false;
    this.cyl = this.def.action === 'revolver' ? new Array(this.def.cap).fill(null) : null;
    this.cylIndex = 0; this.cylOpen = false; this.gateOpen = false;
    this.att = { optic: null, rail: null, muzzle: null };
    this.shots = 0;
  }

  // ---------- derived helpers ----------
  get isAuto() { const a = this.def.action; return a === 'pistol' || a === 'rifle_semi' || a === 'semi_shotgun'; }
  get wearFactor() { return clamp((0.75 - this.cond) / 0.75, 0, 1); }
  get pMalf() { return (0.002 + 0.14 * Math.pow(this.wearFactor, 1.6)) * (this.def.malfScale ?? 1); }
  get pLight() { return 0.001 + 0.07 * Math.pow(this.wearFactor, 1.6); }
  get suppressed() { return !!this.att.muzzle; }
  get jamRest() { return this.jam === 'stovepipe' ? 0.35 : this.jam === 'ftf' ? (this.isAuto ? 0.3 : 0) : this.jam === 'doublefeed' ? 0.4 : 0; }
  get inBattery() { return this.slide <= 0.02 && !this.slideLocked; }
  hasFeed() { return this.def.feed === 'mag' ? !!(this.mag && this.magSeated && this.mag.rounds > 0) : this.internal > 0; }
  takeFeed() { if (this.def.feed === 'mag') this.mag.rounds--; else this.internal--; }
  countRounds() {
    let n = (this.chamber === 'live' ? 1 : 0) + (this.staged ? 1 : 0) + (this.lifter ? 1 : 0) + (this.jamRound ? 1 : 0) + this.internal + (this.mag ? this.mag.rounds : 0);
    if (this.cyl) n += this.cyl.filter(c => c === 'live').length;
    return n;
  }
  damageMult() { return 0.72 + 0.28 * clamp(this.cond / 0.45, 0, 1); }
  spreadMult() { return 1 + 1.6 * this.wearFactor; }
  conditionText() {
    if (this.broken) return 'DESTROYED — ' + this.brokenText;
    const c = this.cond;
    if (c >= 0.85) return 'Clean. Tight lockup, a film of oil. Someone looked after this.';
    if (c >= 0.65) return 'Serviceable. Honest wear on the edges, action a little gritty.';
    if (c >= 0.45) return 'Worn. Surface rust blooming, parts rattle against each other.';
    if (c >= 0.27) return 'Poor. Pitted steel and tired springs. Expect stoppages.';
    if (c >= 0.15) return 'Failing. Deep corrosion, play in every joint. It will let you down.';
    return 'Unsafe. Hairline cracks at the locking surfaces. Firing this is a gamble.';
  }

  // ---------- attachments ----------
  canAttach(attId) { const a = ATTACHMENTS[attId]; if (!a) return false; const list = this.def.attach[a.slot]; return !!(list && list.includes(attId)); }
  attach(item) { // item: {kind:'att', id, cond}; returns previously mounted item or null
    if (!this.canAttach(item.id)) return false;
    const slot = ATTACHMENTS[item.id].slot; const prev = this.att[slot];
    this.att[slot] = item; this.emit('attach', { slot });
    return prev || null;
  }
  detach(slot) { const it = this.att[slot]; this.att[slot] = null; if (it) this.emit('attach', { slot }); return it; }

  // ---------- firing core ----------
  _shotFired(da) {
    this.shots++;
    this.cond = Math.max(0.02, this.cond - this.def.wear * (this.att.muzzle ? 1.35 : 1));
    for (const s of ['optic', 'rail', 'muzzle']) { const a = this.att[s]; if (a) a.cond = Math.max(0, a.cond - (s === 'muzzle' ? 0.004 : s === 'optic' ? 0.0018 : 0.0012) * (this.def.cal === '12ga' || this.def.cal === '.308' ? 1.6 : 1)); }
    this.emit('fire', { da: !!da, suppressed: this.suppressed });
    if (this.cond < 0.15 && this.rand() < 0.012 + (0.15 - this.cond) * 0.45) { this._catastrophic(); return true; }
    return false;
  }
  _catastrophic() {
    this.broken = true; this.jam = null; this.slide = this.cyl ? 0 : 0.45; this.slideLocked = false; this.hammer = 0; this.actionLocked = false;
    const a = this.def.action;
    this.brokenText = a === 'revolver' ? 'the top strap has split and the cylinder is seized.'
      : a === 'pump' ? 'the barrel has bulged and split ahead of the chamber.'
      : a === 'bolt' ? 'a locking lug has sheared. The bolt is welded half-open.'
      : a === 'pistol' ? 'the slide has cracked through at the ejection port and jumped its rails.'
      : 'the bolt carrier has fractured and wedged in the receiver.';
    this.emit('catastrophic', {});
  }
  _blocked() { this.emit('blocked', {}); }

  // ---------- trigger ----------
  triggerPull() {
    if (this.triggerHeld) return; this.triggerHeld = true;
    if (this.broken) return this.emit('dead_trigger', {});
    switch (this.def.action) {
      case 'revolver': return this._triggerRevolver();
      case 'pump': case 'bolt': return this._triggerManual();
      default: return this._triggerAuto();
    }
  }
  triggerRelease() { this.triggerHeld = false; }

  _triggerAuto() {
    const D = this.def;
    if (this.safety) return this.emit('safety_block', {});
    if (!this.inBattery) return this.emit('dead_trigger', {});
    let da = false;
    if (this.hammer !== 2) { if (D.trigger === 'dasa') da = true; else return this.emit('dead_trigger', {}); }
    this.hammer = 0;
    if (this.chamber !== 'live') return this.emit('click', {});
    if (this.rand() < this.pLight) return this.emit('click', { light: true });
    this.chamber = 'spent';
    if (this._shotFired(da)) return;
    this._cycleAuto();
  }
  _cycleAuto() {
    const D = this.def;
    if (D.feed === 'mag' && this.mag && !this.magSeated && this.rand() < 0.4) { const m = this.mag; this.mag = null; this.emit('mag_drop', { mag: m }); }
    const p = this.pMalf, r = this.rand();
    if (r < p * 0.35) { this.chamber = null; this.hammer = 2; this.jam = 'stovepipe'; this.slide = 0.35; return this.emit('jam_cycle', {}); }
    if (r < p * 0.6) { this.jam = 'stuck'; this.tugs = 2 + Math.floor(this.rand() * 3); this.tugArmed = true; this.slide = 0; return this.emit('jam_dead', {}); }
    if (r < p * 0.8 && D.feed === 'mag' && this.hasFeed()) { this.takeFeed(); this.jamRound = true; this.hammer = 2; this.jam = 'doublefeed'; this.slide = 0.4; return this.emit('jam_cycle', {}); }
    this.emit('eject_case', {}); this.chamber = null; this.hammer = 2;
    if (this.hasFeed()) {
      if (this.rand() < p * 0.5) { this.jam = 'ftf'; this.slide = 0.3; return this.emit('jam_cycle', {}); }
      this.takeFeed(); this.chamber = 'live'; return this.emit('cycle', {});
    }
    if (D.slideLock && (D.feed === 'tube' || (this.mag && this.magSeated))) { this.slideLocked = true; this.slide = 1; return this.emit('cycle_lock', {}); }
    this.emit('cycle', {});
  }
  _triggerManual() {
    if (this.safety) return this.emit('safety_block', {});
    if (this.slide > 0.02 || this.hammer !== 2) return this.emit('dead_trigger', {});
    this.hammer = 0; this.actionLocked = false;
    if (this.chamber !== 'live') return this.emit('click', {});
    if (this.rand() < this.pLight) return this.emit('click', { light: true });
    this.chamber = 'spent';
    if (this._shotFired(false)) return;
    if (this.rand() < this.pMalf * 0.6) { this.jam = 'stuck'; this.tugs = 2 + Math.floor(this.rand() * 3); this.tugArmed = true; }
  }
  _triggerRevolver() {
    const D = this.def;
    if (this.cylOpen) return this.emit('dead_trigger', {});
    if (this.jam === 'bind') return this.emit('bind', {});
    let da = false;
    if (D.revolver === 'sa') { if (this.hammer !== 2 || this.gateOpen) return this.emit('dead_trigger', {}); }
    else if (this.hammer !== 2) { da = true; this.cylIndex = (this.cylIndex + 1) % D.cap; this.emit('cyl_step', {}); }
    this.hammer = 0;
    if (this.cyl[this.cylIndex] !== 'live') return this.emit('click', {});
    if (this.rand() < this.pLight) return this.emit('click', { light: true });
    this.cyl[this.cylIndex] = 'spent';
    if (this._shotFired(da)) return;
    if (this.rand() < this.pMalf * 0.8) this.jam = 'bind';
  }

  // ---------- slide / bolt / pump manipulation (mouse-driven while grabbed) ----------
  grab() { if (this.grabbed) return; this.grabbed = true; this.pulledFull = this.isAuto && this.slide >= 0.88; }
  drag(d) { // d > 0 pulls rearward. Units: fraction of full travel.
    if (!this.grabbed || d === 0) return;
    if (this.broken || this.cyl) { if (d > 0) this._blocked(); return; }
    if (this.def.action === 'pump') this._dragPump(d); else if (this.def.action === 'bolt') this._dragBolt(d); else this._dragAuto(d);
  }
  release() {
    if (!this.grabbed) return; this.grabbed = false;
    if (this.broken || !this.isAuto) return;
    if (!this.pulledFull) { const rest = this.slideLocked ? 1 : this.jamRest; if (Math.abs(this.slide - rest) > 0.05) this.emit('slide_partial', {}); this.slide = rest; return; }
    this.pulledFull = false;
    if (this.jam === 'doublefeed' && this.stopHeld) { this.slideLocked = true; this.slide = 1; return this.emit('slide_lock', {}); }
    const D = this.def;
    const emptyLock = D.slideLock && (D.feed === 'tube' ? (this.internal === 0 && !this.staged && this.def.action === 'semi_shotgun') : !!(this.mag && this.magSeated && this.mag.rounds === 0));
    if (this.stopHeld || emptyLock) { this.slideLocked = true; this.slide = 1; return this.emit('slide_lock', {}); }
    this._goForward();
  }
  _clearDouble() { this.chamber = null; this.jam = null; this.emit('eject_case', {}); if (this.jamRound) { this.jamRound = false; this.emit('eject_round', { cal: this.def.cal }); } }
  _goForward() {
    this.slideLocked = false;
    if (this.jam === 'doublefeed') { // with the magazine stripped the mess falls clear; otherwise it slams back onto the jam
      if (this.mag) { this.slide = 0.4; return this.emit('slide_jam', {}); }
      this._clearDouble();
    }
    if (this.staged) { this.staged = false; this.chamber = 'live'; this.slide = 0; return this.emit('slide_fwd', { fed: true }); }
    if (this.chamber === null && this.hasFeed()) {
      if (this.rand() < this.pMalf * 0.5) { this.jam = 'ftf'; this.slide = 0.3; return this.emit('slide_jam', {}); }
      this.takeFeed(); this.chamber = 'live'; this.slide = 0; return this.emit('slide_fwd', { fed: true });
    }
    this.slide = 0; this.emit('slide_fwd', { fed: false });
  }
  _tug(s, max, prev) { // stuck action: repeated forceful tugs free it
    if (s >= max && this.tugArmed && prev < max) {
      this.tugArmed = false; this.tugs--;
      if (this.tugs <= 0) { this.jam = null; this.emit('tug_free', {}); } else this.emit('tug', {});
    }
  }
  _eject() {
    if (this.chamber === 'live') this.emit('eject_round', { cal: this.def.cal }); else if (this.chamber === 'spent') this.emit('eject_case', {});
    this.chamber = null;
  }
  _dragAuto(d) {
    const D = this.def;
    if (D.safetyLocksSlide && this.safety) { if (d > 0) this._blocked(); return; }
    const prev = this.slide;
    const max = this.jam === 'stuck' ? 0.12 : 1;
    const min = this.slideLocked ? 1 : this.jamRest;
    let s = clamp(prev + d, Math.min(min, max), max);
    if (this.jam === 'stuck') { if (s <= 0.03) this.tugArmed = true; this._tug(s, max, prev); }
    if (prev < 0.3 && s >= 0.3 && this.hammer !== 2) { this.hammer = 2; if (D.extHammer) this.emit('hammer', { pos: 2, quiet: true }); }
    if (!this.pulledFull && s >= 0.88) {
      this.pulledFull = true; this.hammer = 2;
      if (this.jam === 'stovepipe') { this.jam = null; this.emit('eject_case', {}); }
      else if (this.jam === 'doublefeed') {
        if (!this.mag) this._clearDouble();
      } else { if (this.jam === 'ftf') this.jam = null; this._eject(); }
      this.emit('slide_back', {});
    }
    this.slide = s;
  }
  _dragPump(d) {
    const prev = this.slide;
    if (this.actionLocked && prev <= 0.001) {
      if (d <= 0) return;
      if (!this.stopHeld) return this._blocked();
      this.actionLocked = false; this.emit('action_release', {});
    }
    const max = this.jam === 'stuck' ? 0.1 : 1, min = this.jam === 'ftf' ? 0.5 : 0;
    let s = clamp(prev + d, min, Math.max(min, max));
    if (this.jam === 'stuck') { if (s <= 0.03) this.tugArmed = true; this._tug(s, max, prev); }
    if (prev < 0.9 && s >= 0.9) {
      if (this.jam === 'ftf') this.jam = null;
      else {
        this._eject(); this.hammer = 2;
        if (!this.lifter && !this.staged && this.internal > 0) { this.internal--; this.lifter = true; if (this.rand() < this.pMalf * 0.5) this.jam = 'ftf'; }
      }
      this.emit('pump_back', {});
    }
    if (prev > 0.05 && s <= 0.05) {
      if (this.lifter || this.staged) { if (this.chamber === null) this.chamber = 'live'; this.lifter = false; this.staged = false; }
      s = 0; if (this.hammer === 2) this.actionLocked = true; this.emit('pump_fwd', {});
    }
    this.slide = s;
  }
  _dragBolt(d) {
    const prev = this.slide;
    const max = this.jam === 'stuck' ? 0.25 : 1, min = this.jam === 'ftf' ? 0.6 : 0;
    let s = clamp(prev + d, min, Math.max(min, max));
    if (this.jam === 'stuck') { if (s <= 0.05) this.tugArmed = true; this._tug(s, max, prev); }
    if (prev < 0.2 && s >= 0.2) { this.hammer = 2; this.emit('bolt_up', {}); }
    if (prev < 0.95 && s >= 0.95) {
      if (this.jam === 'ftf') this.jam = null; else this._eject();
      this.wentBack = true; this.emit('bolt_back', {});
    }
    if (prev > 0.6 && s <= 0.6 && this.wentBack && !this.jam) {
      this.wentBack = false;
      if (this.staged) { this.staged = false; this.chamber = 'live'; }
      else if (this.chamber === null && this.hasFeed()) {
        if (this.rand() < this.pMalf * 0.5) { this.jam = 'ftf'; s = 0.6; this.wentBack = true; this.emit('slide_jam', {}); }
        else { this.takeFeed(); this.chamber = 'live'; }
      }
      if (!this.jam) this.emit('bolt_fwd', {});
    }
    if (prev > 0.02 && s <= 0.02) { s = 0; this.emit('bolt_down', {}); }
    this.slide = s;
  }

  // ---------- slide stop / bolt catch / action release ----------
  slideStop(down) {
    this.stopHeld = down;
    if (!down || this.broken) return;
    if (this.isAuto && this.slideLocked && !this.grabbed) { this.emit('slide_release', {}); this._goForward(); }
    else if (this.def.action === 'pump' && this.actionLocked) this.emit('action_button', {});
  }

  // ---------- magazine ----------
  magRelease() {
    if (this.def.feed !== 'mag' || !this.mag) return null;
    if (this.jam === 'doublefeed' && !this.slideLocked) { this.emit('mag_stuck', {}); return null; }
    const m = this.mag; this.mag = null; this.magSeated = true; this.emit('mag_out', {}); return m;
  }
  insertMag(mag) {
    if (this.def.feed !== 'mag' || this.mag || mag.type !== this.def.magType) return false;
    this.mag = mag;
    this.magSeated = this.broken ? true : !(this.rand() < 0.01 + 0.15 * this.wearFactor);
    this.emit('mag_in', { seated: this.magSeated }); return true;
  }
  tapMag() { if (this.def.feed !== 'mag' || !this.mag) return false; this.magSeated = true; this.emit('mag_tap', {}); return true; }

  // ---------- safety / hammer ----------
  toggleSafety() {
    const D = this.def;
    if (this.broken) return this._blocked();
    if (!D.safety || D.safety === 'none') return this.emit('no_safety', {});
    if (!this.safety) {
      if (D.safety === 'decocker') { this.hammer = 0; this.safety = true; return this.emit('safety', { on: true, decock: true }); }
      if (D.safetyNeedsCock && this.hammer !== 2) return this._blocked();
      if (D.safetyLocksSlide && this.slide > 0.02) return this._blocked();
      this.safety = true;
    } else this.safety = false;
    this.emit('safety', { on: this.safety });
  }
  hammerKey() {
    const D = this.def;
    if (this.broken) return this._blocked();
    if (D.action === 'revolver') {
      if (this.cylOpen || this.jam === 'bind') return this._blocked();
      if (D.revolver === 'sa') {
        if (this.hammer === 2) { if (this.triggerHeld) { this.hammer = 0; this.emit('hammer', { pos: 0 }); } else this._blocked(); return; }
        this.hammer++;
        if (this.hammer === 2) { this.cylIndex = (this.cylIndex + 1) % D.cap; this.emit('cyl_step', {}); }
        return this.emit('hammer', { pos: this.hammer });
      }
      if (this.hammer === 2) { if (this.triggerHeld) { this.hammer = 0; this.emit('hammer', { pos: 0 }); } else this._blocked(); return; }
      this.hammer = 2; this.cylIndex = (this.cylIndex + 1) % D.cap; this.emit('cyl_step', {}); return this.emit('hammer', { pos: 2 });
    }
    if (!D.extHammer) return this.emit('no_hammer', {});
    if (this.safety && D.safety === 'decocker') return this._blocked();
    if (this.hammer === 2) { if (this.triggerHeld && !this.safety) { this.hammer = 0; this.emit('hammer', { pos: 0 }); } else this._blocked(); return; }
    this.hammer = 2; this.emit('hammer', { pos: 2 });
  }

  // ---------- revolver cylinder ----------
  cylinderKey() { // swing-out latch (DA) or loading gate (SA)
    const D = this.def; if (!this.cyl) return false;
    if (this.broken) { this._blocked(); return true; }
    if (D.revolver === 'da') {
      if (!this.cylOpen && this.hammer === 2) { this._blocked(); return true; }
      this.cylOpen = !this.cylOpen;
      if (this.cylOpen && this.jam === 'bind') this.jam = null;
      this.emit(this.cylOpen ? 'cyl_open' : 'cyl_close', {});
    } else { this.gateOpen = !this.gateOpen; this.emit('gate', { open: this.gateOpen }); }
    return true;
  }
  get loadIndex() { return this.def.revolver === 'sa' ? (this.cylIndex + 1) % this.def.cap : this.cylIndex; }
  spinCylinder(dir) {
    if (!this.cyl || this.broken) return;
    const free = this.def.revolver === 'da' ? this.cylOpen : (this.gateOpen && this.hammer === 1);
    if (!free) return this._blocked();
    if (this.jam === 'bind') this.jam = null;
    this.cylIndex = (this.cylIndex + (dir > 0 ? 1 : this.def.cap - 1)) % this.def.cap; this.emit('cyl_spin', {});
  }
  ejectorRod() {
    const D = this.def; if (!this.cyl) return false;
    if (this.broken) { this._blocked(); return true; }
    if (D.revolver === 'da') {
      if (!this.cylOpen) { this._blocked(); return true; }
      let stuck = false;
      for (let i = 0; i < D.cap; i++) {
        const c = this.cyl[i]; if (!c) continue;
        if (c === 'spent' && this.rand() < this.wearFactor * 0.35) { stuck = true; continue; } // swollen case stays put
        this.cyl[i] = null; this.emit(c === 'live' ? 'eject_round' : 'eject_case', { cal: D.cal });
      }
      this.emit('ejector', { stuck });
    } else {
      if (!this.gateOpen || this.hammer !== 1) { this._blocked(); return true; }
      const i = this.loadIndex, c = this.cyl[i];
      if (c) { this.cyl[i] = null; this.emit(c === 'live' ? 'eject_round' : 'eject_case', { cal: D.cal }); }
      this.emit('ejector', {});
    }
    return true;
  }

  // ---------- loading single rounds directly into the gun ----------
  // Returns true if a round was accepted (caller removes it from inventory).
  loadRound() {
    const D = this.def;
    if (this.broken) return false;
    if (D.action === 'revolver') {
      if (D.revolver === 'da') {
        if (!this.cylOpen) return false;
        for (let k = 0; k < D.cap; k++) { const i = (this.cylIndex + k) % D.cap; if (this.cyl[i] === null) { this.cyl[i] = 'live'; this.emit('round_in', { where: 'cyl' }); return true; } }
        return false;
      }
      if (!this.gateOpen || this.hammer !== 1 || this.cyl[this.loadIndex] !== null) return false;
      this.cyl[this.loadIndex] = 'live'; this.emit('round_in', { where: 'cyl' }); return true;
    }
    const open = this.isAuto ? this.slideLocked : this.slide >= 0.9;
    const canStage = open && this.chamber === null && !this.staged && !this.lifter && !this.jam;
    if (D.feed === 'tube') {
      if (canStage && (D.action === 'pump' || this.internal === 0)) { this.staged = true; this.emit('round_in', { where: 'port' }); return true; }
      if (this.internal < D.cap) { this.internal++; this.emit('round_in', { where: 'tube' }); return true; }
      return false;
    }
    if (D.feed === 'internal') {
      if (!open) return false;
      if (this.internal < D.cap) { this.internal++; this.emit('round_in', { where: 'internal' }); return true; }
      if (canStage) { this.staged = true; this.emit('round_in', { where: 'port' }); return true; }
      return false;
    }
    if (canStage) { this.staged = true; this.emit('round_in', { where: 'port' }); return true; }
    return false;
  }

  // ---------- randomised found/starting state ----------
  randomize(rng, opts = {}) {
    const D = this.def, r = () => rng.next();
    this.cond = opts.cond ?? rng.range(0.22, 0.95);
    const fill = opts.fill ?? rng.range(0, 1);
    if (D.feed === 'mag') {
      if (opts.mag !== false && rng.chance(opts.magChance ?? 0.8)) { this.mag = makeMag(D.magType, Math.round(MAGS[D.magType].cap * fill)); this.magSeated = true; }
      if (this.mag && this.mag.rounds > 0 && rng.chance(0.5)) { this.mag.rounds--; this.chamber = 'live'; }
    } else if (D.feed === 'cyl') {
      for (let i = 0; i < D.cap; i++) this.cyl[i] = r() < fill ? 'live' : (r() < 0.25 ? 'spent' : null);
    } else {
      this.internal = Math.round(D.cap * fill);
      if (this.internal > 0 && rng.chance(0.4)) { this.internal--; this.chamber = 'live'; }
    }
    // cocked state must be mechanically consistent
    if (this.isAuto) {
      this.hammer = this.chamber || rng.chance(0.5) ? 2 : (D.trigger === 'striker' ? 2 : 0);
      if (D.trigger === 'dasa' && rng.chance(0.6)) this.hammer = 0;
      if (D.safety === 'manual' && (!D.safetyNeedsCock || this.hammer === 2) && rng.chance(0.5)) this.safety = true;
      if (D.safety === 'decocker' && this.hammer === 0 && rng.chance(0.4)) this.safety = true;
    } else if (D.action === 'pump' || D.action === 'bolt') {
      this.hammer = this.chamber ? 2 : (rng.chance(0.5) ? 2 : 0);
      if (D.action === 'pump' && this.hammer === 2) this.actionLocked = true;
      if (rng.chance(0.4)) this.safety = true;
    }
    return this;
  }
}

// Physical carry capacity: everything in the pack has bulk; ammunition is counted round by round.
import { CALIBERS, MAGS, ATTACHMENTS, WEAPONS } from './data/weapons.js';
export const CAPACITY = 30;
export function itemUnits(it) {
  switch (it.kind) {
    case 'ammo': return CALIBERS[it.cal].unit * it.n;
    case 'mag': return MAGS[it.type].unit + CALIBERS[it.cal].unit * it.rounds * 0.5;
    case 'att': return ATTACHMENTS[it.id].unit;
    case 'med': return it.id === 'medkit' ? 3 : 1;
    case 'plate': return 6;
    default: return 0;
  }
}
const fill = (m) => m.rounds === 0 ? 'empty' : m.rounds >= m.cap ? 'full' : m.rounds > m.cap * 0.66 ? 'mostly full' : m.rounds > m.cap * 0.33 ? 'about half' : 'nearly empty';
export function itemLabel(it, exact = false) {
  switch (it.kind) {
    case 'weapon': return WEAPONS[it.id].name;
    case 'ammo': return `${it.n} × ${CALIBERS[it.cal].name}`;
    case 'mag': return `${MAGS[it.type].name} (${exact ? it.rounds + '/' + it.cap : fill(it)})`;
    case 'att': return ATTACHMENTS[it.id].name + (it.cond < 0.2 ? ' (broken)' : it.cond < 0.45 ? ' (damaged)' : it.cond < 0.7 ? ' (worn)' : '');
    case 'med': return it.id === 'medkit' ? 'Trauma kit' : 'Bandage';
    case 'plate': return `Armor plate (${it.dur > 70 ? 'intact' : it.dur > 35 ? 'cracked' : 'spalled'})`;
    case 'note': return 'Document';
    default: return '?';
  }
}
export class Inventory {
  constructor() { this.items = []; }
  get used() { return this.items.reduce((a, i) => a + itemUnits(i), 0); }
  get free() { return CAPACITY - this.used; }
  // returns number of units accepted for ammo (may be partial) or true/false for other items
  add(it) {
    if (it.kind === 'ammo') {
      const per = CALIBERS[it.cal].unit, can = Math.min(it.n, Math.floor((this.free + 1e-6) / per)); if (can <= 0) return 0;
      const ex = this.items.find(i => i.kind === 'ammo' && i.cal === it.cal); if (ex) ex.n += can; else this.items.push({ kind: 'ammo', cal: it.cal, n: can }); return can;
    }
    if (itemUnits(it) > this.free + 1e-6) return false;
    this.items.push(it); return true;
  }
  remove(it) { const i = this.items.indexOf(it); if (i >= 0) this.items.splice(i, 1); }
  ammo(cal) { const a = this.items.find(i => i.kind === 'ammo' && i.cal === cal); return a ? a.n : 0; }
  takeRound(cal) { const a = this.items.find(i => i.kind === 'ammo' && i.cal === cal); if (!a || a.n <= 0) return false; a.n--; if (a.n === 0) this.remove(a); return true; }
  mags(type) { return this.items.filter(i => i.kind === 'mag' && (!type || i.type === type)); }
  first(kind, id) { return this.items.find(i => i.kind === kind && (!id || i.id === id)); }
}

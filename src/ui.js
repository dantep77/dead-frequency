// DOM interface: HUD, menus, inventory, map, documents, settings and key rebinding.
import { BIND_LABELS, DEFAULT_BINDS, keyName, saveSettings } from './settings.js';
import { itemLabel, itemUnits, CAPACITY } from './inventory.js';
import { ATTACHMENTS, CALIBERS, WEAPONS } from './data/weapons.js';
import { NOTES, TAPES } from './data/story.js';
import { SIZE } from './worldgen.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['menu', 'pause', 'settings', 'controls', 'dead', 'end', 'loading'];
const condWord = (c) => c > 0.8 ? 'good' : c > 0.55 ? 'worn' : c > 0.3 ? 'damaged' : c > 0.1 ? 'failing' : 'dead';

export class UI {
  constructor(game) {
    this.g = game; this.msgs = []; this.back = 'menu'; this.radioQ = []; this.radioT = 0; this.overlay = null;
    document.body.addEventListener('click', (e) => { const b = e.target.closest('button[data-act]'); if (b) this.act(b.dataset.act, b); });
    this.buildControls();
  }
  act(a, btn) {
    const g = this.g; g.audio.init(); g.audio.play('safety', 0.5);
    if (a === 'new') g.startRun($('seed').value.trim());
    else if (a === 'resume') g.resume();
    else if (a === 'settings' || a === 'controls') { this.back = SCREENS.find(s => !$(s).classList.contains('hidden')) || 'menu'; if (a === 'settings') this.buildSettings(); else this.buildControls(); this.show(a); }
    else if (a === 'back') this.show(this.back);
    else if (a === 'abandon' || a === 'menu') g.toMenu();
  }
  show(name) { for (const s of SCREENS) $(s).classList.toggle('hidden', s !== name); }
  hud(on) { $('hud').classList.toggle('hidden', !on); }
  fade(v) { $('fade').style.opacity = v; }
  flash() { const f = document.createElement('div'); f.id = 'flash'; document.body.appendChild(f); setTimeout(() => f.remove(), 90); }
  msg(text) { if (this.msgs.length && this.msgs[this.msgs.length - 1].text === text && this.msgs[this.msgs.length - 1].t < 1.5) return; const el = document.createElement('div'); el.textContent = text; $('msgs').appendChild(el); this.msgs.push({ el, t: 0, text }); if (this.msgs.length > 5) this.msgs.shift().el.remove(); }
  subtitle(head, text) { $('subs-head').textContent = head || ''; $('subs-text').textContent = text || ''; }
  radio(lines) { for (const l of lines) this.radioQ.push(l); }
  scope(on, cond = 1) {
    $('scope').classList.toggle('hidden', !on); if (!on) { if (this._blur) { this.g.renderer.domElement.style.filter = ''; this._blur = false; } return; }
    const key = Math.round(cond * 20); if (key !== this._ck) { this._ck = key; let s = ''; if (cond < 0.6) { const n = Math.round((0.6 - cond) * 14) + 1; let r = key * 7 + 3; const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; }; const cx = 30 + rnd() * 40, cy = 30 + rnd() * 40; for (let i = 0; i < n; i++) { let x = cx, y = cy, d = `M${x} ${y}`; const a = rnd() * 6.28; for (let k = 0; k < 5; k++) { x += Math.cos(a + (rnd() - 0.5)) * 9; y += Math.sin(a + (rnd() - 0.5)) * 9; d += ` L${x} ${y}`; } s += `<path d="${d}" stroke="rgba(235,240,245,0.55)" stroke-width="0.35" fill="none"/>`; } } $('scope-crack').innerHTML = s; }
    const blur = cond < 0.6; if (blur !== this._blur) { this._blur = blur; this.g.renderer.domElement.style.filter = blur ? `blur(${((0.6 - cond) * 3.2).toFixed(1)}px) contrast(${(0.75 + cond * 0.4).toFixed(2)})` : ''; }
  }

  update(dt) {
    const g = this.g, p = g.player; if (!p) return;
    for (let i = this.msgs.length - 1; i >= 0; i--) { const m = this.msgs[i]; m.t += dt; if (m.t > 4) m.el.style.opacity = 0; if (m.t > 4.7) { m.el.remove(); this.msgs.splice(i, 1); } }
    if (this.radioT > 0) { this.radioT -= dt; if (this.radioT <= 0) $('radio').textContent = ''; }
    else if (this.radioQ.length) { const l = this.radioQ.shift(); $('radio').textContent = '▚ ' + l; this.radioT = 2.5 + l.length * 0.055; g.audio.play('squelch', 0.8); g.speak(l, 0.8, 1.05); }
    $('health').style.width = Math.max(0, p.hp) + '%'; $('health').style.background = p.hp < 30 ? '#b5442f' : p.hp < 60 ? '#b59a4a' : '#a9a78f';
    $('stamina').style.width = p.stamina * 100 + '%'; $('staminabar').style.opacity = p.stamina < 0.98 ? 1 : 0;
    let st = ''; if (p.bleed) st += `<b>${p.bleed === 2 ? 'BLEEDING HEAVILY' : 'BLEEDING'}</b>`; if (p.limp) st += '<b>LEG INJURED</b>'; st += `<span>${p.armor ? 'PLATE ' + (p.armor.dur > 70 ? 'INTACT' : p.armor.dur > 35 ? 'CRACKED' : 'FAILING') : 'NO PLATE'}</span>`;
    if (st !== this._st) { this._st = st; $('status').innerHTML = st; }
    $('vignette').style.opacity = Math.min(1, p.hurtT * 0.8 + (p.hp < 35 ? (35 - p.hp) / 60 : 0) + (p.bleed === 2 ? 0.12 : 0));
    const t = `CASSETTES ${g.tapeCount} / 10`; if (t !== this._t) { this._t = t; $('tapes').textContent = t; }
    const bars = g.signalBars; if (bars !== this._bars) { this._bars = bars; [...$('signal').children].forEach((s, i) => { if (s.tagName === 'SPAN') s.classList.toggle('on', i < bars); }); }
    if (g.objective !== this._obj) { this._obj = g.objective; $('objective').textContent = g.objective; }
    const tg = g.target, pr = tg && !this.overlay ? `[${keyName(g.settings.binds.interact)}] ${tg.label}` : '';
    if (pr !== this._pr) { this._pr = pr; $('prompt').textContent = pr; $('prompt').style.opacity = pr ? 1 : 0; $('dot').style.opacity = pr ? 1 : 0; }
    $('busy').classList.toggle('hidden', !p.busy); if (p.busy) { $('busy').firstElementChild.style.width = (p.busy.t / p.busy.dur * 100) + '%'; $('busy').lastElementChild.textContent = p.busy.type === 'medkit' ? 'Dressing wounds…' : 'Bandaging…'; }
    // always-visible summary of what is carried (pack contents only — never the gun's internal state)
    { const w = p.weapon, cal = w ? w.def.cal : null, n = (k, id) => p.inv.items.filter(i => i.kind === k && (!id || i.id === id)).length;
      let c = `<b>${w ? w.def.name : 'Hands empty'}</b>`; if (p.hand) c += `<br>Left hand: <span>${itemLabel(p.hand)}</span>`;
      if (w) c += `<br>Loose ${CALIBERS[cal].name}: <span>${p.inv.ammo(cal)}</span>` + (w.def.magType ? ` · Spare mags: <span>${p.inv.mags(w.def.magType).length}</span>` : '');
      c += `<br>Bandages <span>${n('med', 'bandage')}</span> · Trauma kits <span>${n('med', 'medkit')}</span> · Pack <span>${p.inv.used.toFixed(0)}/${CAPACITY}</span>`;
      if (c !== this._carry) { this._carry = c; $('carry').innerHTML = c; } }
    const ins = p.inspect > 0.5 && !this.overlay; $('carry').classList.toggle('hidden', ins); $('inspect').classList.toggle('hidden', !ins);
    if (ins) {
      const f = p.weapon; let h = '';
      if (f) { h += `<h3>${f.def.name} — ${CALIBERS[f.def.cal].name}</h3><p>${f.conditionText()}</p>`; for (const s of ['optic', 'rail', 'muzzle']) if (f.att[s]) h += `<p><span class="k">${ATTACHMENTS[f.att[s].id].name}</span> — ${condWord(f.att[s].cond)}</p>`; h += `<p class="dim">${f.def.desc}</p><p class="dim">Loose ${CALIBERS[f.def.cal].name} in pack: ${p.inv.ammo(f.def.cal)}</p>`; }
      else h += '<h3>Empty hands</h3>';
      if (p.hand) h += `<p><span class="k">In your left hand:</span> ${itemLabel(p.hand, true)} — you count ${p.hand.rounds}.</p>`;
      if (h !== this._ins) { this._ins = h; $('inspect').innerHTML = h; }
    }
  }

  // ---------- overlays ----------
  setOverlay(name) { this.overlay = name; for (const o of ['inventory', 'map', 'note']) $(o).classList.toggle('hidden', o !== name); if (name === 'inventory') this.renderInventory(); if (name === 'map') this.drawMap(); }
  showNote(id) { $('note-title').textContent = NOTES[id].title; $('note-text').textContent = NOTES[id].text; this.g.openOverlay('note'); }
  renderInventory() {
    const g = this.g, p = g.player, el = $('inventory'), f = p.weapon; el.innerHTML = '';
    const L = document.createElement('div'), R = document.createElement('div'); el.append(L, R);
    const row = (parent, text, btns = []) => { const d = document.createElement('div'); d.className = 'it'; const s = document.createElement('span'); s.textContent = text; const b = document.createElement('span'); b.className = 'b'; for (const [label, fn] of btns) { const x = document.createElement('button'); x.className = 'sm'; x.textContent = label; x.onclick = () => { fn(); g.audio.play('pickup', 0.6); this.renderInventory(); }; b.appendChild(x); } d.append(s, b); parent.appendChild(d); };
    const h = (parent, t) => { const e = document.createElement('h3'); e.textContent = t; parent.appendChild(e); };
    h(L, 'CARRIED WEAPONS');
    for (const slot of ['sidearm', 'primary']) {
      const w = p[slot]; if (!w) { row(L, `${slot === 'sidearm' ? 'Sidearm' : 'Primary'}: —`); continue; }
      row(L, `${w.def.name}${p.held === slot ? '  (in hand)' : ''}`, [[p.held === slot ? 'HOLSTER' : 'DRAW', () => p.setHeld(p.held === slot ? null : slot)], ['DROP', () => p.dropWeapon(slot)]]);
      const d = document.createElement('p'); d.className = 'dim'; d.textContent = w.conditionText(); L.appendChild(d);
      for (const s of ['optic', 'rail', 'muzzle']) if (w.att[s]) row(L, `  ↳ ${ATTACHMENTS[w.att[s].id].name} (${condWord(w.att[s].cond)})`, [['DETACH', () => { const a = w.detach(s); if (!p.inv.add(a)) g.pickups.spawn(a, p.dropPos()); }]]);
    }
    h(L, 'BODY'); row(L, p.armor ? itemLabel(p.armor) : 'No armor plate', p.armor ? [['DROP', () => { g.pickups.spawn(p.armor, p.dropPos()); p.armor = null; }]] : []);
    if (p.hand) row(L, 'Left hand: ' + itemLabel(p.hand), [['STOW', () => p.stowHand()]]);
    h(L, `CASSETTES ${g.tapeCount} / 10`); for (let i = 0; i < g.tapeCount; i++) row(L, `${i + 1}. ${TAPES[i].title} — ${TAPES[i].date}`, [['PLAY', () => g.tapes.play(i)]]);
    if (p.journal.length) { h(L, 'DOCUMENTS'); for (const id of p.journal) row(L, NOTES[id].title, [['READ', () => this.showNote(id)]]); }
    h(R, `PACK — ${p.inv.used.toFixed(1)} / ${CAPACITY} units`); const cb = document.createElement('div'); cb.className = 'capbar'; cb.innerHTML = `<i style="width:${Math.min(100, p.inv.used / CAPACITY * 100)}%"></i>`; R.appendChild(cb);
    if (!p.inv.items.length) row(R, 'Empty.');
    for (const it of [...p.inv.items].sort((a, b) => a.kind.localeCompare(b.kind))) {
      const btns = [];
      if (it.kind === 'med') btns.push(['USE', () => { g.closeOverlay(); p.useMed(it.id); }]);
      if (it.kind === 'plate') btns.push(['WEAR', () => p.swapPlate(it)]);
      if (it.kind === 'mag') btns.push(['HOLD', () => { if (p.hand) p.stowHand(); if (p.inv.items.includes(it)) { p.inv.remove(it); p.hand = it; g.vm.setHand(it); } }]);
      if (it.kind === 'att' && f && f.canAttach(it.id)) btns.push(['ATTACH', () => { p.inv.remove(it); const prev = f.attach(it); if (prev && !p.inv.add(prev)) g.pickups.spawn(prev, p.dropPos()); }]);
      if (it.kind === 'ammo' && it.n > 10) btns.push(['DROP 10', () => { it.n -= 10; g.pickups.spawn({ kind: 'ammo', cal: it.cal, n: 10 }, p.dropPos()); }]);
      btns.push(['DROP', () => { p.inv.remove(it); g.pickups.spawn(it, p.dropPos()); }]);
      row(R, `${itemLabel(it, true)}  ·  ${itemUnits(it).toFixed(1)}u`, btns);
    }
    const note = document.createElement('p'); note.className = 'dim small'; note.innerHTML = `Attachments only fit weapons built for them. <kbd>${keyName(g.settings.binds.inventory)}</kbd> closes the pack — the town does not pause while it is open.`; R.appendChild(note);
  }
  drawMap() {
    const g = this.g, L = g.L, c = $('mapc'), x = c.getContext('2d'), k = c.width / SIZE; x.fillStyle = '#b9b39c'; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#9f9a86'; for (let i = 0; i <= 4; i++) { x.fillRect(i * 68 * k, 0, 12 * k, c.height); x.fillRect(0, i * 68 * k, c.width, 12 * k); }
    const tint = { park: '#a9b38a', school: '#b3a48c', warehouse: '#a5a59c', civic: '#b0aa98', residential: '#b6b196', commercial: '#b3ab95', gas: '#b3ab95' };
    for (const b of L.blocks) { x.fillStyle = tint[b.type]; x.fillRect(b.x * k, b.z * k, 56 * k, 56 * k); }
    x.fillStyle = '#5c5a50'; for (const b of L.buildings) x.fillRect(b.x * k, b.z * k, b.w * k, b.d * k);
    x.fillStyle = '#2f2e29'; x.font = '11px "Courier New"'; x.textAlign = 'center'; for (const b of L.blocks) if (b.type !== 'residential') x.fillText(b.label.toUpperCase(), (b.x + 28) * k, (b.z + 30) * k);
    x.font = '9px "Courier New"'; for (const b of L.buildings) if (b.name && b.w * b.d > 100) x.fillText(b.name.split(' ').slice(0, 2).join(' '), (b.x + b.w / 2) * k, (b.z - 1.5) * k);
    x.strokeStyle = '#3a3a34'; x.lineWidth = 3; x.strokeRect(1, 1, c.width - 2, c.height - 2);
    const mark = (px, pz, col, label) => { x.fillStyle = col; x.beginPath(); x.arc(px * k, pz * k, 5, 0, 6.28); x.fill(); x.font = 'bold 10px "Courier New"'; x.fillText(label, px * k, pz * k - 9); };
    mark(L.extraction.x, L.extraction.z, '#7a2a1c', 'EXTRACTION GATE'); mark(L.checkpoint.x, L.checkpoint.z, '#4a5140', 'CHECKPOINT 4');
    const p = g.player; x.save(); x.translate(p.pos.x * k, p.pos.z * k); x.rotate(-p.yaw); x.fillStyle = '#14140f'; x.beginPath(); x.moveTo(0, -9); x.lineTo(6, 7); x.lineTo(0, 3); x.lineTo(-6, 7); x.closePath(); x.fill(); x.restore();
  }

  // ---------- settings / manual ----------
  buildSettings() {
    const g = this.g, s = g.settings, body = $('settings-body'); body.innerHTML = '';
    const row = (label, ctl) => { const d = document.createElement('div'); d.className = 'row'; const l = document.createElement('span'); l.textContent = label; d.append(l, ctl); body.appendChild(d); return d; };
    const slider = (label, key, min, max, step, fmt) => { const w = document.createElement('span'), i = document.createElement('input'), v = document.createElement('span'); i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = s[key]; v.textContent = ' ' + fmt(s[key]); i.oninput = () => { s[key] = +i.value; v.textContent = ' ' + fmt(s[key]); saveSettings(s); g.applySettings(); }; w.append(i, v); row(label, w); };
    const check = (label, key) => { const i = document.createElement('input'); i.type = 'checkbox'; i.checked = s[key]; i.onchange = () => { s[key] = i.checked; saveSettings(s); g.applySettings(); }; row(label, i); };
    slider('Mouse sensitivity', 'sens', 0.2, 3, 0.05, v => v.toFixed(2)); slider('Field of view', 'fov', 60, 100, 1, v => v + '°'); slider('Master volume', 'volume', 0, 1, 0.02, v => Math.round(v * 100) + '%'); slider('Render scale', 'renderScale', 0.5, 1.5, 0.05, v => Math.round(v * 100) + '%');
    check('Sun shadows', 'shadows'); check('Invert mouse Y', 'invertY'); check('Spoken tape narration (system voice)', 'voice');
    const hd = document.createElement('h3'); hd.textContent = 'KEY BINDINGS — click a key, then press the new one'; hd.style.cssText = 'color:var(--acc);font-weight:normal;letter-spacing:2px;font-size:13px;margin:14px 0 4px'; body.appendChild(hd);
    for (const a in BIND_LABELS) { const b = document.createElement('button'); b.className = 'sm'; b.textContent = keyName(s.binds[a]); b.onclick = () => { b.textContent = 'press a key…'; g.input.capture = (code) => { if (code !== 'Escape') { for (const o in s.binds) if (s.binds[o] === code && o !== a) s.binds[o] = s.binds[a]; s.binds[a] = code; saveSettings(s); } this.buildSettings(); }; }; row(BIND_LABELS[a], b); }
    const r = document.createElement('button'); r.className = 'sm'; r.textContent = 'RESET ALL BINDINGS'; r.onclick = () => { s.binds = { ...DEFAULT_BINDS }; saveSettings(s); this.buildSettings(); }; row('Mouse: left = trigger · right = aim · wheel = spin cylinder', r);
  }
  buildControls() {
    const b = this.g.settings.binds, k = (a) => `<kbd>${keyName(b[a])}</kbd>`;
    $('controls-body').innerHTML = `
<p>You are a recovery contractor, not a soldier. Nothing about your weapon happens by itself. If you pull the trigger and nothing happens, the gun is telling you something — find out what.</p>
<h3>MOVING</h3><p>${k('forward')}${k('left')}${k('back')}${k('right')} move · ${k('sprint')} sprint (limited wind) · ${k('crouch')} crouch (quieter, harder to see) · ${k('jump')} jump. Crouch and jump to vault a window sill.</p>
<p>${k('interact')} interact: doors, loot, containers, cassettes, the extraction beacon · ${k('inventory')} pack · ${k('map')} map · ${k('light')} flashlight · ${k('bandage')} bandage · ${k('medkit')} trauma kit · ${k('replay')} replay last tape.</p>
<h3>EVERY FIREARM</h3><p><kbd>LMB</kbd> trigger · <kbd>RMB</kbd> aim down sights (hip fire is wild) · ${k('inspect')} hold to inspect (move the mouse to turn the weapon over; condition and anything in your left hand are described) · ${k('sidearm')} / ${k('primary')} draw or holster · ${k('drop')} drop.</p>
<p>Hold ${k('action')} to grip the slide, bolt or pump, then <b>move the mouse</b>: down/back pulls it rearward, up/forward pushes it home. Pull part-way to look into the chamber; pull fully to extract and eject.</p>
<p>${k('drawMag')} draw the fullest magazine into your left hand, or stow what you hold (with ${k('sprint')}: the emptiest) · ${k('loadRound')} thumb one loose round into the held magazine, or straight into the gun where the design allows.</p>
<h3>SELF-LOADING PISTOLS — M1911A1, G17, M9</h3><p>${k('mag')} drops the magazine into your left hand, or seats the one you are holding. ${k('tap')} slaps the baseplate — a worn catch does not always latch. Rack with ${k('action')} + mouse and let go to chamber. ${k('slideStop')} releases a locked slide; hold it while the slide is back to lock it open.</p>
<p>M1911A1: single action — the hammer (${k('hammer')}) must be cocked; thumb safety ${k('safety')} locks the slide. G17: no safety; a dry striker only resets when the slide is racked. M9: first pull is double-action; ${k('safety')} is a decocker.</p>
<h3>REVOLVERS</h3><p>Model 10: ${k('mag')} swings the cylinder out (hammer down) · ${k('tap')} ejector rod dumps all six · ${k('loadRound')} one round per press · ${k('mag')} to close. Trigger alone fires double-action; ${k('hammer')} cocks for a lighter single-action shot.</p>
<p>Single Action Army: ${k('hammer')} once to half-cock, ${k('mag')} opens the loading gate. Then for each chamber: ${k('tap')} punch out the case, ${k('loadRound')} load, <kbd>wheel</kbd> to the next. Close the gate, ${k('hammer')} to full cock before every shot.</p>
<h3>SHOTGUNS</h3><p>Model 870: ${k('loadRound')} feeds the tube. Hold ${k('action')}, pull the mouse fully back and push fully forward for every shell — a short stroke feeds nothing. When cocked the action is locked: hold ${k('slideStop')} to open it without firing. With the action open ${k('loadRound')} drops a shell straight into the port.</p>
<p>M1014: fill the tube, pull the bolt handle (${k('action')} + mouse) and release. It locks open when dry — drop a shell in the port (${k('loadRound')}) and hit ${k('slideStop')}.</p>
<h3>RIFLES</h3><p>AR-15: magazine with ${k('mag')}, charging handle ${k('action')} + mouse, bolt catch ${k('slideStop')}, selector ${k('safety')} (only moves to SAFE when cocked).</p>
<p>Model 70 / M40A5: hold ${k('action')}; mouse down lifts and draws the bolt, mouse up closes and locks it. The Model 70 loads five rounds through the open action with ${k('loadRound')}; the M40A5 takes a box magazine.</p>
<h3>WHEN IT STOPS WORKING</h3><p>Worn weapons malfunction. The game will not name the fault. Look at the weapon: is the slide fully forward? Is brass standing in the port? Does the slide move at all? Typical cures, in rising order of trouble: tap the magazine and rack · rack hard, more than once · lock the slide back, strip the magazine, rack until it is clear, reload. A seized action wants several sharp tugs. A revolver that will not turn wants its cylinder opened. A weapon that has come apart is finished — drop it.</p>
<h3>THE INFECTED</h3><p>They hunt by ear first. A gunshot carries for blocks; a suppressor, a crouch and closed doors all buy you quiet. Heads are small; armor stops pistol rounds; legs slow them. Around midday they are sluggish and stand facing the sun.</p>`;
  }
}

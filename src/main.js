// Dead Frequency — game orchestration: run lifecycle, main loop, objectives, extraction.
import * as THREE from '../vendor/three.module.js';
import { generate, SIZE } from './worldgen.js';
import { buildWorld } from './worldbuild.js';
import { Nav } from './nav.js';
import { Sky } from './sky.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { loadSettings } from './settings.js';
import { Player } from './player.js';
import { Zombies } from './zombies.js';
import { Ballistics } from './ballistics.js';
import { Pickups } from './pickups.js';
import { ViewModel } from './viewmodel.js';
import { TapePlayer } from './tapes.js';
import { UI } from './ui.js';
import { hashSeed } from './rng.js';
import { ATTACHMENTS } from './data/weapons.js';
import { RADIO, ENDING } from './data/story.js';

const SIDE_NAME = ['north', 'east', 'south', 'west'];

class Game {
  constructor() {
    this.settings = loadSettings(); this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.0; this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; this.renderer.autoClear = false;
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(this.settings.fov, 16 / 9, 0.06, 1200); this.camera.rotation.order = 'YXZ'; this.scene.add(this.camera);
    this.spot = new THREE.SpotLight(0xfff1d6, 0, 40, 0.5, 0.7, 1.3); this.spot.position.set(0.12, -0.12, 0); this.camera.add(this.spot, this.spot.target); this.spot.target.position.set(0, -0.1, -1);
    this.muzzle = new THREE.PointLight(0xffc880, 0, 18, 1.6); this.muzzle.position.set(0.1, -0.05, -0.6); this.camera.add(this.muzzle);
    const dc = document.createElement('canvas'); dc.width = dc.height = 16; const dg = dc.getContext('2d'), gr = dg.createRadialGradient(8, 8, 0, 8, 8, 8); gr.addColorStop(0, '#fff'); gr.addColorStop(0.4, 'rgba(255,40,20,1)'); gr.addColorStop(1, 'rgba(255,0,0,0)'); dg.fillStyle = gr; dg.fillRect(0, 0, 16, 16);
    this.laser = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(dc), depthTest: false, sizeAttenuation: false, transparent: true, fog: false })); this.laser.scale.setScalar(0.012); this.laser.visible = false; this.scene.add(this.laser);
    this.audio = new Audio(this.settings); this.input = new Input(this.canvas, this.settings); this.vm = new ViewModel(); this.ui = new UI(this); this.tapes = new TapePlayer(this);
    this.state = 'menu'; this.time = 0; this.last = performance.now(); this.player = null; this.zoom = 1; this.tapeCount = 0; this.signalBars = 0; this.objective = ''; this.target = null; this.fps = 60;
    this.audio.los = (ax, ay, az, bx, by, bz) => this.world ? this.world.los(ax, ay, az, bx, by, bz) : true;
    this.input.onLockChange = (locked) => { if (!locked && this.state === 'play' && !this.ui.overlay && !this.expectUnlock) this.pause(); this.expectUnlock = false; };
    addEventListener('keydown', (e) => this.onKey(e));
    addEventListener('resize', () => this.resize()); this.resize();
    const once = () => { this.audio.init(); this.audio.drone(this.state === 'menu'); removeEventListener('pointerdown', once); removeEventListener('keydown', once); }; addEventListener('pointerdown', once); addEventListener('keydown', once);
    requestAnimationFrame((t) => this.frame(t));
  }
  resize() { const w = innerWidth, h = innerHeight; this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5) * this.settings.renderScale); this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.aspect = w / h; }
  applySettings() { this.audio.setVolume(this.settings.volume); this.resize(); if (this.sky) this.sky.sun.castShadow = this.settings.shadows; }
  speak(text, pitch = 1, rate = 1, onend) {
    if (!this.settings.voice || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') return false;
    const voices = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang)); if (!voices.length) return false;
    const u = new SpeechSynthesisUtterance(text); u.voice = voices.find(v => /female|zira|samantha|aria|jenny|google us english/i.test(v.name)) || voices[0]; u.pitch = pitch; u.rate = rate; u.volume = Math.min(1, this.settings.volume * 1.1); if (onend) u.onend = onend; speechSynthesis.speak(u); return true;
  }

  // ---------- run lifecycle ----------
  startRun(seedText) {
    this.ui.show('loading'); this.audio.drone(false);
    const seed = seedText ? (/^\d+$/.test(seedText) ? Number(seedText) >>> 0 : hashSeed(seedText)) : (Math.random() * 2 ** 31) >>> 0;
    document.getElementById('loading-text').textContent = 'seed ' + seed;
    setTimeout(() => { this.buildRun(seed); this.ui.show(null); this.ui.hud(true); this.ui.fade(0); this.state = 'play'; this.input.enabled = true; this.input.reset(); this.input.lock(); }, 60);
  }
  disposeRun() {
    this.tapes.stop(); if (!this.wb) return;
    this.zombies.dispose(); this.pickups.dispose(); this.ballistics.dispose(); this.sky.dispose(); this.wb.dispose(); if (this.truck) this.scene.remove(this.truck); if (this.flare) this.scene.remove(this.flare);
    this.wb = this.world = this.player = this.truck = this.flare = null; this.vm.setWeapon(null); this.vm.setHand(null); this.ui.scope(false);
  }
  buildRun(seed) {
    this.disposeRun(); this.seed = seed; const L = this.L = generate(seed);
    this.wb = buildWorld(L, this.scene); this.world = this.wb.world; this.nav = new Nav(L);
    this.sky = new Sky(this.scene, this.renderer, L.startHour, this.settings.shadows);
    this.pickups = new Pickups(this, this.scene, L); this.zombies = new Zombies(this, this.scene, L); this.ballistics = new Ballistics(this, this.scene);
    this.player = new Player(this, L);
    this.time = 0; this.tapeCount = 0; this.ext = { phase: 0, t: 0 }; this.beepT = 0; this.ambT = 5; this.heartT = 0; this.muzzleT = 0; this.objective = 'Recover ten cassettes. Follow the receiver.'; this.ui.setOverlay(null);
    const ex = L.extraction, b = ex.beacon;
    this.pickups.extra.push({ x: b.x, y: 1.0, z: b.z, dist: 2.8, active: () => this.ext.phase < 2, label: () => this.tapeCount >= 10 ? 'Key the extraction beacon' : `Extraction beacon — Control wants all ten cassettes (${this.tapeCount}/10)`, fn: () => this.keyBeacon() });
    this.ui.radio(RADIO.start);
    setTimeout(() => { if (this.state === 'play') { this.ui.msg('Hold [B] to inspect your weapon. Nothing about it is automatic.'); this.ui.msg('[Tab] pack · [M] map · Esc: field manual'); } }, 9000);
  }
  toMenu() { this.disposeRun(); this.state = 'menu'; this.input.enabled = false; this.input.unlock(); this.ui.hud(false); this.ui.setOverlay(null); this.ui.show('menu'); this.ui.fade(0); this.audio.drone(true); }
  pause() { if (this.state !== 'play') return; this.state = 'pause'; this.input.unlock(); this.ui.show('pause'); document.getElementById('pause-seed').textContent = `Town seed ${this.seed}`; if (window.speechSynthesis) speechSynthesis.pause(); }
  resume() { if (this.state !== 'pause') return; this.state = 'play'; this.ui.show(null); this.input.reset(); this.input.lock(); this.last = performance.now(); if (window.speechSynthesis) speechSynthesis.resume(); }
  openOverlay(name) { this.ui.setOverlay(name); this.expectUnlock = this.input.locked; this.input.unlock(); }
  closeOverlay() { this.ui.setOverlay(null); this.input.reset(); this.input.lock(); }
  onKey(e) {
    if (this.input.capture) return; const b = this.settings.binds;
    if (e.code === 'Escape') { if (this.state === 'play') { if (this.ui.overlay) this.closeOverlay(); else if (!this.input.locked) this.pause(); } else if (this.state === 'pause' && !document.getElementById('pause').classList.contains('hidden')) this.resume(); return; }
    if (this.state !== 'play' || e.repeat) return;
    if (e.code === b.inventory) { e.preventDefault(); this.ui.overlay === 'inventory' ? this.closeOverlay() : this.openOverlay('inventory'); }
    else if (e.code === b.map) { this.ui.overlay === 'map' ? this.closeOverlay() : this.openOverlay('map'); }
    else if (e.code === b.interact && this.ui.overlay === 'note') this.closeOverlay();
    else if (e.code === b.replay) { if (this.tapes.playing) this.tapes.stop(); else if (this.tapes.last >= 0) this.tapes.play(this.tapes.last); }
  }

  // ---------- world services ----------
  indoorAt(x, z) { const L = this.L; x |= 0; z |= 0; return x >= 0 && z >= 0 && x < L.W && z < L.H && L.cellB[x + z * L.W] !== 0; }
  noise(x, z, r, kind) { if (this.zombies) this.zombies.noise(x, z, r, kind); }
  setDoor(d, open, fx, fz) { this.wb.setDoor(d, open, fx, fz); this.audio.play3d(open ? 'door' : 'door_close', d.x, 1.1, d.z, 0.9, 0.9 + Math.random() * 0.2, 3); this.noise(d.x, d.z, open ? 8 : 6, 'door'); }
  onShot(f, supp) { if (!supp || f.att.muzzle.cond < 0.3) this.muzzleT = 0.06; }
  interact() {
    const t = this.target, p = this.player; if (!t || p.busy) return;
    if (t.type === 'item') { if (p.take(t.ref.item)) this.pickups.remove(t.ref); }
    else if (t.type === 'container') this.pickups.open(t.ref);
    else if (t.type === 'door') this.setDoor(t.ref, !t.ref.open, p.pos.x, p.pos.z);
    else if (t.type === 'tape') this.collectTape(t.ref);
    else if (t.type === 'extra') t.ref.fn();
  }
  collectTape(t) {
    t.taken = true; this.scene.remove(t.mesh); const n = this.tapeCount++; this.audio.play('pickup', 1);
    this.tapes.play(n);   // recordings are filed in sequence: the Nth cassette recovered is recording N
    if (this.tapeCount === 5) setTimeout(() => this.ui.radio(RADIO.half), 4000);
    if (this.tapeCount >= 10) { this.ext.phase = 1; this.objective = `All ten recovered. Reach the ${SIDE_NAME[this.L.extraction.side]} gate and key the beacon.`; setTimeout(() => this.ui.radio(RADIO.all.map(s => s.replace('{side}', SIDE_NAME[this.L.extraction.side]))), 5000); }
    else this.objective = `Recover the cassettes. ${10 - this.tapeCount} remain.`;
  }
  keyBeacon() {
    if (this.tapeCount < 10) { this.ui.msg(`Control will not open the gate without all ten cassettes (${this.tapeCount}/10).`); this.audio.play('blocked', 0.8); return; }
    if (this.ext.phase !== 1) return; const L = this.L, ex = L.extraction;
    this.ext.phase = 2; this.ext.t = 0; this.audio.play('beep', 1); this.ui.radio(RADIO.beacon); this.objective = 'Hold at the gate. The truck is coming.';
    const g = this.wb.gates.find(g => g.kind === 'exit'); g.open = 0.001; this.audio.play3d('gate', ex.x, 2, ex.z, 1, 1, 14); this.noise(ex.x, ex.z, 75, 'gunshot');
    // flare + truck
    this.flare = new THREE.PointLight(0xff5030, 60, 40, 1.6); this.flare.position.set(ex.beacon.x, 2.4, ex.beacon.z); this.scene.add(this.flare);
    const T = this.truck = new THREE.Group(), m = (c, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0.2 }), bx = (mat, w, h, d, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); o.position.set(x, y, z); o.castShadow = true; T.add(o); return o; };
    bx(m(0x3b4138), 2.4, 1.5, 2.0, 0, 1.55, -2.6); bx(m(0x14181a, 0.3), 2.2, 0.7, 0.05, 0, 1.9, -3.62); bx(m(0x4a5046), 2.5, 2.4, 4.6, 0, 2.0, 0.8); bx(m(0x1a1b1c), 2.3, 0.3, 6.6, 0, 0.75, 0);
    for (const [x, z] of [[-1.1, -2.6], [1.1, -2.6], [-1.1, 1.8], [1.1, 1.8]]) bx(m(0x0e0e0f), 0.4, 1.0, 1.0, x, 0.5, z);
    for (const x of [-0.8, 0.8]) { const h = bx(new THREE.MeshBasicMaterial({ color: 0xfff2c0 }), 0.3, 0.2, 0.05, x, 1.1, -3.63); } const hl = new THREE.SpotLight(0xfff2c0, 400, 60, 0.5, 0.5, 1.5); hl.position.set(0, 1.2, -3.6); T.add(hl, hl.target); hl.target.position.set(0, 0.5, -20);
    const inw = [[0, 1], [-1, 0], [0, -1], [1, 0]][ex.side]; this.ext.inw = inw; const gx = ex.side === 1 ? L.W : ex.side === 3 ? 0 : ex.x, gz = ex.side === 0 ? 0 : ex.side === 2 ? L.H : ex.z;
    this.ext.from = { x: gx - inw[0] * 16, z: gz - inw[1] * 16 }; this.ext.to = { x: gx + inw[0] * 5, z: gz + inw[1] * 5 };
    T.rotation.y = Math.atan2(-inw[0], -inw[1]); T.position.set(this.ext.from.x, 0, this.ext.from.z); this.scene.add(T);
  }
  updateExtraction(dt) {
    const e = this.ext; if (e.phase < 2) return; e.t += dt;
    if (this.flare) this.flare.intensity = 50 + Math.sin(this.time * 31) * 14 + Math.sin(this.time * 47) * 8;
    if (e.phase === 2) {
      const k = Math.max(0, Math.min(1, (e.t - 5) / 6)), s = k * k * (3 - 2 * k); this.truck.position.set(e.from.x + (e.to.x - e.from.x) * s, 0, e.from.z + (e.to.z - e.from.z) * s);
      if (e.t > 3 && !e.eng) { e.eng = true; this.audio.play3d('engine', e.to.x, 1.5, e.to.z, 1, 1, 12); this.noise(e.to.x, e.to.z, 45, 'gunshot'); }
      if (k >= 1) {
        e.phase = 3; this.ui.radio(RADIO.arrive); this.objective = 'Get in the truck.'; const p = this.truck.position;
        this.world.add(p.x - 1.9, 0, p.z - 1.9, p.x + 1.9, 3.2, p.z + 1.9, 'metal');
        const rear = { x: p.x + e.inw[0] * 3.7, z: p.z + e.inw[1] * 3.7 };
        this.pickups.extra.push({ x: rear.x, y: 1.3, z: rear.z, dist: 3.2, active: () => this.ext.phase === 3, label: 'Climb into the truck — leave Bellwether', fn: () => this.extract() });
      }
    }
  }
  extract() {
    if (this.ext.phase !== 3) return; this.ext.phase = 4; this.state = 'end'; this.ui.fade(1); this.input.enabled = false; this.input.unlock(); this.tapes.stop(); this.audio.play('door_close', 1); this.audio.setLoop('wind', 0); this.audio.setLoop('crickets', 0);
    setTimeout(() => {
      this.ui.hud(false); this.ui.setOverlay(null); this.ui.show('end'); this.ui.fade(0); this.audio.drone(true);
      const box = document.getElementById('end-text'), btn = document.getElementById('end-btn'); box.innerHTML = ''; btn.classList.add('hidden');
      ENDING.forEach((t, i) => { const p = document.createElement('p'); p.textContent = t; box.appendChild(p); setTimeout(() => { p.classList.add('on'); p.scrollIntoView({ block: 'nearest' }); }, 600 + i * 3800); });
      setTimeout(() => btn.classList.remove('hidden'), 600 + ENDING.length * 3800);
    }, 1600);
  }
  onDeath(by) {
    if (this.state !== 'play') return; this.state = 'dying'; this.ui.fade(1); this.tapes.stop(); this.audio.play('z_attack', 0.6, 0.7); this.input.enabled = false; this.input.unlock();
    const names = { standard: 'One of the townspeople reached you.', runner: 'It was faster than you were.', bloater: 'You let the big one get close.', crawler: 'You never looked down.', armored: 'It was still wearing the uniform.', 'blood loss': 'You bled out.' };
    setTimeout(() => { this.state = 'dead'; this.ui.hud(false); this.ui.setOverlay(null); document.getElementById('dead-text').innerHTML = `${names[by] || 'Bellwether keeps what it takes.'}<br><span class="dim small">The cassettes stay where you fell. Town seed ${this.seed}. A new run surveys a different Bellwether.</span>`; this.ui.show('dead'); this.ui.fade(0); this.audio.drone(true); }, 1700);
  }

  // ---------- frame ----------
  frame(t) {
    requestAnimationFrame((tt) => this.frame(tt));
    const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t; if (dt > 0) this.fps += (1 / dt - this.fps) * 0.05;
    if ((this.state === 'play' || this.state === 'dying') && this.player) { this.step(dt); this.render(); }
    else if (this.state === 'pause' && this.player) this.render();
    else { this.renderer.setClearColor(0x050605); this.renderer.clear(); }
    this.input.endFrame();
  }
  step(dt) {
    const p = this.player, inp = this.input; this.time += dt;
    const active = this.state === 'play' && !this.ui.overlay && (inp.locked || inp.noLock);
    p.update(dt, inp, active);
    this.indoor = this.indoorAt(p.pos.x, p.pos.z);
    // camera
    const f = p.weapon, opt = f && f.att.optic ? ATTACHMENTS[f.att.optic.id] : null, zoomMax = opt && opt.zoom > 1 ? opt.zoom : 1.18;
    const a = p.aim * p.aim * (3 - 2 * p.aim); this.zoom = 1 + (zoomMax - 1) * (zoomMax > 2 ? (p.aim > 0.9 ? 1 : 0) : a);
    const fov = 2 * Math.atan(Math.tan(this.settings.fov * Math.PI / 360) / this.zoom) * 180 / Math.PI; if (Math.abs(fov - this.camera.fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    const sh = p.shake; this.camera.position.set(p.pos.x + (Math.random() - 0.5) * sh * 0.06, p.pos.y + p.eyeH + Math.abs(Math.cos(p.bob)) * 0.018 * Math.min(1, p.speed / 3) * (p.onGround ? 1 : 0) + (Math.random() - 0.5) * sh * 0.06, p.pos.z);
    this.camera.rotation.set(p.pitch, p.yaw, (Math.random() - 0.5) * sh * 0.05 + (p.limp ? Math.sin(p.bob * 0.5) * 0.012 : 0));
    this.ui.scope(!!(opt && opt.zoom > 1 && p.aim > 0.9 && this.state === 'play'), f && f.att.optic ? f.att.optic.cond : 1);
    // systems
    this.sky.update(dt, p.pos); this.wb.tick(this.time, dt, p.pos.x, p.pos.z);
    if (this.state === 'play') { this.zombies.update(dt); this.ballistics.update(dt); this.pickups.update(dt, this.time, p.pos.x, p.pos.z); this.updateExtraction(dt); this.tapes.update(dt); }
    const fw = p.forward(), eye = p.eye;
    this.target = active ? this.pickups.findTarget(eye, fw) : null;
    if (active && inp.hit('interact')) this.interact();
    // lights: flashlight (weapon light if mounted, otherwise a weak penlight), muzzle flash, laser
    const rail = f && f.att.rail; let li = 0; this.lightActive = false;
    if (p.lightOn) { if (rail && rail.id === 'light') { const c = rail.cond, fl = c < 0.45 ? (Math.sin(this.time * 37) + Math.sin(this.time * 61.3) + Math.sin(this.time * 13.7) > (c - 0.1) * 5 - 1.4 ? 0.15 : 1) : 1; li = c < 0.08 ? 0 : 900 * (0.35 + 0.65 * c) * fl; this.spot.angle = 0.52; this.spot.distance = 70; } else { li = 210; this.spot.angle = 0.38; this.spot.distance = 28; } this.lightActive = li > 5; }
    this.spot.intensity = li; this.muzzleT -= dt; this.muzzle.intensity = this.muzzleT > 0 ? 140 : 0;
    let lz = false; if (rail && rail.id === 'laser' && p.laserOn && rail.cond > 0.1 && p.drawT <= 0 && !(rail.cond < 0.4 && Math.sin(this.time * 43) + Math.sin(this.time * 29) > rail.cond * 3)) { const h = this.world.raycast(eye.x, eye.y, eye.z, fw.x, fw.y, fw.z, 90, null), zh = this.zombies.raycast(eye.x, eye.y, eye.z, fw.x, fw.y, fw.z, h ? h.t : 90), tt = zh ? zh.t : h ? h.t : 0; if (tt > 0.5) { this.laser.position.set(eye.x + fw.x * (tt - 0.03), eye.y + fw.y * (tt - 0.03), eye.z + fw.z * (tt - 0.03)); lz = true; } } this.laser.visible = lz;
    const light = Math.min(1, Math.max(0.16, this.sky.daylight * (this.indoor ? 0.5 : 1) + (this.lightActive ? 0.3 : 0) + (this.muzzleT > 0 ? 0.8 : 0)));
    this.vm.update(dt, p, light, this.aspect);
    // receiver: ticks faster as you close on the nearest cassette
    let near = Infinity; for (const tp of this.pickups.tapes) if (!tp.taken) near = Math.min(near, Math.hypot(tp.x - p.pos.x, tp.z - p.pos.z));
    this.signalBars = near > 70 ? 0 : near > 48 ? 1 : near > 30 ? 2 : near > 16 ? 3 : near > 7 ? 4 : 5;
    if (near < 70 && this.state === 'play') { this.beepT -= dt; if (this.beepT <= 0) { this.beepT = 0.14 + (near / 70) * 1.9; this.audio.play('beep', 0.25 + (1 - near / 70) * 0.5, 0.9 + (1 - near / 70) * 0.35, 0); } }
    // ambience
    const A = this.audio, day = this.sky.daylight; A.setListener(eye, fw, this.indoor);
    A.setLoop('wind', this.indoor ? 0.1 : 0.34, 0.9 + 0.2 * Math.sin(this.time * 0.07)); A.setLoop('crickets', this.indoor ? 0.05 : (1 - day) * 0.55); A.setLoop('roomtone', this.indoor ? 0.5 : 0);
    this.ambT -= dt; if (this.ambT <= 0) { this.ambT = 7 + Math.random() * 16; const an = Math.random() * 6.28, d = 14 + Math.random() * 40, x = eye.x + Math.cos(an) * d, z = eye.z + Math.sin(an) * d, r = Math.random(); if (this.indoor && r < 0.6) A.play3d('creak_wood', eye.x + Math.cos(an) * 4, 2.5, eye.z + Math.sin(an) * 4, 0.7, 0.8 + Math.random() * 0.4, 3, 0.6); else if (r < 0.3) A.play3d('creak_metal', x, 4, z, 0.8, 0.7 + Math.random() * 0.5, 8); else if (r < 0.5) A.play3d('thud_far', x, 1, z, 0.9, 1, 10); else if (day > 0.5 && !this.indoor) A.play3d(r < 0.8 ? 'bird' : 'crow', x, 9, z, 0.7, 0.9 + Math.random() * 0.3, 8); else if (r > 0.85 && this.zombies.list.length) A.play3d('z_groan3', x, 1.5, z, 0.5, 0.8, 10); }
    if (p.hp < 35 && !p.dead) { this.heartT -= dt; if (this.heartT <= 0) { this.heartT = 0.75 + p.hp / 100; A.play('heart', 0.8, 1, 0); } }
    if (p.stamina < 0.25 && !p.dead) { this.breathT = (this.breathT || 0) - dt; if (this.breathT <= 0) { this.breathT = 1.3; A.play('breath', 0.8, 1.1, 0); } }
    this.ui.update(dt);
  }
  render() { const r = this.renderer; r.clear(); r.render(this.scene, this.camera); if (this.player && !this.player.dead) this.vm.render(r); }
}
window.DF = new Game();

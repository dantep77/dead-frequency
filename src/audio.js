// Fully synthesized audio: every sound is generated at start-up into buffers (no asset files).
// Spatial playback through HRTF panners, occlusion low-pass, indoor/outdoor reverb sends.
const SR = 44100;
let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const buf = (dur, fn) => { const n = Math.floor(dur * SR), a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = fn(i / SR, i, n); return a; };
const noise = () => rnd() * 2 - 1;
function biquad(a, type, f, q = 0.707) { // in-place RBJ biquad
  const w = 2 * Math.PI * f / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q); let b0, b1, b2, a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; } else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; } else { b0 = al; b1 = 0; b2 = -al; }
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < a.length; i++) { const x = a[i], y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; a[i] = y; } return a;
}
const mix = (...arrs) => { const n = Math.max(...arrs.map(a => a.length)), o = new Float32Array(n); for (const a of arrs) for (let i = 0; i < a.length; i++) o[i] += a[i]; return o; };
const at = (a, t, len) => { const o = new Float32Array(Math.max(a.length + Math.floor(t * SR), Math.floor((len || 0) * SR))); o.set(a, Math.floor(t * SR)); return o; };
const gain = (a, g) => { for (let i = 0; i < a.length; i++) a[i] *= g; return a; };
const norm = (a, peak = 0.9) => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i])); if (m > 0) gain(a, peak / m); return a; };
const clip = (a, d) => { for (let i = 0; i < a.length; i++) a[i] = Math.tanh(a[i] * d); return a; };
const nb = (dur, decay, type, f, q) => biquad(buf(dur, (t) => noise() * Math.exp(-t * decay)), type, f, q); // filtered noise burst
const ping = (dur, f, decay, g = 1) => buf(dur, (t) => Math.sin(6.2832 * f * t) * Math.exp(-t * decay) * g);
const click = (f, decay, g = 1, dur = 0.08) => mix(gain(nb(dur, decay, 'bp', f, 2.5), g * 3), ping(dur, f * 0.6, decay * 1.5, g * 0.4));

function gunshot(body, crack, tail, boom) { // body Hz, crack Hz, tail seconds, boom amount
  const a = clip(nb(0.25, 26, 'lp', crack, 0.7), 4), b = gain(nb(tail, 5 / tail * 1.6, 'lp', body * 3, 0.6), 0.6);
  const th = buf(0.3, (t) => Math.sin(6.2832 * (body * 0.5) * t * (1 - t)) * Math.exp(-t * 16) * boom);
  return norm(clip(mix(a, b, th), 1.6), 0.95);
}
function voiceBuf(dur, f0, f1, vib, formants, rough = 0.3, breath = 0.2) { // crude vocal: glottal saw through formant band-passes
  let ph = 0; const src = buf(dur, (t, i, n) => { const k = t / dur, f = f0 + (f1 - f0) * k + Math.sin(t * vib * 6.28) * f0 * 0.04 + noise() * f0 * rough * 0.2; ph += f / SR; const saw = (ph % 1) * 2 - 1; const env = Math.min(1, t * 12) * Math.min(1, (dur - t) * 6); return (saw * (1 - breath) + noise() * breath) * env; });
  const parts = formants.map(([f, q, g]) => gain(biquad(Float32Array.from(src), 'bp', f, q), g)); return norm(mix(...parts), 0.8);
}

function generate() {
  const B = {};
  // ---- firearms ----
  B.shot_9mm = gunshot(220, 5200, 0.7, 0.5); B['shot_.45'] = gunshot(160, 3800, 0.8, 0.8); B['shot_.38'] = gunshot(190, 4400, 0.75, 0.6);
  B.shot_12ga = gunshot(95, 2600, 1.1, 1.3); B['shot_5.56'] = gunshot(260, 7500, 1.0, 0.5); B['shot_.308'] = gunshot(120, 5200, 1.5, 1.2);
  B.shot_supp = norm(mix(nb(0.18, 30, 'bp', 1400, 0.8), ping(0.1, 140, 40, 0.5), gain(nb(0.05, 80, 'hp', 5000), 0.4)), 0.6);
  B.shot_far = norm(biquad(mix(nb(1.6, 3.2, 'lp', 500, 0.6), ping(0.4, 70, 9, 0.8)), 'lp', 700), 0.8);
  B.click = norm(mix(click(3200, 90, 1), at(click(1800, 120, 0.5), 0.006)), 0.7);
  B.dead = norm(click(900, 160, 0.4, 0.04), 0.25);
  B.slide_back = norm(mix(nb(0.12, 30, 'bp', 2400, 1.2), at(click(1500, 80, 1), 0.09)), 0.7);
  B.slide_fwd = norm(mix(nb(0.05, 60, 'bp', 2800, 1.5), at(click(1100, 60, 1.4), 0.03), at(ping(0.12, 2300, 45, 0.15), 0.035)), 0.85);
  B.slide_part = norm(nb(0.09, 40, 'bp', 2600, 1.5), 0.35);
  B.mag_out = norm(mix(click(1900, 110, 1), at(nb(0.1, 40, 'bp', 1200, 1), 0.02)), 0.6);
  B.mag_in = norm(mix(nb(0.08, 45, 'bp', 1000, 1), at(click(2400, 100, 1.2), 0.07)), 0.7);
  B.mag_soft = norm(nb(0.09, 45, 'bp', 800, 1), 0.4);
  B.mag_tap = norm(mix(nb(0.07, 50, 'lp', 500, 1), at(click(2400, 100, 0.8), 0.012)), 0.7);
  B.safety = norm(click(4200, 160, 1, 0.04), 0.4);
  B.hammer = norm(mix(click(2600, 120, 1), at(click(3400, 140, 1), 0.07)), 0.5);
  B.round_in = norm(mix(click(3000, 130, 0.8), at(nb(0.05, 70, 'bp', 1800, 2), 0.02)), 0.45);
  B.shell_in = norm(mix(nb(0.08, 50, 'bp', 900, 1.4), at(click(1700, 90, 1), 0.07)), 0.6);
  B.cyl_open = norm(mix(click(2100, 90, 1), at(ping(0.2, 2900, 25, 0.12), 0.01)), 0.6);
  B.cyl_close = norm(mix(click(1500, 70, 1.2), at(click(2600, 120, 0.6), 0.02)), 0.7);
  B.cyl_tick = norm(click(4800, 200, 1, 0.03), 0.35);
  B.ejector = norm(mix(nb(0.07, 50, 'bp', 2200, 1.5), at(ping(0.3, 5200, 18, 0.2), 0.06), at(ping(0.3, 6100, 22, 0.15), 0.1)), 0.6);
  B.pump_back = norm(mix(nb(0.11, 28, 'bp', 1300, 1), at(click(900, 55, 1.6), 0.09)), 0.85);
  B.pump_fwd = norm(mix(nb(0.1, 30, 'bp', 1500, 1), at(click(1200, 60, 1.6), 0.08)), 0.85);
  B.bolt_up = norm(click(1700, 80, 1, 0.07), 0.55); B.bolt_down = norm(mix(click(1300, 70, 1.2, 0.08), at(click(2600, 130, 0.5), 0.03)), 0.6);
  B.bolt_back = norm(mix(nb(0.12, 30, 'bp', 2000, 1.4), at(click(1000, 60, 1.2), 0.1)), 0.7); B.bolt_fwd = norm(mix(nb(0.12, 30, 'bp', 2300, 1.4), at(click(1400, 70, 1), 0.1)), 0.7);
  B.tug = norm(mix(nb(0.1, 40, 'lp', 600, 1.2), click(700, 60, 1)), 0.6); B.free = norm(mix(click(900, 40, 1.5, 0.15), at(ping(0.2, 1900, 30, 0.2), 0.02)), 0.8);
  B.blocked = norm(nb(0.05, 80, 'lp', 700, 1), 0.3);
  B.grit = norm(biquad(buf(0.14, (t) => noise() * (0.4 + 0.6 * Math.abs(Math.sin(t * 160))) * Math.exp(-t * 12)), 'bp', 1900, 3), 0.35);
  B.casing = norm(mix(ping(0.25, 4300, 22, 0.5), at(ping(0.2, 5100, 28, 0.35), 0.09), at(ping(0.15, 4700, 35, 0.2), 0.16)), 0.25);
  B.shell_drop = norm(mix(nb(0.06, 60, 'bp', 900, 1.5), at(nb(0.05, 70, 'bp', 1100, 1.5), 0.1)), 0.3);
  B.kaboom = norm(clip(mix(gunshot(110, 3000, 0.6, 1.4), at(ping(0.5, 2100, 9, 0.4), 0.02), at(nb(0.3, 14, 'bp', 3200, 3), 0.03)), 2), 0.98);
  B.impact = norm(mix(nb(0.08, 50, 'bp', 2400, 0.8), ping(0.06, 300, 50, 0.6)), 0.6);
  B.impact_metal = norm(mix(ping(0.3, 2700, 18, 0.5), ping(0.25, 4100, 25, 0.3), nb(0.04, 90, 'hp', 3000)), 0.6);
  B.impact_flesh = norm(mix(nb(0.09, 40, 'lp', 500, 1), ping(0.07, 120, 40, 0.8)), 0.6);
  B.attach = norm(mix(click(2000, 90, 1), at(click(3600, 150, 0.7), 0.12)), 0.5);
  // ---- movement ----
  const step = (f, q, decay, g) => norm(mix(nb(0.14, decay, 'bp', f, q), ping(0.08, 80, 45, g)), 0.5);
  B.step_grass = norm(biquad(buf(0.22, (t) => noise() * Math.exp(-t * 16) * (0.6 + 0.4 * Math.sin(t * 240))), 'bp', 2600, 0.7), 0.3);
  B.step_asphalt = step(1300, 1.2, 38, 0.5); B.step_concrete = step(1700, 1.5, 42, 0.4); B.step_wood = norm(mix(nb(0.12, 30, 'bp', 420, 2.5), ping(0.16, 110, 28, 0.9)), 0.55); B.step_tile = step(2600, 2, 55, 0.25); B.step_dirt = norm(nb(0.16, 26, 'bp', 900, 0.8), 0.35);
  B.land = norm(mix(nb(0.18, 20, 'lp', 400, 1), ping(0.15, 70, 25, 1)), 0.6);
  B.cloth = norm(biquad(buf(0.25, (t) => noise() * Math.sin(Math.min(1, t * 4) * 3.14) * 0.6), 'bp', 3200, 0.8), 0.25);
  B.pickup = norm(mix(nb(0.1, 30, 'bp', 2400, 1), at(click(1600, 90, 0.6), 0.06)), 0.35);
  B.bandage = norm(biquad(buf(0.7, (t) => noise() * (0.3 + 0.7 * Math.abs(Math.sin(t * 9))) * Math.min(1, (0.7 - t) * 5)), 'bp', 3800, 1.2), 0.3);
  B.plate = norm(mix(nb(0.2, 16, 'lp', 600, 1), at(click(1300, 50, 1), 0.15)), 0.5);
  // ---- world ----
  B.door = norm(mix(buf(0.6, (t) => { const f = 300 + 500 * t + Math.sin(t * 31) * 60; return Math.sin(6.2832 * f * t + Math.sin(t * 190) * 2) * Math.sin(Math.min(1, t / 0.6) * 3.14) * 0.35; }), at(click(700, 40, 1.2, 0.12), 0.0)), 0.4);
  B.door_close = norm(mix(nb(0.15, 26, 'lp', 500, 1), click(1000, 50, 1, 0.1)), 0.55);
  B.door_bang = norm(mix(nb(0.22, 16, 'lp', 300, 1.2), ping(0.2, 85, 16, 1), at(nb(0.1, 40, 'bp', 1400, 1), 0.01)), 0.9);
  B.container = norm(mix(click(1200, 60, 1, 0.1), at(buf(0.3, (t) => Math.sin(6.2832 * (500 + 300 * t) * t) * Math.sin(Math.min(1, t / 0.3) * 3.14) * 0.3), 0.05)), 0.4);
  B.gate = norm(mix(buf(4.5, (t) => (Math.sin(6.2832 * 55 * t) * 0.5 + noise() * 0.25 * (0.5 + 0.5 * Math.sin(t * 40))) * Math.min(1, t * 2) * Math.min(1, (4.5 - t) * 2)), at(biquad(buf(4, (t) => Math.sin(6.2832 * (700 + Math.sin(t * 3) * 120) * t) * 0.12 * Math.min(1, t)), 'bp', 900, 2), 0.3), at(B.door_bang, 4.3)), 0.9);
  B.engine = norm(biquad(buf(3, (t) => { const f = 46 + Math.sin(t * 2.1) * 3; return (Math.sign(Math.sin(6.2832 * f * t)) * 0.4 + Math.sin(6.2832 * f * 2.02 * t) * 0.3 + noise() * 0.15); }), 'lp', 420, 0.8), 0.7);
  B.creak_wood = norm(buf(0.9, (t) => Math.sin(6.2832 * (180 + 90 * Math.sin(t * 5)) * t + Math.sin(t * 130) * 3) * Math.sin(Math.min(1, t / 0.9) * 3.14) * (0.5 + 0.5 * Math.sin(t * 47))), 0.25);
  B.creak_metal = norm(biquad(buf(1.6, (t) => Math.sin(6.2832 * (520 + 200 * Math.sin(t * 2.2)) * t + Math.sin(t * 70) * 5) * Math.sin(Math.min(1, t / 1.6) * 3.14)), 'bp', 900, 3), 0.25);
  B.thud_far = norm(biquad(mix(ping(0.6, 55, 7, 1), nb(0.5, 8, 'lp', 200, 1)), 'lp', 260), 0.5);
  B.bird = norm(buf(0.5, (t) => { const k = (t * 9) % 1; return Math.sin(6.2832 * (3200 + 900 * Math.sin(k * 6.28)) * t) * Math.sin(k * 3.14) * (t < 0.34 ? 1 : 0) * 0.5; }), 0.2);
  B.crow = norm(mix(at(voiceBuf(0.28, 520, 430, 30, [[1400, 4, 1], [2400, 5, 0.7]], 0.9, 0.4), 0), at(voiceBuf(0.3, 500, 400, 30, [[1400, 4, 1], [2400, 5, 0.7]], 0.9, 0.4), 0.42)), 0.3);
  B.wind = norm(biquad(biquad(buf(6, (t) => noise() * (0.55 + 0.45 * Math.sin(t * 1.047) * Math.sin(t * 0.3 * 6.28 / 6 * 3))), 'lp', 520, 0.6), 'hp', 90), 0.5);
  B.roomtone = norm(biquad(buf(4, (t) => noise() * 0.6 + Math.sin(6.2832 * 60 * t) * 0.05), 'lp', 180, 0.7), 0.35);
  B.crickets = norm(buf(4, (t) => { const k = (t * 3.5) % 1, k2 = (t * 2.3 + 0.4) % 1; return Math.sin(6.2832 * 4300 * t) * (k < 0.35 ? Math.abs(Math.sin(k * 80)) : 0) * 0.3 + Math.sin(6.2832 * 3700 * t) * (k2 < 0.3 ? Math.abs(Math.sin(k2 * 70)) : 0) * 0.2; }), 0.12);
  // ---- infected ----
  const F_A = [[650, 5, 1], [1100, 6, 0.6], [2500, 7, 0.25]], F_O = [[420, 5, 1], [800, 6, 0.5], [2300, 8, 0.2]], F_E = [[500, 5, 1], [1700, 7, 0.5], [2500, 8, 0.3]];
  B.z_groan1 = voiceBuf(1.5, 105, 82, 5, F_O, 0.5, 0.25); B.z_groan2 = voiceBuf(1.1, 130, 95, 7, F_A, 0.7, 0.3); B.z_groan3 = voiceBuf(1.9, 90, 70, 4, F_O, 0.9, 0.35);
  B.z_alert = voiceBuf(0.8, 150, 230, 11, F_A, 1.2, 0.3); B.z_attack = voiceBuf(0.45, 210, 150, 14, F_A, 1.6, 0.4); B.z_pain = voiceBuf(0.3, 180, 120, 10, F_E, 1.2, 0.4);
  B.z_runner = voiceBuf(1.0, 330, 480, 16, F_E, 1.4, 0.35); B.z_bloat = norm(mix(voiceBuf(1.8, 62, 50, 3, F_O, 1.2, 0.3), gain(biquad(buf(1.8, (t) => noise() * (Math.sin(t * 38) > 0.6 ? 1 : 0)), 'bp', 300, 3), 0.6)), 0.8);
  B.z_crawl = norm(mix(biquad(buf(0.8, (t) => noise() * Math.sin(Math.min(1, t / 0.8) * 3.14)), 'bp', 1100, 0.8), gain(voiceBuf(0.8, 95, 80, 6, F_E, 1.6, 0.7), 0.5)), 0.4);
  B.z_death = voiceBuf(0.9, 140, 60, 6, F_O, 1.0, 0.5); B.z_step = norm(nb(0.16, 24, 'bp', 700, 0.8), 0.3);
  B.armor_hit = norm(mix(ping(0.2, 1900, 30, 0.6), nb(0.06, 60, 'bp', 2600, 1)), 0.5);
  // ---- player ----
  B.hurt = norm(mix(voiceBuf(0.3, 190, 130, 9, F_E, 0.6, 0.5), nb(0.12, 30, 'lp', 400, 1)), 0.7);
  B.heart = norm(mix(ping(0.18, 58, 20, 1), at(ping(0.2, 48, 18, 0.8), 0.24)), 0.7);
  B.breath = norm(biquad(buf(1.2, (t) => noise() * Math.pow(Math.sin(Math.min(1, t / 1.2) * 3.14), 2)), 'bp', 1500, 0.6), 0.2);
  // ---- ui / radio / tape ----
  B.beep = norm(buf(0.07, (t) => Math.sin(6.2832 * 1850 * t) * Math.min(1, t * 200) * Math.min(1, (0.07 - t) * 200)), 0.2);
  B.squelch = norm(mix(nb(0.18, 8, 'bp', 2200, 0.7), at(buf(0.05, (t) => Math.sin(6.2832 * 1200 * t) * 0.5), 0.17)), 0.3);
  B.tape_click = norm(mix(click(1400, 70, 1.4, 0.1), at(click(2600, 110, 0.8), 0.05)), 0.6);
  B.hiss = norm(biquad(buf(3, (t) => noise() * (0.9 + 0.1 * Math.sin(t * 6.28 * 0.66))), 'hp', 2500), 0.06);
  B.t_phones = norm(buf(2.6, (t) => { const r = (t % 1.3) < 0.8 ? 1 : 0; return (Math.sin(6.2832 * 440 * t) + Math.sin(6.2832 * 480 * t)) * 0.25 * r * (0.6 + 0.4 * Math.sign(Math.sin(t * 125))); }), 0.12);
  B.t_static = norm(biquad(buf(1.4, (t) => noise() * (0.5 + 0.5 * Math.sin(t * 23)) * Math.min(1, (1.4 - t) * 3)), 'bp', 2400, 0.8), 0.25);
  B.t_siren = norm(biquad(buf(7, (t) => { const f = 300 + 520 * Math.min(1, t / 2.5) * (t > 5.5 ? Math.max(0.3, 1 - (t - 5.5) / 1.5) : 1); return Math.sign(Math.sin(6.2832 * f * t)) * 0.4 * Math.min(1, t) * Math.min(1, (7 - t) * 1.5); }), 'bp', 700, 1.2), 0.2);
  B.t_crowd = norm(biquad(buf(5, (t) => noise() * (0.6 + 0.4 * Math.sin(t * 2.7) * Math.sin(t * 7.1)) * Math.min(1, t) * Math.min(1, 5 - t)), 'bp', 600, 0.9), 0.2);
  B.t_bang = norm(mix(at(B.door_bang, 0), at(B.door_bang, 0.5), at(gain(Float32Array.from(B.door_bang), 0.7), 1.3)), 0.3);
  B.t_shots = norm(mix(...[0, 0.35, 0.5, 1.1, 1.25, 1.4, 2.2].map((t, i) => at(gain(Float32Array.from(B.shot_far), 0.5 + (i % 3) * 0.2), t))), 0.3);
  B.t_cough = norm(mix(at(nb(0.2, 14, 'bp', 1100, 1.2), 0), at(nb(0.25, 12, 'bp', 900, 1.2), 0.3)), 0.25);
  B.t_monitor = norm(buf(3, (t) => ((t % 1) < 0.09 ? Math.sin(6.2832 * 980 * t) : 0) * 0.5), 0.1);
  B.t_crank = norm(biquad(buf(3, (t) => noise() * (Math.sin(t * 14) > 0 ? 1 : 0.2) * Math.min(1, t * 2)), 'bp', 500, 2), 0.2);
  B.t_wind = gain(Float32Array.from(B.wind.subarray(0, SR * 4)), 0.5);
  B.t_paper = norm(biquad(buf(0.8, (t) => noise() * Math.abs(Math.sin(t * 11)) * Math.min(1, (0.8 - t) * 4)), 'hp', 3000), 0.15);
  B.t_trucks = norm(biquad(buf(4, (t) => (Math.sign(Math.sin(6.2832 * 38 * t)) * 0.5 + noise() * 0.3) * Math.sin(Math.min(1, t / 4) * 3.14)), 'lp', 300), 0.25);
  B.t_hum = norm(buf(6, (t) => (Math.sin(6.2832 * 41 * t) + Math.sin(6.2832 * 61.5 * t) * 0.6 + Math.sin(6.2832 * 82.3 * t) * 0.3) * Math.sin(Math.min(1, t / 6) * 3.14) * (0.8 + 0.2 * Math.sin(t * 2.2))), 0.4);
  B.t_click = B.tape_click;
  B.murmur = norm(buf(3, (t) => { const syl = Math.pow(Math.abs(Math.sin(t * 13 + Math.sin(t * 3.1) * 2)), 0.6); const f = 170 + Math.sin(t * 2.3) * 25 + Math.sin(t * 9.1) * 12; return (((f * t) % 1) * 2 - 1) * syl; }), 0.5); biquad(B.murmur, 'bp', 900, 1.2);
  return B;
}

export class Audio {
  constructor(settings) { this.settings = settings; this.ctx = null; this.buffers = {}; this.indoor = 0; this.loops = {}; this.live = 0; this.los = null; this.lp = { x: 0, y: 0, z: 0 }; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    const raw = generate(); for (const k in raw) { const b = ctx.createBuffer(1, raw[k].length, SR); b.copyToChannel(raw[k], 0); this.buffers[k] = b; }
    this.master = ctx.createGain(); this.master.gain.value = this.settings.volume;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2;
    this.master.connect(comp); comp.connect(ctx.destination);
    const ir = (dur, decay, sparse) => { const n = Math.floor(dur * ctx.sampleRate), b = ctx.createBuffer(2, n, ctx.sampleRate); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) { const t = i / n; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (sparse ? (Math.random() < 0.25 ? 1 : 0.15) : 1); } } return b; };
    this.revIn = ctx.createConvolver(); this.revIn.buffer = ir(0.55, 2.2, false); this.revOut = ctx.createConvolver(); this.revOut.buffer = ir(2.6, 3.2, true);
    this.revInG = ctx.createGain(); this.revOutG = ctx.createGain(); this.revInG.gain.value = 0; this.revOutG.gain.value = 0.5;
    const outLp = ctx.createBiquadFilter(); outLp.type = 'lowpass'; outLp.frequency.value = 1800;
    this.revIn.connect(this.revInG); this.revInG.connect(this.master); this.revOut.connect(outLp); outLp.connect(this.revOutG); this.revOutG.connect(this.master);
    this.send = ctx.createGain(); this.send.connect(this.revIn); this.send.connect(this.revOut);
    this.amb = ctx.createGain(); this.amb.connect(this.master);
    this.loop('wind', 0.0); this.loop('crickets', 0); this.loop('roomtone', 0);
  }
  setVolume(v) { if (this.master) this.master.gain.value = v; }
  loop(name, vol) { const ctx = this.ctx; if (!ctx || this.loops[name]) return; const s = ctx.createBufferSource(); s.buffer = this.buffers[name]; s.loop = true; const g = ctx.createGain(); g.gain.value = vol; s.connect(g); g.connect(this.amb); s.start(); this.loops[name] = { s, g }; }
  setLoop(name, vol, rate) { const l = this.loops[name]; if (l) { l.g.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.4); if (rate) l.s.playbackRate.setTargetAtTime(rate, this.ctx.currentTime, 0.5); } }
  setListener(p, f, indoor) {
    const ctx = this.ctx; if (!ctx) return; this.lp = p; const l = ctx.listener;
    if (l.positionX) { const t = ctx.currentTime; l.positionX.setValueAtTime(p.x, t); l.positionY.setValueAtTime(p.y, t); l.positionZ.setValueAtTime(p.z, t); l.forwardX.setValueAtTime(f.x, t); l.forwardY.setValueAtTime(f.y, t); l.forwardZ.setValueAtTime(f.z, t); l.upX.setValueAtTime(0, t); l.upY.setValueAtTime(1, t); l.upZ.setValueAtTime(0, t); }
    else { l.setPosition(p.x, p.y, p.z); l.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
    this.indoor += ((indoor ? 1 : 0) - this.indoor) * 0.08;
    this.revInG.gain.value = 0.55 * this.indoor; this.revOutG.gain.value = 0.5 * (1 - this.indoor);
  }
  // 2D (non-positional) sound, e.g. the player's own weapon manipulation and UI
  play(name, vol = 1, rate = 1, send = 0.15) {
    const ctx = this.ctx, b = this.buffers[name]; if (!ctx || !b) return null;
    const s = ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate * (0.97 + Math.random() * 0.06); const g = ctx.createGain(); g.gain.value = vol; s.connect(g); g.connect(this.master);
    if (send > 0) { const sg = ctx.createGain(); sg.gain.value = send; g.connect(sg); sg.connect(this.send); }
    s.start(); return { s, g };
  }
  // positional sound; ref = distance at which it is at full volume
  play3d(name, x, y, z, vol = 1, rate = 1, ref = 3, send = 0.3) {
    const ctx = this.ctx, b = this.buffers[name]; if (!ctx || !b || this.live > 40) return;
    const d = Math.hypot(x - this.lp.x, y - this.lp.y, z - this.lp.z); if (d > ref * 60) return;
    const s = ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate * (0.95 + Math.random() * 0.1);
    const p = ctx.createPanner(); p.panningModel = d < 40 ? 'HRTF' : 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = 1.3; p.maxDistance = 400;
    if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
    const g = ctx.createGain(); let occ = false; if (this.los && d > 1.5) occ = !this.los(this.lp.x, this.lp.y, this.lp.z, x, Math.max(0.3, y), z);
    g.gain.value = vol * (occ ? 0.55 : 1); let node = s;
    if (occ || d > 45) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = occ ? 900 : Math.max(900, 9000 - d * 60); s.connect(f); node = f; }
    node.connect(g); g.connect(p); p.connect(this.master);
    if (send > 0) { const sg = ctx.createGain(); sg.gain.value = send; p.connect(sg); sg.connect(this.send); }
    this.live++; s.onended = () => { this.live--; }; s.start();
  }
  // restrained drone for menu / ending / the last tape
  drone(on) {
    const ctx = this.ctx; if (!ctx) return;
    if (on && !this._drone) { const g = ctx.createGain(); g.gain.value = 0; g.connect(this.master); const os = [55, 82.4, 110.3, 164.5].map((f, i) => { const o = ctx.createOscillator(); o.type = i % 2 ? 'sine' : 'triangle'; o.frequency.value = f; const og = ctx.createGain(); og.gain.value = [0.5, 0.25, 0.18, 0.08][i]; const l = ctx.createOscillator(); l.frequency.value = 0.07 + i * 0.03; const lg = ctx.createGain(); lg.gain.value = 0.12; l.connect(lg); lg.connect(og.gain); l.start(); o.connect(og); og.connect(g); o.start(); return [o, l]; }); g.gain.setTargetAtTime(0.16, ctx.currentTime, 2.5); this._drone = { g, os }; }
    else if (!on && this._drone) { const d = this._drone; this._drone = null; d.g.gain.setTargetAtTime(0, ctx.currentTime, 1.2); setTimeout(() => { for (const [o, l] of d.os) { o.stop(); l.stop(); } }, 5000); }
  }
}

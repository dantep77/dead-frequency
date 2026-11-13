// Cassette playback: voiced lines (system speech synthesis when available, otherwise a garbled
// tape-voice with timed subtitles), tape hiss and per-line sound-design cues.
import { TAPES } from './data/story.js';
const PITCH = { m: 1.05, a: 0.65, n: 1.3, d: 0.8, r: 0.9 }, NAME = { m: 'MARSH', a: 'ARROYO', n: 'DR. NAIR', d: 'CPT. DUNMORE', r: 'RADIO' };

export class TapePlayer {
  constructor(game) { this.g = game; this.cur = null; this.last = -1; }
  get playing() { return !!this.cur; }
  play(i) {
    this.stop(); const g = this.g, a = g.audio, T = TAPES[i]; if (!T) return; this.last = i;
    this.cur = { i, T, line: -1, t: 0, wait: 0.9, spoke: false };
    a.play('tape_click', 1);
    if (a.ctx) { const s = a.ctx.createBufferSource(); s.buffer = a.buffers.hiss; s.loop = true; const gn = a.ctx.createGain(); gn.gain.value = 0.9; s.connect(gn); gn.connect(a.master); s.start(); this.cur.hiss = s; const bed = T.bed === 'outdoor' ? 't_wind' : T.bed === 'hum' ? 't_hum' : 'roomtone'; const b = a.ctx.createBufferSource(); b.buffer = a.buffers[bed]; b.loop = true; const bg = a.ctx.createGain(); bg.gain.value = T.bed === 'hum' ? 0.5 : 0.35; b.connect(bg); bg.connect(a.master); b.start(); this.cur.bed = b; }
    if (i === 9) a.drone(true);
    g.ui.subtitle(`CASSETTE ${i + 1} OF 10 — ${T.title.toUpperCase()} · ${T.date}`, '');
  }
  stop() {
    const c = this.cur; if (!c) return; this.cur = null;
    try { c.hiss && c.hiss.stop(); c.bed && c.bed.stop(); c.murmur && c.murmur.s.stop(); } catch (e) { }
    if (window.speechSynthesis) speechSynthesis.cancel();
    this.g.audio.play('tape_click', 0.8); this.g.audio.drone(false); this.g.ui.subtitle('', '');
  }
  update(dt) {
    const c = this.cur; if (!c) return; const g = this.g; c.t += dt; c.wait -= dt;
    if (c.wait > 0) return;
    if (c.murmur) { try { c.murmur.s.stop(); } catch (e) { } c.murmur = null; }
    c.line++; c.done = false; c.spoke = false;
    if (c.line >= c.T.lines.length) return this.stop();
    const [who, text] = c.T.lines[c.line];
    for (const [li, cue] of c.T.sfx) if (li === c.line) g.audio.play('t_' + cue, 0.8, 1, 0);
    g.ui.subtitle(`CASSETTE ${c.i + 1} OF 10 — ${c.T.title.toUpperCase()} · ${c.T.date}`, text === '...' ? '[ the tape runs on. A carrier tone. Nothing else. ]' : `${NAME[who]}: ${text}`);
    const words = text.split(/\s+/).length, est = text === '...' ? 4 : 1.2 + words * 0.36;
    c.wait = est; g.noise(g.player.pos.x, g.player.pos.z, 5, 'tape');
    if (text === '...') return;
    if (g.speak(text, PITCH[who], 0.93, () => { if (this.cur === c) { c.done = true; c.wait = Math.min(c.wait, 0.45); } })) { c.spoke = true; c.wait = est * 1.7 + 3; }
    else c.murmur = g.audio.play('murmur', 0.35, PITCH[who] * 0.95, 0.1), c.murmur && (c.murmur.s.loop = true);
  }
}

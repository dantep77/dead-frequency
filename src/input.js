// Keyboard / mouse state with action bindings, pointer lock and a no-lock fallback.
export class Input {
  constructor(canvas, settings) {
    this.canvas = canvas; this.settings = settings; this.keys = new Set(); this.pressed = new Set(); this.released = new Set();
    this.dx = 0; this.dy = 0; this.wheel = 0; this.lmb = false; this.rmb = false; this.lmbP = false; this.lmbR = false; this.locked = false; this.enabled = false; this.capture = null; this.noLock = false;
    addEventListener('keydown', (e) => {
      if (this.capture) { e.preventDefault(); const c = this.capture; this.capture = null; c(e.code); return; }
      if (this.enabled && (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'AltLeft')) e.preventDefault();
      if (e.repeat) return; this.keys.add(e.code); this.pressed.add(e.code);
    });
    addEventListener('keyup', (e) => { this.keys.delete(e.code); this.released.add(e.code); });
    addEventListener('blur', () => { this.keys.clear(); this.lmb = this.rmb = false; });
    addEventListener('mousemove', (e) => { if (this.enabled && (this.locked || this.noLock)) { this.dx += e.movementX || 0; this.dy += e.movementY || 0; } });
    canvas.addEventListener('mousedown', (e) => { if (!this.enabled) return; if (!this.locked && !this.noLock) { this.lock(); return; } if (e.button === 0) { this.lmb = true; this.lmbP = true; } if (e.button === 2) this.rmb = true; });
    addEventListener('mouseup', (e) => { if (e.button === 0) { if (this.lmb) this.lmbR = true; this.lmb = false; } if (e.button === 2) this.rmb = false; });
    addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('wheel', (e) => { if (this.enabled) this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; if (this.onLockChange) this.onLockChange(this.locked); });
    document.addEventListener('pointerlockerror', () => { this.noLock = true; });
  }
  lock() { try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { this.noLock = true; }); } catch (e) { this.noLock = true; } }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  code(action) { return this.settings.binds[action]; }
  down(action) { return this.keys.has(this.code(action)); }
  hit(action) { return this.pressed.has(this.code(action)); }
  up(action) { return this.released.has(this.code(action)); }
  endFrame() { this.pressed.clear(); this.released.clear(); this.dx = 0; this.dy = 0; this.wheel = 0; this.lmbP = false; this.lmbR = false; }
  reset() { this.keys.clear(); this.lmb = this.rmb = false; this.endFrame(); }
}

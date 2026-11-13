// Persistent settings + key bindings (localStorage).
export const BIND_LABELS = {
  forward: 'Move forward', back: 'Move back', left: 'Strafe left', right: 'Strafe right', sprint: 'Sprint', crouch: 'Crouch (toggle)', jump: 'Jump / vault',
  interact: 'Interact / pick up', action: 'Grab slide · bolt · pump (hold + move mouse)', slideStop: 'Slide stop · bolt catch · action release', mag: 'Magazine release / insert · cylinder latch · loading gate',
  tap: 'Tap magazine · ejector rod', loadRound: 'Load one round', drawMag: 'Draw / stow magazine', safety: 'Safety · decocker', hammer: 'Hammer (cock; + trigger = lower)', inspect: 'Inspect weapon (hold; mouse rotates)',
  sidearm: 'Draw / holster sidearm', primary: 'Draw / holster primary', bandage: 'Use bandage', medkit: 'Use medkit', drop: 'Drop held weapon', light: 'Flashlight', laser: 'Laser sight',
  inventory: 'Inventory', map: 'Town map', replay: 'Replay / stop last tape',
};
export const DEFAULT_BINDS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', sprint: 'ShiftLeft', crouch: 'KeyC', jump: 'Space',
  interact: 'KeyF', action: 'KeyR', slideStop: 'KeyT', mag: 'KeyE', tap: 'KeyV', loadRound: 'KeyZ', drawMag: 'KeyQ', safety: 'KeyX', hammer: 'KeyH', inspect: 'KeyB',
  sidearm: 'Digit1', primary: 'Digit2', bandage: 'Digit3', medkit: 'Digit4', drop: 'KeyG', light: 'KeyL', laser: 'KeyK', inventory: 'Tab', map: 'KeyM', replay: 'KeyP',
};
const DEF = { sens: 1, fov: 75, volume: 0.8, shadows: true, invertY: false, voice: true, renderScale: 1, binds: { ...DEFAULT_BINDS } };
export function loadSettings() {
  let s = {}; try { s = JSON.parse(localStorage.getItem('df_settings') || '{}'); } catch (e) { }
  return { ...DEF, ...s, binds: { ...DEFAULT_BINDS, ...(s.binds || {}) } };
}
export function saveSettings(s) { try { localStorage.setItem('df_settings', JSON.stringify(s)); } catch (e) { } }
export const keyName = (code) => !code ? '—' : code.replace(/^Key/, '').replace(/^Digit/, '').replace('ShiftLeft', 'L-Shift').replace('ShiftRight', 'R-Shift').replace('ControlLeft', 'L-Ctrl').replace('ControlRight', 'R-Ctrl').replace('AltLeft', 'L-Alt').replace('Arrow', '');

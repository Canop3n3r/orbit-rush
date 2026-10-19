// Orbit Rush settings (Milestone Q): key remapping, sensitivity, units, overlays. No DOM, so tests drive it.
// Stored in localStorage 'orbitrush.settings.v1'. Key remapping works on KeyboardEvent.code values: the game
// keeps listening for its default codes, and translate() maps what the player pressed onto those defaults.
export const SETTINGS_KEY = 'orbitrush.settings.v1';
// [action, label, default code]
export const ACTIONS = [
  ['stage', 'Ignite / stage (press twice)', 'Space'], ['thrUp', 'Throttle up', 'ShiftLeft'], ['thrDown', 'Throttle down', 'ControlLeft'],
  ['thrFull', 'Full throttle', 'KeyZ'], ['thrCut', 'Cut throttle', 'KeyX'],
  ['pitchDn', 'Pitch down', 'KeyW'], ['pitchUp', 'Pitch up', 'KeyS'], ['yawL', 'Yaw left', 'KeyA'], ['yawR', 'Yaw right', 'KeyD'], ['rollL', 'Roll left', 'KeyQ'], ['rollR', 'Roll right', 'KeyE'],
  ['auto', 'AUTO pilot', 'KeyF'], ['sas', 'SAS on/off', 'KeyV'], ['rcs', 'RCS on/off', 'KeyC'],
  ['map', 'Map', 'KeyM'], ['warpUp', 'Warp faster', 'KeyT'], ['warpDn', 'Warp slower', 'Comma'], ['warpAp', 'Warp to apoapsis', 'KeyG'], ['warpNext', 'Warp to next event', 'Period'],
  ['sasNode', 'SAS maneuver', 'Digit8'], ['exec', 'Execute maneuver', 'Digit9'],
  ['deorbit', 'Deorbit & home', 'KeyO'], ['chute', 'Parachutes', 'KeyP'], ['flyBooster', 'Fly the booster', 'KeyY'], ['boosterCam', 'Booster camera', 'KeyB'],
  ['camMode', 'Camera: free / locked', 'Backquote'], ['overlay', 'CoM / CoP / CoT overlay', 'Backslash'],
  ['quicksave', 'Quicksave', 'F5'], ['quickload', 'Quickload', 'F9'], ['pause', 'Pause menu', 'Escape'],
  ['hangar', 'Back to hangar', 'KeyR'], ['fx', 'Effects quality', 'KeyU'], ['learn', 'Learn overlay', 'Slash'],
];
export const DEFAULT_KEYS = Object.fromEntries(ACTIONS.map(a => [a[0], a[2]]));
export const DEFAULTS = { v: 1, keys: {}, sens: { cam: 1, zoom: 1, stick: 1 }, units: 'metric', overlay: false, camStyle: 'free', conic: 'body' };
export function loadSettings(store) {
  try { const s = JSON.parse(store.getItem(SETTINGS_KEY)); if (s && s.v === 1) return { ...DEFAULTS, ...s, sens: { ...DEFAULTS.sens, ...(s.sens || {}) }, keys: { ...(s.keys || {}) } }; } catch (e) { /* corrupt or no storage */ }
  return { ...DEFAULTS, sens: { ...DEFAULTS.sens }, keys: {} };
}
export function saveSettings(store, s) { try { store.setItem(SETTINGS_KEY, JSON.stringify(s)); return true; } catch (e) { return false; } }
export const keyOf = (s, action) => action in s.keys ? s.keys[action] : DEFAULT_KEYS[action]; // null = unbound
// Bind action → code. A code bound to another action is taken from it (that action falls back to unbound: null).
export function bindKey(s, action, code) {
  for (const [a] of ACTIONS) if (a !== action && keyOf(s, a) === code) s.keys[a] = null;
  if (code === DEFAULT_KEYS[action]) delete s.keys[action]; else s.keys[action] = code; return s;
}
export function resetKeys(s) { s.keys = {}; return s; }
// pressed code → the default code the game listens for (or null when that key does nothing now)
export function makeTranslator(s) {
  const map = new Map();
  for (const [a, , def] of ACTIONS) { const k = keyOf(s, a); if (k) map.set(k, def); }
  const defaults = new Set(ACTIONS.map(a => a[2]));
  return code => map.has(code) ? map.get(code) : defaults.has(code) ? null : code;
}
// ---------- units ----------
const FT = 0.3048, MI = 1609.344;
export function fmtDist(m, units = 'metric', big) {
  const a = Math.abs(m);
  if (units === 'imperial') return a >= MI * 0.5 || big ? (m / MI).toLocaleString('en-US', { maximumFractionDigits: a >= MI * 100 ? 0 : 1 }) + ' mi' : (m / FT).toFixed(0) + ' ft';
  return a >= 1000 || big ? (m / 1000).toLocaleString('en-US', { maximumFractionDigits: a >= 1e5 ? 0 : 1, minimumFractionDigits: a >= 1e5 ? 0 : 1 }) + ' km' : m.toFixed(0) + ' m';
}
export function fmtSpeed(mps, units = 'metric') { return units === 'imperial' ? (mps / FT).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' ft/s' : mps.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' m/s'; }
export function fmtMass(t, units = 'metric') { return units === 'imperial' ? (t * 2204.62 / 1000).toFixed(1) + ' klb' : t.toFixed(1) + ' t'; }
// ---------- builder undo / redo ----------
export class History {
  constructor(limit = 100) { this.limit = limit; this.past = []; this.future = []; }
  push(state) { const s = JSON.stringify(state); if (this.past[this.past.length - 1] === s) return; this.past.push(s); if (this.past.length > this.limit) this.past.shift(); this.future = []; }
  undo(cur) { if (!this.past.length) return null; this.future.push(JSON.stringify(cur)); return JSON.parse(this.past.pop()); }
  redo(cur) { if (!this.future.length) return null; this.past.push(JSON.stringify(cur)); return JSON.parse(this.future.pop()); }
  get canUndo() { return this.past.length > 0; } get canRedo() { return this.future.length > 0; }
}

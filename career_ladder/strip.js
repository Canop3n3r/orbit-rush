// Flight stat strip (pure): the one-row line above the bottom bar. Few words, no markup, no CSS.
// Input `f` (plain numbers, metric, built by the host from flight.js; any field may be missing):
//   ap, pe     apoapsis / periapsis altitude above the surface, m (ap may be Infinity = escape; pe < 0 = below ground)
//   dv         total delta-v left in the attached stages, m/s
//   thrust     current max thrust of the active stage, N        mass  current total mass, kg
//   g          local gravity, m/s²                              accel  current acceleration, m/s² (default thrust / mass)
//   maxAlt     highest altitude so far, m (goal progress)       onPad  true before liftoff (Ap/Pe show a dash)
// Output: { items: [{ key, label, value, text }] x6, goal: { label, progress 0..1 } | null }
// `value` is the raw number (null if unknown) so the UI can apply its Units setting; `text` is a metric default.
import { goalProgress } from './goal_progress.js';
export { goalProgress };
export const STRIP_KEYS = ['ap', 'pe', 'dv', 'twr', 'g', 'accel'];
const LABELS = { ap: 'Ap', pe: 'Pe', dv: 'Δv', twr: 'TWR', g: 'g', accel: 'Acc' };
const num = x => typeof x === 'number' && Number.isFinite(x);
const km = m => (Math.abs(m) >= 100000 ? String(Math.round(m / 1000)) : (m / 1000).toFixed(1)) + ' km'; // 412 km, 85.2 km
const int = n => Math.round(n).toLocaleString('en-US');
export function flightStrip(f, goal = null) {
  f = f && typeof f === 'object' ? f : {};
  const twr = num(f.thrust) && num(f.mass) && num(f.g) && f.mass > 0 && f.g > 0 ? f.thrust / (f.mass * f.g) : null;
  const accel = num(f.accel) ? f.accel : num(f.thrust) && num(f.mass) && f.mass > 0 ? f.thrust / f.mass : null;
  const apText = f.onPad ? '—' : f.ap === Infinity ? 'escape' : num(f.ap) ? (f.ap < 0 ? 'under' : km(f.ap)) : '—';
  const peText = f.onPad ? '—' : num(f.pe) ? (f.pe < 0 ? 'under' : km(f.pe)) : '—';
  const v = { ap: f.onPad || !(num(f.ap) || f.ap === Infinity) ? null : f.ap, pe: f.onPad || !num(f.pe) ? null : f.pe, dv: num(f.dv) ? f.dv : null, twr, g: num(f.g) && f.g > 0 ? f.g : null, accel };
  const text = { ap: apText, pe: peText, dv: v.dv === null ? '—' : int(v.dv) + ' m/s', twr: twr === null ? '—' : twr.toFixed(2), g: v.g === null ? '—' : v.g.toFixed(2), accel: accel === null ? '—' : accel.toFixed(1) };
  return { items: STRIP_KEYS.map(key => ({ key, label: LABELS[key], value: v[key], text: text[key] })), goal: goal ? { label: goal.label, progress: goalProgress(goal, f) } : null };
}

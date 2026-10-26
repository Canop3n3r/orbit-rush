// Exhaust STYLE and SIZE as data (QA plume pass): what a plume looks like per propellant, and how big it is for a given engine.
// Pure functions, no three.js: main.js (makePlume sites + emit()) and tests/plume_style.mjs both read this.
//   Look (colours, base opacity k, Mach-diamond strength) stays in fun/plumetable.js PLUME_TABLE; this file adds the rest of the style
//   (length/width factors, smoke, flame puffs, vacuum behaviour) and the size rule (engine -> plume length and width).
import { PLUME_TABLE, lookFor } from '../fun/plumetable.js?v=f5.9-8';
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
// One row per propellant. Lengths are in nozzle EXIT DIAMETERS at sea level and full throttle (a single engine).
//   len    column length (exit diameters)       wid     flame width factor (1 = the classic orange column)
//   smoke  exhaust smoke trail amount (0 = none) puff    hot flame particles near the nozzle (0 = none)
//   glow   nozzle-glow sprite size factor        vacLen  length factor in vacuum     vacK  opacity factor in vacuum  vacW  wide-bell factor in vacuum
//   sooty  true = dark soot in the trail at low altitude (kerosene / RP-1 engines)
export const STYLE = {
  solid:      { len: 24, wid: 1.25, smoke: 2.4,  puff: 1.2,  glow: 1.0,  vacLen: 0.8,  vacK: 1.0,  vacW: 1.0,  sooty: false, note: 'thick bright orange plume, dense white-grey smoke trail' },
  kerolox:    { len: 20, wid: 1.0,  smoke: 1.0,  puff: 1.0,  glow: 1.0,  vacLen: 0.7,  vacK: 0.7,  vacW: 1.0,  sooty: true,  note: 'moderately bright, sooty at low altitude' },
  methalox:   { len: 11, wid: 0.8,  smoke: 0.1,  puff: 0.25, glow: 0.7,  vacLen: 0.7,  vacK: 0.5,  vacW: 1.0,  sooty: false, note: 'small, clean blue-white' },
  hydrolox:   { len: 6,  wid: 0.65, smoke: 0,    puff: 0,    glow: 0.45, vacLen: 0.8,  vacK: 0.3,  vacW: 1.1,  sooty: false, note: 'almost invisible pale blue core, no smoke' },
  hypergolic: { len: 5,  wid: 0.7,  smoke: 0.05, puff: 0.12, glow: 0.5,  vacLen: 0.8,  vacK: 0.35, vacW: 1.1,  sooty: false, note: 'faint, pale, nearly clear' },
  electric:   { len: 1.5, wid: 0.3, smoke: 0,    puff: 0,    glow: 0.25, vacLen: 1.0,  vacK: 1.0,  vacW: 1.0,  sooty: false, note: 'ion / electric: a tiny pale-blue glow' },
};
// colours for electric (not a roster propellant yet: ion thrusters on payloads); everything else is PLUME_TABLE
const ELECTRIC_LOOK = { plume: 0x9ec8ff, glow: 0x6a9cff, core: 0xe6f0ff, bell: 0xb4d2ff, sprite: [1.2, 2.2, 4.0], k: 0.35, smoke: 0, soot: 0, dia: 0, trail: 'none', label: 'tiny pale-blue glow' };
export const STYLE_PROPS = Object.keys(STYLE);
const ALIAS = { ion: 'electric', hall: 'electric', xenon: 'electric', kero: 'kerolox', rp1: 'kerolox', lox: 'kerolox', methane: 'methalox', hydrogen: 'hydrolox', hypergol: 'hypergolic', storable: 'hypergolic', hybrid: 'kerolox' };
export const propOf = p => (STYLE[p] ? p : STYLE[ALIAS[p]] ? ALIAS[p] : 'kerolox');
// the full style of a propellant: colours/opacity/diamonds (plumetable) merged with the shape/smoke/vacuum numbers above
export const styleFor = p => { const q = propOf(p); return { prop: q, ...(q === 'electric' ? ELECTRIC_LOOK : lookFor(q)), ...STYLE[q] }; };
// Nozzle exit diameter (m) of one engine. When the data has no bell this is an ESTIMATE from thrust: exit area scales with thrust at a
// fixed chamber/exit pressure, so D ~ 0.032 * sqrt(thrust kN) for a sea-level bell (about 0.95 m at 900 kN, about 1.6 m at 2.7 MN)
// and ~3x that for a vacuum-optimised extension bell. Clamped so a thruster is never a pinprick and a mega-engine never a wall.
export const estExitDiameter = (tKN, vacuumOnly = false) => clamp(0.032 * Math.sqrt(Math.max(1, tKN)) * (vacuumOnly ? 3 : 1), 0.12, 6);
// A stage with no engine data at all: thrust from the stage's body diameter (~450 kN per m^2 of cross-section), split over the engines.
export const estEngineThrust = (stageD, n = 1) => (stageD > 0 ? 450 * stageD * stageD : 800) / Math.max(1, n);
// Plume size of ONE stage's exhaust. in: { prop, tKN (per engine, vacuum, kN), n (engines), exitR (m, the model's own bell radius when known),
// vacuumOnly, stageD (m) }. out: { prop, D (exit diameter m), rn (exit radius m), len (sea-level full-throttle column length m), wid (width factor),
// style }. Length grows with exit diameter (so with sqrt(thrust)) and a little with the engine count (a cluster's jets merge into a longer column);
// the propellant sets how much of it you can see. Clamped to 1.2..180 m so a tiny upper-stage engine never reads as a booster.
export function plumeDims({ prop, tKN = 0, n = 1, exitR = 0, vacuumOnly = false, stageD = 0 } = {}) {
  const st = styleFor(prop), cnt = Math.max(1, n | 0), t = tKN > 0 ? tKN : estEngineThrust(stageD, cnt), est = estExitDiameter(t, vacuumOnly);
  const D = exitR > 0 ? clamp(2 * exitR, est * 0.4, est * 2.5) : est;
  // length follows the sea-level-equivalent size (a vacuum bell is wide, not long); with a model bell it is the mean of that and the bell
  const Dsl = estExitDiameter(t, false), Dlen = exitR > 0 ? Math.sqrt(Dsl * D) : Dsl;
  const len = clamp(st.len * Dlen * (1 + 0.3 * Math.log(cnt)), 1.2, 180);
  return { prop: st.prop, D, rn: D / 2, len, wid: st.wid, style: st };
}
// Per-frame opacity / size factors from the vacuum fraction (0 sea level .. 1 vacuum): used by emit()
export const vacFactors = (st, vac) => ({ len: 1 + (st.vacLen - 1) * vac, k: 1 + (st.vacK - 1) * vac, bellW: 1 + (st.vacW - 1) * vac });

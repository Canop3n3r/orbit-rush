// rockets-pass-1 (unit 3): the exhaust look as DATA. One row per propellant (the roster's `propellant` field), one rule for
// vacuum vs sea-level nozzles and one for thrust scaling; fun/exhaust.js and main.js read these, no per-rocket special cases.
//   plume/glow/core/bell: outer flame, halo, hot core, vacuum bell colours   sprite: nozzle glow (HDR rgb)
//   k: overall opacity   smoke: exhaust smoke amount   soot: dark smoke (kerolox)   dia: Mach diamond strength
//   trail: what the smoke column looks like ('soot' dirty grey, 'steam' white, 'solid' thick grey-white, 'none')
export const PLUME_TABLE = {
  kerolox:    { plume: 0xffa23a, glow: 0xff6410, core: 0xffe49a, bell: 0xffc07a, sprite: [6, 3.4, 1.1], k: 1.15, smoke: 1.0, soot: 1, dia: 1.0, trail: 'soot',  label: 'orange-yellow, Mach diamonds, sooty trail' },
  methalox:   { plume: 0x74b0ff, glow: 0x4380ff, core: 0xcfe4ff, bell: 0x9cc6ff, sprite: [2.4, 3.6, 6], k: 1.0, smoke: 0.4, soot: 0, dia: 0.9, trail: 'steam', label: 'pale blue, clean, faint steam' },
  hydrolox:   { plume: 0xd8e8ff, glow: 0xa8c4ff, core: 0xf2f8ff, bell: 0xc4d8ff, sprite: [2.2, 2.7, 4.4], k: 0.3, smoke: 0.2, soot: 0, dia: 1.6, trail: 'steam', label: 'nearly transparent blue-white' },
  hypergolic: { plume: 0xffd6a8, glow: 0xffb27a, core: 0xfff4e4, bell: 0xffd8b0, sprite: [3.2, 2.6, 2.0], k: 0.45, smoke: 0.25, soot: 0, dia: 0.3, trail: 'none',  label: 'faint, pale peach' },
  solid:      { plume: 0xffc45c, glow: 0xff8a1e, core: 0xffffff, bell: 0xffe2a8, sprite: [7, 5.2, 3.0], k: 1.3, smoke: 2.4, soot: 0, dia: 0.3, trail: 'solid', label: 'bright orange-white, thick smoke trail' },
};
export const PROPS = Object.keys(PLUME_TABLE);
export const lookFor = prop => PLUME_TABLE[prop] || PLUME_TABLE.kerolox;
// An engine with no sea-level thrust (tSl = 0) is a vacuum nozzle: long extended bell, wider exhaust plume, no sea-level flame shape.
export const isVacuumEngine = e => !!e && !(e.tSl > 0);
// Expansion ratio proxy: vacuum / sea-level thrust (1 = sea-level optimised, larger = vacuum-optimised). Vacuum-only engines get 3.
export const expansionOf = e => (!e ? 1 : isVacuumEngine(e) ? 3 : Math.min(3, Math.max(1, e.tVac / e.tSl)));
// Plume scale from a stage's engines: width/length multiplier grows with sqrt(per-engine thrust) against a 1 MN reference (so a small upper-stage
// engine is a thin jet and a big booster engine a fat one); clamped so nothing becomes a needle or a wall.
export const thrustScale = tVacKN => Math.min(1.6, Math.max(0.55, Math.sqrt(Math.max(1, tVacKN) / 1000)));
// stage engine summary { n, prop, vacuumOnly, expansion, tKN (per engine, vac) } from a roster stage and an engine table
export function stagePlume(stage, ENG) {
  const ids = Object.keys((stage && stage.engines) || {}), es = ids.map(i => ENG[i]).filter(Boolean);
  const vacuumOnly = es.length > 0 && es.every(isVacuumEngine), tKN = es.length ? es.reduce((t, e) => t + e.tVac, 0) / es.length : 0;
  return { n: stage ? stage.engineCount || 0 : 0, prop: PLUME_TABLE[stage && stage.propellant] ? stage.propellant : 'kerolox', vacuumOnly, expansion: es.length ? Math.max(...es.map(expansionOf)) : 1, tKN };
}
// The visible bells of a model stage -> plume layout. `list` = [[x, y, z, exitR], ...] (gfx/vehicles/nozzles.js), `k` = the hero's lateral scale.
// Small bells (verniers, thruster pods: exit radius < 45 % of the biggest) do not get a main plume. Returns null when the stage has no bells.
export function plumeLayout(list, k = 1) {
  if (!list || !list.length) return null;
  const big = Math.max(...list.map(n => n[3])), main = list.filter(n => n[3] >= 0.45 * big), rs = main.map(n => n[3]).sort((a, b) => a - b);
  const rn = rs[rs.length >> 1] * k, pts = main.map(n => [n[0] * k, n[2] * k]), ext = Math.max(...pts.map(p => Math.hypot(p[0], p[1]))) + rn;
  const cen = pts.findIndex(p => Math.hypot(p[0], p[1]) < 0.35 * rn);
  return { n: pts.length, pts, rn, ext, cen, small: list.length - main.length, vac: main.every(n => n[4] === 1) }; // vac: every main bell is a radiative-extension (vacuum) nozzle
}

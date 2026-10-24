// Vehicle geometry and mass properties from its parts.
// The stack is axisymmetric along body +Y. Stations (y, metres) are measured from the engine exit plane of
// the bottom stage still attached (y = 0), so they change when a stage drops.
// A vehicle carries stages[i].parts (bottom → top) built by parts.js; each part: { id, kind, h, d, m (dry, t),
// fuelCap (t), rw (kN·m), F/isp (RCS), cna/chord (fins), gimbal (rad), nose: { cd, rn, cpFrac } }.
// Layout notes for the lessons: CoM = mass-weighted station; CoP = normal-force-weighted station (aero.js).
import { thermalOf } from './thermal.js?v=f5.8m';
const PI = Math.PI;
export function stackGeom(v) {
  const key = v.cur + '|' + (v.fairing > 0 ? 1 : 0);
  if (v._g && v._g.key === key) return v._g;
  const list = [], fins = [], radials = []; let y = 0, rw = 0, rcs = null, dmax = 0, dAero = 0, payloadY = null;
  for (let i = v.cur; i < v.stages.length; i++) {
    const s = v.stages[i], bottom = y; let engH = 0;
    if (s.radial) { // radial boosters ride beside the core from the bottom up: mass, drag and lift, no stack length
      let yr = 0; for (const p of s.parts) { radials.push({ y: yr, h: p.h, d: 2 * (1.25 + (p.dr || 1.8) / 2) + (p.dr || 1.8), m: p.m, fuelCap: p.fuelCap || 0, stage: i, kind: p.kind, id: p.id, p, dr: p.dr || 1.8, sym: s.radial }); yr += p.h; }
      continue;
    }
    for (const p of s.parts) {
      if (p.kind === 'fins') { fins.push({ p, stage: i, bottom }); continue; }
      if (p.kind === 'fairing') continue;
      if (p.kind === 'engine' && y === bottom) engH = p.h;
      if ((p.kind === 'pod' || p.kind === 'payload') && payloadY === null) payloadY = y;
      list.push({ y, h: p.h, d: p.d, m: p.m, fuelCap: p.fuelCap || 0, stage: i, kind: p.kind, id: p.id, nose: p.nose, p });
      if (p.rw) rw += p.rw;
      if (p.kind === 'rcs') rcs = { y: y + p.h / 2, F: p.F, isp: p.isp };
      y += p.h; dmax = Math.max(dmax, p.d); dAero = Math.max(dAero, p.dA || p.d);
    }
    for (const f of fins) if (f.stage === i && f.y === undefined) f.y = bottom + engH + f.p.chord / 2;
  }
  let L = y, nose;
  const topSt = v.stages[v.stages.length - 1], fair = topSt.parts.find(p => p.kind === 'fairing');
  if (v.fairing > 0 && fair) {
    const y0 = payloadY ?? Math.max(0, L - 3), cone = 1.6 * fair.d;
    list.push({ y: y0, h: L - y0 + cone, d: fair.d, m: fair.m, fuelCap: 0, stage: v.stages.length - 1, kind: 'fairing', id: 'fairing', p: fair, covers: y0 });
    L += cone; dmax = Math.max(dmax, fair.d); dAero = Math.max(dAero, fair.dA || fair.d);
    nose = { cd: 1.0, rn: 0.45, y: L - 0.466 * cone, kind: 'ogive fairing' };
  } else {
    const t = list[list.length - 1] || { h: 1, nose: { cd: 1.2, rn: 0.5, cpFrac: 0.4 } }, n = t.nose || { cd: 1.2, rn: 0.5, cpFrac: 0.4 };
    nose = { cd: n.cd, rn: n.rn, y: L - n.cpFrac * t.h, kind: t.id };
  }
  const d = Math.max(dmax, 0.5), dRef = Math.max(dAero, 0.5), A = PI * dRef * dRef / 4; // sizes-1: drag area from the pre-fit diameter (parts.js fitDims)
  // radial boosters: each nose cone + body adds normal force like a small rocket (CNα ≈ 2 per its own area) near its top,
  // and its frontal area adds drag (per the core's reference area)
  const rLen = radials.reduce((s, e) => Math.max(s, e.y + e.h), 0), rSym = radials.length ? radials[0].sym : 0, rD = radials.length ? Math.max(...radials.map(e => e.dr)) : 0;
  const lift = rSym ? [{ p: { cna: 2 * rSym * (rD / d) ** 2 * 0.5, cd: 0 }, y: rLen * 0.75 }] : [];
  const cnaFins = fins.reduce((s, f) => s + f.p.cna, 0) + lift.reduce((s, f) => s + f.p.cna, 0), yFins = cnaFins ? (fins.reduce((s, f) => s + f.p.cna * f.y, 0) + lift.reduce((s, f) => s + f.p.cna * f.y, 0)) / cnaFins : 0;
  const finCd = fins.reduce((s, f) => s + (f.p.cd || 0.06), 0) + (rSym ? 0.5 * rSym * (rD / d) ** 2 : 0);
  // mass elements: the stack parts plus the fins (which add mass and inertia but no length)
  const massList = list.concat(radials).concat(fins.map(f => ({ y: f.y - f.p.chord / 2, h: f.p.chord, d: d + 3.4, m: f.p.m, fuelCap: 0, stage: f.stage, kind: 'fins', id: f.p.id })));
  // base (tail-first) shape: a heat shield is a big blunt face, engines about a metre, anything else ~ its radius
  const bot = list[0] || { kind: 'pod', d }, shieldBase = bot.kind === 'shield';
  const rnTail = shieldBase ? (bot.p && bot.p.rnBase) || 1.2 * bot.d : bot.kind === 'engine' ? 1.0 : bot.d / 2;
  const tailCd = shieldBase ? 1.0 : bot.kind === 'engine' ? 0.8 : 0.85;
  // thermal elements: stack parts bottom → top (parts under the fairing are covered while it is on), then fins
  const fairE = list.find(e => e.kind === 'fairing');
  const thermalList = list.filter(e => e.p && !(fairE && e !== fairE && e.stage === fairE.stage && e.y >= fairE.covers - 1e-6))
    .map(e => ({ p: e.p, d: e.d, y: e.y, h: e.h, th: thermalOf(e.p) }))
    .concat(fins.map(f => ({ p: f.p, d: 0, y: f.y - f.p.chord / 2, h: f.p.chord, th: thermalOf(f.p) })));
  // parachute canister (if any) at the top of the stack still attached
  const chuteE = list.filter(e => e.kind === 'chute').pop();
  const chute = chuteE ? { p: chuteE.p, y: chuteE.y + chuteE.h } : null;
  v._g = { key, list, massList, radials, rLen, L, d, A, cnaNose: 2.0, yNose: nose.y, nose, cnaFins, yFins, finCd, crossK: 1.2 * L * d / A, yBody: L / 2, cdShape: nose.cd, rn: nose.rn, rw, rcs, fins,
    rnTail, tailCd, shieldBase, thermalList, chute };
  return v._g;
}
// Mass (kg), centre of mass station (m) and principal moments of inertia (kg m^2): Ixx = Izz (pitch/yaw), Iyy (roll).
// Each part is a uniform solid cylinder; tanks hold their share of the stage's remaining fuel.
export function massProps(v, g = stackGeom(v)) {
  let m = 0, my = 0;
  const ms = g.massList.map(e => {
    const s = v.stages[e.stage];
    let mt = e.m + (e.fuelCap && s.fuelMax > 0 ? s.fuel * e.fuelCap / s.fuelMax : 0);
    if (e.kind === 'rcs') mt += v.rcsFuel || 0;
    if (e.p && e.p.abl0) mt -= e.p.abl0 - e.p.abl; // ablator burned away
    const kg = mt * 1000; m += kg; my += kg * (e.y + e.h / 2); return kg;
  });
  const ycom = my / m; let Ixx = 0, Iyy = 0;
  g.massList.forEach((e, i) => { const r = e.d / 2, dy = e.y + e.h / 2 - ycom; Ixx += ms[i] * ((3 * r * r + e.h * e.h) / 12 + dy * dy); Iyy += ms[i] * r * r / 2; });
  return { m, ycom, Ixx, Iyy };
}
export const massOf = v => massProps(v).m / 1000; // tonnes

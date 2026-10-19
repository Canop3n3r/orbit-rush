// Orbit Rush parts: the catalog, rocket designs (a vertical stack of parts, top to bottom), staging, and the
// per-stage mass / delta-v / TWR math. No DOM, so the hangar UI, the flight and the tests all share it.
import { G0, R } from './physics.js?v=mm1';

export const ORBIT_DV = 3600; // m/s, roughly what reaching low orbit costs here (incl. gravity + drag losses)
export const AOA_BASE = 0.26, AOA_FINS = 0.42; // rad of angle of attack (at Q > 15 kPa) before the rocket breaks up
// type: pod | payload | fairing | tank | engine | decoupler | fins.  Masses in tonnes, thrust in kN (vacuum).
export const PARTS = {
  probe:   { type: 'pod', name: 'Wren Probe Core', m: 0.5, mult: 1, desc: 'Light uncrewed command core.' },
  crew:    { type: 'pod', name: 'Heron Crew Pod', m: 4.5, mult: 2, desc: 'Two crew, heat shield. ×2 score. Streamlined: no fairing needed.' },
  sat:     { type: 'payload', name: 'Satellite Stack', m: 2.0, mult: 0.5, desc: 'Cargo: +0.5 score multiplier. Blunt: wants a fairing.' },
  fairing: { type: 'fairing', name: 'Clamshell Fairing', m: 0.3, desc: 'Streamlines the top of the rocket. Drops by itself at 40 km.' },
  'tank-s':  { type: 'tank', name: 'FT-3 Tank', fuel: 3, desc: '3 t of fuel, 0.3 t empty.' },
  'tank-m':  { type: 'tank', name: 'FT-6 Tank', fuel: 6, desc: '6 t of fuel, 0.6 t empty.' },
  'tank-l':  { type: 'tank', name: 'FT-12 Tank', fuel: 12, desc: '12 t of fuel, 1.2 t empty.' },
  'tank-xl': { type: 'tank', name: 'FT-25 Tank', fuel: 25, desc: '25 t of fuel, 2.5 t empty.' },
  thumper: { type: 'engine', name: 'Thumper', tv: 215, ispSl: 280, ispVac: 310, m: 1.5, desc: 'High-thrust booster engine. Best at liftoff.' },
  mule:    { type: 'engine', name: 'Mule', tv: 110, ispSl: 265, ispVac: 325, m: 0.8, desc: 'All-rounder: decent thrust, decent efficiency.' },
  lark:    { type: 'engine', name: 'Lark', tv: 90, ispSl: 200, ispVac: 345, m: 0.6, desc: 'Vacuum engine: most efficient in space, weak in thick air.' },
  spark:   { type: 'engine', name: 'Spark', tv: 30, ispSl: 250, ispVac: 320, m: 0.2, desc: 'Tiny engine for light top stages.' },
  dec:     { type: 'decoupler', name: 'Stage Separator', m: 0.3, desc: 'Splits the rocket into stages. Everything below it drops when you stage.' },
  fins:    { type: 'fins', name: 'Tail Fins', m: 0.2, desc: 'More stability: survives harder turns in thick air while attached.' },
};
export const TANK_DRY = 0.1; // empty tank mass per tonne of fuel
export const MAX_ENGINES = 5;
export const partMass = p => { const d = PARTS[p.id]; return d.type === 'tank' ? d.fuel * TANK_DRY : d.type === 'engine' ? d.m * (p.n || 1) : d.m; };

const P = (id, n) => (n ? { id, n } : { id });
export const TEMPLATES = [
  { name: 'Recommended', note: 'Sat Stack on a 2-stage rocket. AUTO reaches orbit; the booster can land if you stage with a few tonnes left.',
    parts: [P('fairing'), P('sat'), P('probe'), P('tank-m'), P('lark'), P('dec'), P('tank-xl'), P('thumper', 3), P('fins')] },
  { name: 'Light & fast', note: 'Probe core on a 5-engine booster: lots of spare Δv for booster landings.',
    parts: [P('fairing'), P('probe'), P('tank-m'), P('lark'), P('dec'), P('tank-xl'), P('thumper', 5)] },
  { name: 'Heavy lift', note: 'Crew pod (×2 score) on a big 5-engine booster.',
    parts: [P('crew'), P('tank-m'), P('tank-s'), P('lark'), P('dec'), P('tank-xl'), P('tank-l'), P('thumper', 5), P('fins')] },
  { name: 'Three-stager', note: 'Booster, Mule middle stage, Spark kick stage: more stages, less dead weight.',
    parts: [P('fairing'), P('sat'), P('probe'), P('tank-s'), P('spark', 2), P('dec'), P('tank-m'), P('mule'), P('dec'), P('tank-l'), P('tank-s'), P('thumper', 3), P('fins')] },
];
export const cloneDesign = d => ({ name: d.name, parts: d.parts.map(p => ({ ...p })) });

// Split a design into stages. Returned in FLIGHT order: [0] fires first (bottom). Each decoupler belongs to
// the stage below it (it drops with that stage). Each stage: { parts (indices into design.parts, top→bottom), ... }.
export function splitStages(design) {
  const groups = [[]];
  design.parts.forEach((p, i) => { if (PARTS[p.id].type === 'decoupler') groups.push([i]); else groups[groups.length - 1].push(i); });
  return groups.reverse(); // bottom group first
}
function combineEngines(list) { // list of {d, n}
  let tv = 0, slT = 0, flow = 0, n = 0;
  for (const { d, n: k } of list) { tv += d.tv * k; slT += d.tv * k * d.ispSl / d.ispVac; flow += d.tv * k / d.ispVac; n += k; }
  if (!n) return null;
  const ispVac = tv / flow, ispSl = ispVac * slT / tv;
  return { eng: { tv: tv / n, ispSl, ispVac }, n };
}
// Physical summary of each stage plus the payload, in flight order.
export function analyze(design) {
  const groups = splitStages(design), parts = design.parts;
  const stages = groups.map(idx => {
    let dry = 0, fuel = 0, fins = false; const engs = [], names = [];
    for (const i of idx) {
      const p = parts[i], d = PARTS[p.id];
      if (d.type === 'pod' || d.type === 'payload' || d.type === 'fairing') continue; // counted as payload
      dry += partMass(p); names.push(d.name);
      if (d.type === 'tank') fuel += d.fuel;
      if (d.type === 'engine') engs.push({ d, n: p.n || 1 });
      if (d.type === 'fins') fins = true;
    }
    const c = combineEngines(engs);
    return { idx, dry, fuel, eng: c && c.eng, n: c ? c.n : 0, fins, engines: engs.map(e => (e.n > 1 ? e.n + '× ' : '') + e.d.name) };
  });
  let payload = 0, fairing = 0, mult = 0, crew = false, cargo = 0, pods = [];
  parts.forEach((p, i) => {
    const d = PARTS[p.id];
    if (d.type === 'pod') { payload += d.m; mult += d.mult; crew = crew || p.id === 'crew'; pods.push(i); }
    if (d.type === 'payload') { payload += d.m; mult += d.mult; cargo++; }
    if (d.type === 'fairing') fairing += d.m;
  });
  const cdA = fairing > 0 || (crew && !cargo) ? 3 : cargo ? 4.2 : 3.3;
  return { stages, payload, fairing, mult: Math.max(1, mult), cdA, crew, cargo, pods };
}
// Per-stage delta-v / TWR / burn time (flight order) and the total.
export function designStats(design) {
  const a = analyze(design), st = a.stages, out = [];
  for (let i = 0; i < st.length; i++) {
    let m0 = a.payload + a.fairing; for (let j = i; j < st.length; j++) m0 += st[j].dry + st[j].fuel;
    const s = st[i], m1 = m0 - s.fuel;
    if (!s.eng || s.fuel <= 0) { out.push({ m0, m1, dv: 0, twr: 0, burn: 0, ispUsed: 0, thrust: 0 }); continue; }
    const tv = s.eng.tv * s.n, isp = i === 0 ? (s.eng.ispSl + s.eng.ispVac) / 2 : s.eng.ispVac;
    const thrust = i === 0 ? tv * s.eng.ispSl / s.eng.ispVac : tv;    // stage 1 lights at sea level
    out.push({ m0, m1, dv: isp * G0 * Math.log(m0 / m1), twr: thrust / (m0 * G0), burn: s.fuel / (tv / (s.eng.ispVac * G0)), ispUsed: isp, thrust });
  }
  const total = out.reduce((t, s) => t + s.dv, 0);
  return { stages: out, total, mass: out.length ? out[0].m0 : 0, twr: out.length ? out[0].twr : 0, analysis: a };
}
// Problems that make a design unflyable (errors) or likely to fail (warnings).
export function validate(design) {
  const errors = [], warnings = [], a = analyze(design), s = designStats(design);
  if (!design.parts.length) errors.push('Add some parts: start with a command pod.');
  if (a.pods.length === 0) errors.push('Add a command pod (Wren Probe Core or Heron Crew Pod).');
  if (a.pods.length > 1) errors.push('Only one command pod per rocket.');
  const top = a.stages[a.stages.length - 1];
  design.parts.forEach((p, i) => {
    const t = PARTS[p.id].type;
    if ((t === 'pod' || t === 'payload' || t === 'fairing') && !top.idx.includes(i)) errors.push(`${PARTS[p.id].name} must be in the top stage (above every separator).`);
  });
  a.stages.forEach((st, i) => {
    const name = `Stage ${i + 1}`;
    if (!st.eng && st.fuel > 0) errors.push(`${name} has fuel but no engine.`);
    else if (!st.eng && st.idx.length) errors.push(`${name} has no engine — remove the extra separator or add an engine.`);
    else if (st.eng && st.fuel <= 0) errors.push(`${name} has an engine but no fuel tank.`);
  });
  if (PARTS[design.parts[design.parts.length - 1]?.id]?.type === 'decoupler') errors.push('A separator at the very bottom does nothing — remove it.');
  if (!errors.length) {
    if (s.twr < 1) warnings.push(`Liftoff TWR ${s.twr.toFixed(2)} is below 1: it won't leave the pad. Add engines (more Thumpers) or lose weight.`);
    else if (s.twr < 1.15) warnings.push(`Liftoff TWR ${s.twr.toFixed(2)} is marginal: expect a slow, lossy climb. Aim for 1.3+.`);
    s.stages.forEach((st, i) => { if (i > 0 && st.twr < 0.45 && st.dv > 0) warnings.push(`Stage ${i + 1} TWR ${st.twr.toFixed(2)} is very low: it may fall back before reaching orbit. Add an engine or move fuel lower.`); });
    if (s.total < ORBIT_DV) warnings.push(`Total Δv ${s.total.toFixed(0)} m/s is below the ~${ORBIT_DV.toLocaleString()} m/s orbit usually needs (the AUTO test flight below has the final word). Add fuel, use a more efficient upper engine (Lark), or a lighter payload.`);
    if (a.cargo && a.fairing === 0) warnings.push('The Satellite Stack is blunt without a fairing: more drag on the way up.');
  }
  return { errors, warnings, ok: !errors.length };
}
// Build the flight vehicle (same shape physics.stepVehicle expects).
export function buildVehicle(design) {
  const a = analyze(design);
  return {
    x: 0, y: R, vx: 0, vy: 0, ang: Math.PI / 2, throttle: 0, clamped: true,
    stages: a.stages.map(s => ({ dry: s.dry, fuel: s.fuel, fuelMax: s.fuel, eng: s.eng || { tv: 0, ispSl: 1, ispVac: 1 }, n: s.n, fins: s.fins })),
    cur: 0, payload: a.payload, fairing: a.fairing, cdA: a.cdA, q: 0, aoa: 0, mult: a.mult,
  };
}
// Breakup tolerance: fins on the current stage or any stage still attached above it help.
export const aoaLimit = v => (v.stages.slice(v.cur).some(s => s.fins) ? AOA_FINS : AOA_BASE);

// ---------- editing helpers (pure: return a new design) ----------
const edit = (d, f) => { const n = cloneDesign(d); f(n.parts); return n; };
export const insertPart = (d, id, at) => edit(d, ps => { const p = { id }; if (PARTS[id].type === 'engine') p.n = 1; ps.splice(Math.max(0, Math.min(at ?? ps.length, ps.length)), 0, p); });
export const removePart = (d, i) => edit(d, ps => ps.splice(i, 1));
export const movePart = (d, from, to) => edit(d, ps => { if (to < 0 || to >= ps.length || from === to) return; const [p] = ps.splice(from, 1); ps.splice(to, 0, p); });
export const setEngines = (d, i, n) => edit(d, ps => { ps[i].n = Math.max(1, Math.min(MAX_ENGINES, n)); });
const isPayloadPart = p => ['pod', 'payload', 'fairing'].includes(PARTS[p.id].type);
// Swap the propulsion parts of two stages (flight-order indices). Pods/payload/fairing stay on top.
export function swapStages(d, a, b) {
  const groups = splitStages(d); if (a < 0 || b < 0 || a >= groups.length || b >= groups.length || a === b) return cloneDesign(d);
  const top = groups.length - 1;
  // groups as arrays of parts, in top→bottom order
  const td = [...groups].reverse().map(g => g.map(i => ({ ...d.parts[i] })));
  const A = top - a, B = top - b; // indices in top→bottom list
  const split = g => ({ keep: g.filter(p => isPayloadPart(p) || PARTS[p.id].type === 'decoupler'), prop: g.filter(p => !isPayloadPart(p) && PARTS[p.id].type !== 'decoupler') });
  const ga = split(td[A]), gb = split(td[B]);
  const rebuild = (keep, prop) => { const dec = keep.filter(p => PARTS[p.id].type === 'decoupler'), pay = keep.filter(p => PARTS[p.id].type !== 'decoupler'); return [...dec, ...pay, ...prop]; };
  td[A] = rebuild(ga.keep, gb.prop); td[B] = rebuild(gb.keep, ga.prop);
  return { name: d.name, parts: td.flat() };
}
export function describe(design) { // short text for a design, e.g. for share text
  const a = analyze(design); return `${a.stages.length}-stage, ${designStats(design).total.toFixed(0)} m/s`;
}

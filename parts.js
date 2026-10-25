// Orbit Rush parts: the catalog, rocket designs (a vertical stack of parts, top to bottom), staging, and the
// per-stage mass / delta-v / TWR math. No DOM, so the hangar UI, the flight and the tests all share it.
import { G0 } from './physics/constants.js?v=f5.9-2';
import { stackGeom, massProps } from './physics/vehicle.js?v=f5.9-2';
import { centerOfPressure } from './physics/aero.js?v=f5.9-2';
import { dimsOf } from './vehicles/dims.js?v=f5.9-2';

export const ORBIT_DV = 9400; // m/s: what reaching low Earth orbit really costs (≈7.8 km/s orbital speed + gravity, drag and steering losses)
// type: pod | payload | fairing | tank | engine | decoupler | fins | rcs | shield | chute.  Masses in tonnes, thrust in kN (vacuum),
// heights h and diameters d in metres. Real-ish values: tank structure is 6% of its fuel; 2.5 m stack diameter.
const D = 2.5, DEG = Math.PI / 180;
export const TANK_DRY = 0.06;
const tankH = (fuel, rho = 1.0) => 0.3 + fuel / (Math.PI * D * D / 4 * rho); // ~1 t of propellant per m^3 (hydrolox ~0.36 t/m^3)
export const PARTS = {
  probe:   { type: 'pod', name: 'Wren Probe Core', m: 0.25, h: 0.9, d: 1.4, rw: 4, mult: 1, nose: { cd: 1.15, rn: 0.6, cpFrac: 0.4 }, desc: 'Light uncrewed command core with reaction wheels (4 kN·m).' },
  crew:    { type: 'pod', name: 'Heron Crew Pod', m: 4.0, h: 3.2, d: D, rw: 12, mult: 2, nose: { cd: 1.3, rn: 2.0, cpFrac: 0.5 }, desc: 'Two crew, blunt heat shield, reaction wheels (12 kN·m). ×2 score.' },
  sat:     { type: 'payload', name: 'Satellite Stack', m: 2.0, h: 2.6, d: 2.2, mult: 0.5, nose: { cd: 1.6, rn: 0.4, cpFrac: 0.3 }, desc: 'Cargo: +0.5 score multiplier. Blunt: wants a fairing.' },
  fairing: { type: 'fairing', name: 'Clamshell Fairing', m: 1.0, d: 2.7, desc: 'Ogive shroud over the payload: much less drag. Drops by itself above 100 km, once heating on the bare payload is under 1.1 kW/m².' },
  'tank-s':  { type: 'tank', name: 'FT-8 Tank', fuel: 8, desc: '8 t of propellant, 0.48 t empty.' },
  'tank-m':  { type: 'tank', name: 'FT-20 Tank', fuel: 20, desc: '20 t of propellant, 1.2 t empty.' },
  'tank-l':  { type: 'tank', name: 'FT-50 Tank', fuel: 50, desc: '50 t of propellant, 3 t empty.' },
  'tank-h2': { type: 'tank', name: 'HX-24 Hydrolox Tank', fuel: 24, rho: 0.36, desc: '24 t of liquid hydrogen + oxygen: light but bulky (0.36 t/m³). Feed it to a Lark or an Osprey.' },
  xenon:   { type: 'tank', name: 'XT-2 Xenon Tank', fuel: 2, rho: 2.0, desc: '2 t of xenon for the Glimmer ion thruster: a tiny tank for a huge Δv.' },
  'tank-xl': { type: 'tank', name: 'FT-100 Tank', fuel: 100, desc: '100 t of propellant, 6 t empty.' },
  'tank-n':  { type: 'tank', name: 'ST-5 Slim Tank', fuel: 5, dia: 1.25, desc: '5 t of propellant in a needle-thin 1.25 m tank: for sounding rockets and slim stacks.' },
  'tank-w':  { type: 'tank', name: 'WT-150 Wide Tank', fuel: 150, dia: 5, desc: '150 t of propellant in a 5 m wide tank: the backbone of heavy lifters.' },
  'tank-r':  { type: 'tank', name: 'RT-40 Booster Tank', fuel: 40, dia: 1.8, desc: '40 t of propellant in a slim 1.8 m tank: made for radial boosters.' },
  thumper: { type: 'engine', name: 'Thumper', tv: 950, ispSl: 285, ispVac: 312, m: 0.55, h: 2.4, gimbal: 5 * DEG, desc: 'High-thrust kerosene booster engine (868 kN at sea level). 5° gimbal.' },
  bison:   { type: 'engine', name: 'Bison', tv: 2400, ispSl: 291, ispVac: 318, m: 1.7, h: 3.3, gimbal: 5 * DEG, desc: 'Heavy-lift kerosene engine (2.2 MN at sea level) for big boosters. 5° gimbal.' },
  mule:    { type: 'engine', name: 'Mule', tv: 450, ispSl: 270, ispVac: 335, m: 0.7, h: 2.2, gimbal: 4 * DEG, desc: 'All-rounder sustainer: good thrust, decent efficiency. 4° gimbal.' },
  lark:    { type: 'engine', name: 'Lark', tv: 110, ispSl: 150, ispVac: 455, m: 0.3, h: 2.6, gimbal: 4 * DEG, desc: 'Hydrogen vacuum engine: Isp 455 s in space, useless at sea level. 4° gimbal.' },
  osprey:  { type: 'engine', name: 'Osprey', tv: 160, ispSl: 210, ispVac: 451, m: 0.5, h: 2.9, gimbal: 4 * DEG, desc: 'Hydrogen upper-stage engine: Isp 451 s in vacuum, 160 kN. The transfer stage for the Moon and Mars.' },
  ion:     { type: 'engine', name: 'Glimmer Ion Thruster', tv: 2, ispSl: 100, ispVac: 3100, m: 0.25, h: 0.8, gimbal: 0, desc: 'Electric thruster: Isp 3,100 s but only 2 kN (game-scaled ~20× a real one; burns take hours, use warp ×50). Vacuum only.' },
  spark:   { type: 'engine', name: 'Spark', tv: 30, ispSl: 220, ispVac: 320, m: 0.06, h: 0.9, gimbal: 0, desc: 'Tiny fixed kick-stage engine (no gimbal: steer with wheels/RCS).' },
  rdec:    { type: 'decoupler', radial: true, name: 'Radial Decoupler', m: 0.12, h: 0, d: 0, desc: 'Bolts boosters to the side of the core in radial symmetry (×2–×6, set with − / +). Put it at the very bottom, followed by the booster tanks and engines: each part below it is mirrored around the core. The boosters fire first and drop when you stage.' },
  dec:     { type: 'decoupler', name: 'Stage Separator', m: 0.3, h: 0.5, d: D, desc: 'Splits the rocket into stages. Everything below it drops when you stage.' },
  fins:    { type: 'fins', name: 'Tail Fins', m: 0.4, cna: 6, chord: 2.4, cd: 0.06, desc: 'Four big fins: move the centre of pressure aft so the rocket weathervanes into the airflow.' },
  tile:    { type: 'shield', name: 'Kiln Tile Heat Shield', m: 0.55, h: 0.35, d: D, rnBase: 3.0, heat: { Tmax: 1900, cA: 20000, eps: 0.88, k: 1.5 },
    desc: 'Reusable ceramic tiles under the pod: radiate reentry heat away up to 1,900 K. Fly it into the airflow (SAS retrograde) on the way home.' },
  ablator: { type: 'shield', name: 'Ember Ablative Shield', m: 0.75, h: 0.4, d: D, rnBase: 3.0, heat: { Tmax: 3000, Tabl: 1450, abl: 0.3, Habl: 1.2e7, cA: 25000, eps: 0.9, k: 1 },
    desc: 'Ablator: chars and burns away (0.3 t of it) to hold its face at 1,450 K. Survives the hottest reentries while ablator lasts.' },
  chute:   { type: 'chute', name: 'Canopy Parachute Pack', m: 0.3, h: 0.6, d: 1.6, nose: { cd: 1.0, rn: 0.8, cpFrac: 0.45 },
    drogue: { cda: 42, qMax: 15000, machMax: 1.2, open: 2.5 }, main: { cda: 1180, vMax: 95, qMax: 4500, open: 6 },
    desc: 'Goes on top of the pod. Drogues: below Mach 1.2 and 15 kPa. Mains: below 95 m/s and 4.5 kPa (~8 m/s touchdown). P deploys; outside the limits they shred.' },
  rcs:     { type: 'rcs', name: 'Puffer RCS Ring', m: 0.15, mono: 0.15, h: 0.4, d: D, F: 2, isp: 240, desc: 'Cold-gas RCS thrusters (2 kN) for rotation and translation. C toggles RCS. 0.15 t monopropellant.' },
};
const tankHd = (fuel, rho = 1.0, dd = D) => 0.3 + fuel / (Math.PI * dd * dd / 4 * rho);
for (const [id, d] of Object.entries(PARTS)) { if (d.type === 'tank') { d.d = d.dia || D; d.h = tankHd(d.fuel, d.rho, d.d); } if (d.type === 'engine') d.d = D; }
export const SYM = [2, 3, 4, 6]; // radial symmetry choices
export const RADIAL_OK = ['tank', 'engine']; // parts that can hang on a radial decoupler
// Radial group: the design parts after a radial decoupler (to the next decoupler). Returns { at, sym, idx } or null.
export function radialGroup(design) {
  const at = design.parts.findIndex(p => PARTS[p.id].radial); if (at < 0) return null;
  const idx = []; for (let i = at + 1; i < design.parts.length && PARTS[design.parts[i].id].type !== 'decoupler'; i++) idx.push(i);
  return { at, sym: design.parts[at].n || 2, idx };
}
export const MAX_ENGINES = 5;
export const partMass = p => { const d = PARTS[p.id]; return d.type === 'tank' ? d.fuel * TANK_DRY : d.type === 'engine' ? d.m * (p.n || 1) : d.type === 'rcs' ? d.m + d.mono : d.m; };

const P = (id, n) => (n ? { id, n } : { id });
export const TEMPLATES = [
  { name: 'Recommended', note: 'Sat Stack on a 2-stage rocket: 3 Thumpers + finned booster, twin-Lark hydrogen upper stage. AUTO reaches orbit with fuel to spare, even after landing the booster.',
    parts: [P('fairing'), P('sat'), P('probe'), P('tank-m'), P('tank-s'), P('lark', 2), P('dec'), P('tank-l'), P('tank-xl'), P('thumper', 3), P('fins')] },
  { name: 'Light & fast', note: 'Probe core on a 3-Thumper booster: lots of spare Δv for booster landings.',
    parts: [P('fairing'), P('probe'), P('tank-m'), P('lark'), P('dec'), P('tank-xl'), P('thumper', 3), P('fins')] },
  { name: 'Heavy lift', note: 'Crew pod (×2 score) with RCS on a Mule upper stage and a 5-Thumper booster.',
    parts: [P('crew'), P('rcs'), P('tank-l'), P('mule'), P('dec'), P('tank-xl'), P('tank-xl'), P('thumper', 5), P('fins')] },
  { name: 'Orbit & home', note: 'Crew capsule (ablative shield + parachutes) under a fairing, Mule service stage, 5-Thumper booster. Orbit, deorbit (O) and splash down: the full round trip.',
    parts: [P('fairing'), P('chute'), P('crew'), P('ablator'), P('dec'), P('tank-l'), P('mule'), P('dec'), P('tank-xl'), P('tank-xl'), P('thumper', 5), P('fins')] },
  { name: 'Three-stager', note: 'Booster, Mule middle stage, Spark kick stage: more stages, less dead weight.',
    parts: [P('fairing'), P('sat'), P('probe'), P('tank-s'), P('spark', 2), P('dec'), P('tank-m'), P('mule'), P('dec'), P('tank-l'), P('tank-xl'), P('thumper', 3), P('fins')] },
  { name: 'Side boosters', note: 'Core stage with four radial boosters (Radial Decoupler ×4, RT-40 tanks, Mule engines) that fire first and drop away, Lark upper stage.',
    parts: [P('fairing'), P('sat'), P('probe'), P('tank-m'), P('tank-s'), P('lark', 2), P('dec'), P('tank-xl'), P('mule', 3), P('fins'), P('rdec', 4), P('tank-r'), P('thumper', 2)] },
  { name: 'Moon lander', goal: 'moon', note: 'Lark lander (lands and stays on the Moon) on an Osprey hydrogen transfer stage, 5-Thumper booster. Orbit, plan a Moon transfer on the map (M), execute it, capture and land.',
    parts: [P('fairing'), P('probe'), P('rcs'), P('tank-m'), P('lark'), P('dec'), P('tank-h2'), P('tank-h2'), P('tank-h2'), P('osprey', 4), P('dec'), P('tank-xl'), P('tank-xl'), P('tank-xl'), P('tank-xl'), P('tank-xl'), P('tank-xl'), P('bison', 5), P('fins')] },
  { name: 'Mars explorer', goal: 'mars', note: 'Entry capsule (ablative shield + parachutes) with a Spark kick stage, Osprey hydrogen transfer stage, 5-Thumper booster. Wait for the window, burn for Mars, aerocapture or enter directly and land under chutes.',
    parts: [P('fairing'), P('chute'), P('probe'), P('ablator'), P('dec'), P('tank-s'), P('spark'), P('dec'), P('tank-h2'), P('tank-h2'), P('tank-h2'), P('osprey', 4), P('dec'), P('tank-xl'), P('tank-xl'), P('tank-xl'), P('tank-xl'), P('tank-xl'), P('tank-xl'), P('bison', 5), P('fins')] },
];
export const cloneDesign = d => ({ name: d.name, ...(d.goal ? { goal: d.goal } : {}), ...(d.incl ? { incl: d.incl } : {}), ...(d.model ? { model: d.model } : {}), ...(d.recovery ? { recovery: d.recovery } : {}), ...(d.sub ? { sub: true } : {}), ...(d.spec ? { spec: d.spec } : {}), parts: d.parts.map(p => ({ ...p })) });

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
    let dry = 0, fuel = 0, fins = false, capsule = false; const engs = [], names = [];
    const rd = PARTS[parts[idx[0]]?.id]?.radial ? parts[idx[0]] : null, k = rd ? rd.n || 2 : 1;
    for (const i of idx) {
      const p = parts[i], d = PARTS[p.id];
      if (d.radial) { dry += d.m * k; continue; }
      if (rd) { dry += partMass(p) * k; if (d.type === 'tank') fuel += d.fuel * k; if (d.type === 'engine') engs.push({ d, n: (p.n || 1) * k }); continue; }
      if (d.type === 'pod') capsule = true;
      if (d.type === 'pod' || d.type === 'payload' || d.type === 'fairing') continue; // counted as payload
      dry += partMass(p); names.push(d.name);
      if (d.type === 'tank') fuel += d.fuel;
      if (d.type === 'engine') engs.push({ d, n: p.n || 1 });
      if (d.type === 'fins') fins = true;
    }
    const c = combineEngines(engs);
    return { idx, dry, fuel, eng: c && c.eng, n: c ? c.n : 0, fins, capsule: capsule && !c && fuel <= 0, radial: rd ? k : 0, engines: engs.map(e => (e.n > 1 ? e.n + '× ' : '') + e.d.name) };
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
// opts.env: 'earth' (default: stage 1 at sea level, the rest in vacuum), 'vac' (all vacuum, Earth g for TWR) or a body
// { g (m/s²), p (surface pressure, fraction of Earth's) }: every stage Δv and TWR as if lit on that body's surface.
export function designStats(design, opts = {}) {
  const a = analyze(design), st = a.stages, out = [], env = opts.env || 'earth', g = env.g || G0, pr = env === 'earth' ? null : env === 'vac' ? 0 : env.p || 0;
  for (let i = 0; i < st.length; i++) {
    let m0 = a.payload + a.fairing; for (let j = i; j < st.length; j++) m0 += st[j].dry + st[j].fuel;
    const s = st[i], m1 = m0 - s.fuel;
    if (!s.eng || s.fuel <= 0) { out.push({ m0, m1, dv: 0, twr: 0, burn: 0, ispUsed: 0, thrust: 0 }); continue; }
    const tv = s.eng.tv * s.n, ispP = s.eng.ispVac - (s.eng.ispVac - s.eng.ispSl) * Math.min(1, pr ?? 0);
    const isp = pr === null ? (i === 0 ? (s.eng.ispSl + s.eng.ispVac) / 2 : s.eng.ispVac) : ispP;
    const thrust = pr === null ? (i === 0 ? tv * s.eng.ispSl / s.eng.ispVac : tv) : tv * ispP / s.eng.ispVac; // stage 1 lights at sea level
    out.push({ m0, m1, dv: isp * G0 * Math.log(m0 / m1), twr: thrust / (m0 * g), burn: s.fuel / (tv / (s.eng.ispVac * G0)), ispUsed: isp, thrust });
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
    if (st.radial && i !== 0) errors.push('Radial boosters must be the first stage to fire.');
    if (!st.eng && st.fuel > 0) errors.push(`${name} has fuel but no engine.`);
    else if (!st.eng && st.idx.length && !(i === a.stages.length - 1 && i > 0 && st.capsule)) errors.push(`${name} has no engine — remove the extra separator or add an engine.`);
    else if (st.eng && st.fuel <= 0) errors.push(`${name} has an engine but no fuel tank.`);
  });
  if (PARTS[design.parts[design.parts.length - 1]?.id]?.type === 'decoupler') errors.push(PARTS[design.parts[design.parts.length - 1].id].radial ? 'A radial decoupler needs booster parts (a tank and an engine) below it.' : 'A separator at the very bottom does nothing — remove it.');
  const rg = radialGroup(design);
  if (rg) {
    if (design.parts.filter(p => PARTS[p.id].radial).length > 1) errors.push('Only one set of radial boosters per rocket.');
    if (rg.idx.length && rg.idx[rg.idx.length - 1] !== design.parts.length - 1) errors.push('Radial boosters go at the very bottom: put the Radial Decoupler and its tanks/engines below everything else.');
    if (rg.idx.some(i => !RADIAL_OK.includes(PARTS[design.parts[i].id].type))) errors.push('Only tanks and engines can hang on a radial decoupler.');
    if (rg.at === 0 || a.stages.length < 2) errors.push('Radial boosters need a core stage above them.');
  }
  if (!errors.length) {
    if (s.twr < 1) warnings.push(`Liftoff TWR ${s.twr.toFixed(2)} is below 1: it won't leave the pad. Add engines (more Thumpers) or lose weight.`);
    else if (s.twr < 1.15) warnings.push(`Liftoff TWR ${s.twr.toFixed(2)} is marginal: expect a slow, lossy climb. Aim for 1.3+.`);
    s.stages.forEach((st, i) => { if (i > 0 && st.twr < 0.3 && st.dv > 0) warnings.push(`Stage ${i + 1} TWR ${st.twr.toFixed(2)} is very low: it may fall back before reaching orbit. Add an engine or move fuel lower.`); });
    if (s.total < ORBIT_DV && !design.sub) warnings.push(`Total Δv ${s.total.toFixed(0)} m/s is below the ~${ORBIT_DV.toLocaleString()} m/s orbit usually needs (the AUTO test flight below has the final word). Add fuel, use a more efficient upper engine (Lark), or a lighter payload.`);
    if (a.cargo && a.fairing === 0) warnings.push('The Satellite Stack is blunt without a fairing: more drag on the way up.');
    if (!design.sub) for (const w of recoveryWarnings(design)) warnings.push(w); // f5.1h (QA): suborbital rockets (Pip, Grasshopper) skip the orbit/reentry advice
    const ab = aeroBalance(design);
    if (ab && !ab.stable) warnings.push(`Aerodynamically unstable: the centre of pressure is ${Math.abs(ab.margin).toFixed(1)} calibers ${ab.margin < 0 ? 'ahead of' : 'behind'} the centre of mass${ab.marginEmpty <= 0 && ab.margin > 0 ? ' at liftoff, but ahead of it once stage 1 is empty' : ''}. It relies on engine gimbal and flips if the engines stop in thick air. Add Tail Fins at the bottom.`);
  }
  return { errors, warnings, ok: !errors.length };
}
// Coming home: a recovery capsule needs a heat shield facing down (bottom of its stage) and parachutes on top.
export function recoveryInfo(design) {
  const a = analyze(design), top = a.stages[a.stages.length - 1], ids = top.idx.map(i => design.parts[i].id);
  const shieldAt = ids.findIndex(id => PARTS[id].type === 'shield'), chute = ids.some(id => PARTS[id].type === 'chute');
  const types = ids.map(id => PARTS[id].type), bottomShield = types.length > 0 && types[types.length - 1] === 'shield';
  return { capsule: !!top.capsule && a.stages.length > 1, shield: shieldAt >= 0, bottomShield, chute, shieldId: shieldAt >= 0 ? ids[shieldAt] : null };
}
function recoveryWarnings(design) {
  const r = recoveryInfo(design), w = [];
  if (!r.shield && !r.chute) return w;
  if (r.chute && !r.shield) w.push('Parachutes but no heat shield: the pod will burn up coming back from orbit. Add a heat shield under the pod.');
  if (r.shield && !r.bottomShield) w.push('Put the heat shield at the very bottom of the top stage (just above the separator) so it faces the airflow on reentry.');
  if (r.shield && !r.chute) w.push('No parachutes: the capsule survives the heat but hits the ground at ~100 m/s. Add a Canopy Parachute Pack on top of the pod.');
  if ((r.shield || r.chute) && !r.capsule) w.push('To come home, the pod + heat shield + parachutes should be their own top stage (a separator below the shield), so the empty upper stage can be dropped before reentry.');
  return w;
}
// Part descriptor for the physics (vehicle.js): geometry, dry mass, tank capacity, actuators.
function partDesc(p, sym = 0) {
  const d = PARTS[p.id], n = p.n || 1, k = sym || 1;
  const o = { id: p.id, kind: d.type, h: d.h || 0, d: d.d || D, m: partMass(p) * k, fuelCap: d.type === 'tank' ? d.fuel * k : 0, nose: d.nose };
  if (sym) { o.radial = sym; o.dr = d.type === 'engine' ? 1.8 : d.d; if (d.type === 'engine') o.n = n * k; }
  if (d.heat) o.heat = d.heat; if (d.rnBase) o.rnBase = d.rnBase;
  if (d.type === 'chute') { o.drogue = d.drogue; o.main = d.main; }
  if (d.type === 'rcs') o.m = d.m;
  if (d.rw) o.rw = d.rw; if (d.type === 'rcs') { o.F = d.F; o.isp = d.isp; }
  if (d.type === 'fins') { o.cna = d.cna; o.chord = d.chord; o.cd = d.cd; }
  if (d.type === 'engine') { o.n = sym ? n * k : n; o.gimbal = d.gimbal; }
  return o;
}
// Build the flight vehicle: stages in flight order, each with its parts bottom → top (physics/vehicle.js).
export function buildVehicle(design) {
  const a = analyze(design);
  const stages = a.stages.map(s => {
    const parts = s.idx.map(i => partDesc(design.parts[i], s.radial)).reverse();
    const engs = s.idx.map(i => design.parts[i]).filter(p => PARTS[p.id].type === 'engine');
    const gimbal = engs.length ? Math.min(...engs.map(p => PARTS[p.id].gimbal)) : 0;
    const dry = parts.filter(p => !['pod', 'payload', 'fairing'].includes(p.kind)).reduce((t, p) => t + p.m, 0);
    return { dry, fuel: s.fuel, fuelMax: s.fuel, ...(s.radial ? { radial: s.radial } : {}), eng: s.eng ? { ...s.eng, gimbal } : { tv: 0, ispSl: 1, ispVac: 1, gimbal: 0 }, n: s.n, fins: s.fins, parts };
  });
  fitDims(stages, dimsOf(design.model));
  const rcsFuel = design.parts.filter(p => p.id === 'rcs').length * PARTS.rcs.mono;
  return { r: [0, 0, 0], v: [0, 0, 0], q: [1, 0, 0, 0], w: [0, 0, 0], throttle: 0, clamped: true, stages, cur: 0,
    payload: a.payload, fairing: a.fairing, rcsFuel, rcsOn: false, sas: 'stab', input: { pitch: 0, yaw: 0, roll: 0 }, trans: [0, 0, 0], mult: a.mult, qk: 0, aoa: 0, cdA: a.cdA };
}
// A house rocket's parts are generic (2.5 m stack), so its physics stack is stretched to the real vehicle's height and
// core diameter (vehicles/dims.js): every core part's height by kh, every diameter by kd. The fairing ogive (1.6 × its
// diameter, physics/vehicle.js stackGeom) counts toward the height. Radial boosters scale with the core.
// dA keeps the pre-fit diameter: the drag reference area stays the one AUTO's ascent is tuned for (real diameters with this
// drag curve lobbed Heron-9 and kept the Space Truck stack out of orbit), so only shape, length and inertia change.
export function fitDims(stages, dm) {
  if (!dm || !(dm.h > 0) || !(dm.d > 0)) return false;
  const core = stages.filter(s => !s.radial), body = core.flatMap(s => s.parts).filter(p => p.kind !== 'fins' && p.kind !== 'fairing');
  const top = core[core.length - 1], fair = top && top.parts.find(p => p.kind === 'fairing');
  const tanks = body.filter(p => p.kind === 'tank'), dCore = Math.max(...(tanks.length ? tanks : body).map(p => p.d || 0));
  const sumH = body.reduce((t, p) => t + (p.h || 0), 0); if (!(dCore > 0) || !(sumH > 0)) return false;
  const kd = dm.d / dCore, cone = fair ? 1.6 * fair.d * kd : 0, kh = Math.max(0.05, (dm.h - cone) / sumH);
  for (const s of stages) for (const p of s.parts) { if (p.h) p.h *= kh; if (p.d) { p.dA = p.d; p.d *= kd; } if (p.dr) p.dr *= kd; }
  return true;
}
// Aero balance for the builder: CoM and CoP stations (m from the bottom), static margin in calibers
// (body diameters; > 0 means the CoP is behind the CoM = weathervane-stable), at liftoff and at stage-1 burnout.
export function aeroBalance(design, mach = 0.5) {
  const v = buildVehicle(design); if (!v.stages.length) return null;
  const g = stackGeom(v), full = massProps(v, g); v.stages[0].fuel = 0; const empty = massProps(v, g);
  const ycp = centerOfPressure(g, mach), ycpSup = centerOfPressure(g, 2.0);
  const marg = (ycom, cp) => (ycom - cp) / g.d;
  return { L: g.L, d: g.d, ycom: full.ycom, ycomEmpty: empty.ycom, ycp, ycpSup, margin: marg(full.ycom, ycp), marginEmpty: marg(empty.ycom, ycp), marginSup: marg(full.ycom, ycpSup), stable: marg(full.ycom, ycp) > 0 && marg(empty.ycom, ycp) > 0, fins: g.cnaFins > 0, geom: g };
}

// ---------- editing helpers (pure: return a new design) ----------
const edit = (d, f) => { const n = cloneDesign(d); f(n.parts); return n; };
export const insertPart = (d, id, at) => edit(d, ps => { const p = { id }; if (PARTS[id].type === 'engine') p.n = 1; if (PARTS[id].radial) p.n = 2; ps.splice(Math.max(0, Math.min(at ?? ps.length, ps.length)), 0, p); });
export const removePart = (d, i) => edit(d, ps => ps.splice(i, 1));
export const movePart = (d, from, to) => edit(d, ps => { if (to < 0 || to >= ps.length || from === to) return; const [p] = ps.splice(from, 1); ps.splice(to, 0, p); });
export const setEngines = (d, i, n) => edit(d, ps => { ps[i].n = Math.max(1, Math.min(MAX_ENGINES, n)); });
export const setSymmetry = (d, i, dir) => edit(d, ps => { const k = SYM.indexOf(ps[i].n || 2); ps[i].n = SYM[Math.max(0, Math.min(SYM.length - 1, (k < 0 ? 0 : k) + dir))]; });
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

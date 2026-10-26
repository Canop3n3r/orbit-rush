// Craft types (f6.2): every payload, capsule or spacecraft a rocket can leave in space is a piloted-capable vessel with its
// own shape, mass split, propulsion and power system. Pure data + one builder (no DOM, no three): the flight sim, the
// vessel list, the model builders and the tests all read this file.
//   mass is the WET mass in tonnes (taken from the payload that actually left the rocket, so nothing is invented);
//   the type only says how that mass splits (propellant / engine / bus) and what the engine and power system are.
//   Thrust is "kN per tonne of wet mass" (= m/s² of acceleration): a readable TWR for any payload size.
import { G0 } from '../physics/constants.js?v=f5.8y';
import * as CAT from '../vehicles/catalog.js?v=f5.8y';

// ---- propulsion families ---------------------------------------------------------------------------------------------
// tPerT: kN per tonne wet (= m/s²). ispVac/ispSl in s. restart: false = a solid motor that cannot be shut off once lit.
// needsPower: the engine only runs while the battery has charge (electric propulsion).
export const PROPULSION = {
  none:       { name: 'No engine', tPerT: 0, ispVac: 1, ispSl: 1, blurb: 'Drifts. It cannot change its own orbit.' },
  coldgas:    { name: 'Cold-gas thruster', tPerT: 0.02, ispVac: 62, ispSl: 40, restart: true, blurb: 'Puffs of nitrogen: tiny but safe. A few dozen mph of Δv.' },
  monoprop:   { name: 'Monopropellant thrusters', tPerT: 0.05, ispVac: 225, ispSl: 120, restart: true, blurb: 'Hydrazine thrusters: gentle, restartable, good for station-keeping.' },
  hypergolic: { name: 'Hypergolic kick motor', tPerT: 0.15, ispVac: 318, ispSl: 140, restart: true, blurb: 'Two liquids that ignite on contact: a strong, reliable burn for raising orbit.' },
  hydrolox:   { name: 'Hydrogen-oxygen engine', tPerT: 0.35, ispVac: 450, ispSl: 180, restart: true, blurb: 'Efficient cryogenic engine: lots of Δv per ton of fuel.' },
  landing:    { name: 'Throttleable landing engine', tPerT: 3.0, ispVac: 311, ispSl: 240, restart: true, blurb: 'Enough thrust to hover over the Moon.' },
  solid:      { name: 'Solid kick motor', tPerT: 1.4, ispVac: 292, ispSl: 200, restart: false, blurb: 'One shot: once lit it burns until it is empty and cannot be stopped.' },
  ion:        { name: 'Ion thruster (game-scaled)', tPerT: 0.02, ispVac: 2800, ispSl: 100, restart: true, needsPower: true, blurb: 'Huge Δv from a sip of xenon, but very gentle and it runs on solar power. Use time warp.' },
};

const SAT = { slew: 0.004, wMax: 0.25 };
// ---- the types -------------------------------------------------------------------------------------------------------
// cls: label for the list · gfx: the model builder kind (gfx/vehicles/payloads.js / craft_models.js) · mass: nominal wet t
// d, h: nominal body diameter / height (m) at the nominal mass, scaled by (m / mass)^(1/3) · propFrac: main propellant / wet
// rcs: share of wet mass as RCS propellant · slew: rad/s² the reaction wheels can give · wMax: top turn rate (rad/s)
// power: { solar W/t, batt Wh/t, idle W/t, eng W/t at full throttle } · crew: seats · shield/chute: can come home
export const CRAFT_TYPES = {
  cubesat:   { id: 'cubesat', name: 'Cubesat', cls: 'Cubesat', gfx: 'cubesat', mass: 0.012, d: 0.22, h: 0.34, prop: 'coldgas', propFrac: 0.06, rcs: 0, slew: 0.06, wMax: 0.8,
    power: { solar: 1800, batt: 2500, idle: 420, eng: 600 }, blurb: 'A shoebox satellite with solar panels and a puff of cold gas.' },
  smallsat:  { id: 'smallsat', name: 'Earth-watcher', cls: 'Satellite', gfx: 'eo', mass: 0.8, d: 1.1, h: 2.4, prop: 'monoprop', propFrac: 0.1, rcs: 0.01, ...SAT, slew: 0.01,
    power: { solar: 1800, batt: 2500, idle: 160, eng: 500 }, blurb: 'Imaging satellite: a telescope tube on a bus with two solar wings.' },
  leosat:    { id: 'leosat', name: 'Flat-pack sat', cls: 'Satellite', gfx: 'flatpack', mass: 0.3, d: 1.6, h: 0.9, prop: 'ion', propFrac: 0.08, rcs: 0, ...SAT, slew: 0.01,
    power: { solar: 4000, batt: 3000, idle: 200, eng: 2200 }, blurb: 'Stackable constellation satellite: one big panel and an ion thruster to climb to its slot.' },
  navsat:    { id: 'navsat', name: 'Nav satellite', cls: 'Satellite', gfx: 'nav', mass: 1.0, d: 1.3, h: 2.0, prop: 'hypergolic', propFrac: 0.2, rcs: 0.01, ...SAT,
    power: { solar: 2200, batt: 3000, idle: 140, eng: 600 }, blurb: 'Navigation satellite for medium orbit: hexagon bus and a flat antenna.' },
  comsat:    { id: 'comsat', name: 'Comm satellite', cls: 'Satellite', gfx: 'comsat', mass: 3.2, d: 1.9, h: 3.4, prop: 'hypergolic', propFrac: 0.45, rcs: 0.012, ...SAT, slew: 0.004,
    power: { solar: 2600, batt: 3500, idle: 120, eng: 500 }, blurb: 'Big dish on a gold bus. A hypergolic kick motor takes it from transfer orbit up to its slot.' },
  geosat:    { id: 'geosat', name: 'Electric GEO sat', cls: 'Satellite', gfx: 'geosat', mass: 5.0, d: 2.2, h: 3.6, prop: 'ion', propFrac: 0.12, rcs: 0, ...SAT, slew: 0.003, wMax: 0.15,
    power: { solar: 3200, batt: 3500, idle: 100, eng: 2400 }, blurb: 'All-electric heavyweight with long solar wings: slow, patient, very efficient.' },
  probe:     { id: 'probe', name: 'Science probe', cls: 'Probe', gfx: 'probe', mass: 0.9, d: 1.6, h: 2.6, prop: 'monoprop', propFrac: 0.22, rcs: 0.02, ...SAT, slew: 0.012,
    power: { solar: 1200, batt: 3000, idle: 130, eng: 400 }, blurb: 'Dish on top, instruments and a monopropellant motor.' },
  crew:      { id: 'crew', name: 'Crew capsule', cls: 'Capsule', gfx: 'crew', mass: 9.0, d: 2.6, h: 6.2, prop: 'hypergolic', propFrac: 0.27, rcs: 0.012, slew: 0.01, wMax: 0.3, crew: 2, shield: 'ablator', chute: true, twoStage: true,
    power: { solar: 1200, batt: 5000, idle: 220, eng: 300 }, blurb: 'Capsule on a service module: burn, drop the service module, heat shield first, then parachutes.' },
  cargo:     { id: 'cargo', name: 'Cargo freighter', cls: 'Capsule', gfx: 'cargo', mass: 6.0, d: 2.2, h: 4.2, prop: 'hypergolic', propFrac: 0.3, rcs: 0.015, ...SAT, slew: 0.006,
    power: { solar: 1800, batt: 3000, idle: 160, eng: 400 }, blurb: 'Pressurised freighter with a docking cone and two solar wings.' },
  station:   { id: 'station', name: 'Station module', cls: 'Station', gfx: 'station', mass: 12.0, d: 3.0, h: 7.5, prop: 'monoprop', propFrac: 0.05, rcs: 0.01, slew: 0.0012, wMax: 0.06,
    power: { solar: 2600, batt: 5000, idle: 300, eng: 300 }, blurb: 'A habitable module: heavy and slow, with gyroscopes for steering.' },
  lander:    { id: 'lander', name: 'Lander', cls: 'Lander', gfx: 'lander', mass: 6.0, d: 3.2, h: 3.4, prop: 'landing', propFrac: 0.55, rcs: 0.02, slew: 0.02, wMax: 0.4,
    power: { solar: 900, batt: 4000, idle: 140, eng: 200 }, blurb: 'Four legs and a throttleable engine strong enough to hover over the Moon.' },
  tug:       { id: 'tug', name: 'Upper-stage tug', cls: 'Tug', gfx: 'tug', mass: 8.0, d: 2.4, h: 5.6, prop: 'hydrolox', propFrac: 0.7, rcs: 0.01, slew: 0.006, wMax: 0.25,
    power: { solar: 800, batt: 2500, idle: 90, eng: 150 }, blurb: 'A reusable space tug: the most Δv per ton in the fleet.' },
  kick:      { id: 'kick', name: 'Solid kick stage', cls: 'Kick stage', gfx: 'kick', mass: 2.2, d: 1.3, h: 2.5, prop: 'solid', propFrac: 0.7, rcs: 0, slew: 0.01, wMax: 0.3,
    power: { solar: 0, batt: 4000, idle: 120, eng: 100 }, blurb: 'One big solid motor: light it and it burns until it is empty.' },
  rideshare: { id: 'rideshare', name: 'Rideshare dispenser', cls: 'Carrier', gfx: 'rideshare', mass: 1.4, d: 1.8, h: 3.8, prop: 'monoprop', propFrac: 0.08, rcs: 0.01, ...SAT, slew: 0.008,
    power: { solar: 1500, batt: 3000, idle: 140, eng: 400 }, carries: { type: 'cubesat', n: 6 }, blurb: 'Carries a ring of cubesats and lets them go one at a time.' },
  roadster:  { id: 'roadster', name: 'Demo payload', cls: 'Demo', gfx: 'roadster', mass: 1.3, d: 1.8, h: 1.4, prop: 'none', propFrac: 0, rcs: 0, slew: 0, wMax: 0.05, noPower: true,
    power: { solar: 0, batt: 0, idle: 0, eng: 0 }, blurb: 'An inert demo mass on a long, quiet orbit. It has no engine.' },
  stage:     { id: 'stage', name: 'Spent stage', cls: 'Stage', gfx: 'stage', mass: 4.0, d: 2.4, h: 8, prop: 'hydrolox', propFrac: 0, rcs: 0, slew: 0, noPower: true, special: true,
    power: { solar: 0, batt: 0, idle: 0, eng: 0 }, blurb: 'The rocket stage you left in orbit. Its engine and wheels work as they did on the way up.' },
};
export const CRAFT_IDS = Object.keys(CRAFT_TYPES);
export const typeOf = id => CRAFT_TYPES[id] || CRAFT_TYPES.comsat;

// visual kind (gfx/vehicles/payload_kinds.js) -> craft type
export const TYPE_OF_KIND = { comsat: 'comsat', eo: 'smallsat', nav: 'navsat', probe: 'probe', cargo: 'cargo', flatpack: 'leosat', rideshare: 'rideshare', roadster: 'roadster',
  cubesat: 'cubesat', geosat: 'geosat', crew: 'crew', station: 'station', lander: 'lander', tug: 'tug', kick: 'kick' };
export const kindOfType = id => typeOf(id).gfx;

// ---- which rocket launches what ------------------------------------------------------------------------------------------
// A launch house gets a bus "family" (0..2 shape variant) and a livery colour from its id; a vehicle's payload class comes from its
// own sourced capacity (vehicles/catalog.js), so a small launcher flies cubesats and small sats, a medium one constellation and
// navigation sats, a GTO launcher a comm or electric GEO sat, and a heavy lifter a station module, tug or freighter.
const hash = s => { let h = 7; for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const LIVERY = [0xc9a043, 0xd8d8d2, 0x9ad0ff, 0xff9a5c, 0x8be08b, 0xe0a0ff, 0xff7a7a, 0xb0b8c8]; // gold, white, ice, orange, green, violet, red, grey
export const houseStyle = house => { const h = hash(house); return { family: h % 3, livery: LIVERY[(h >> 3) % LIVERY.length], tag: String(house || 'orbit') }; };

let _idx = null;
function rosterIndex() { // id -> { company, payloadKg, gto, name }
  if (_idx) return _idx; _idx = new Map();
  const add = (v, co) => { if (!v || !v.id) return; const kg = x => (x && (x.payloadLEO > 0 ? x.payloadLEO : x.payload > 0 ? x.payload : 0)) || 0, m = (v.modes || []).filter(x => kg(x) > 0), big = m.reduce((a, x) => (kg(x) > (a ? kg(a) : 0) ? x : a), null), gto = m.find(x => x.orbit && x.orbit.ha > 20000);
    _idx.set(v.id, { company: v.company || co || 'spacey', payloadKg: big ? kg(big) : (v.payloadGTO || 0), gto: !!gto || !!v.payloadGTO, gtoKg: gto ? gto.payload : (v.payloadGTO || 0), crew: !!v.capsule || /crew/.test(v.id), name: v.name || v.id }); };
  for (const [k, val] of Object.entries(CAT)) if (/^ROSTER_/.test(k) && Array.isArray(val)) for (const v of val) add(v);
  if (Array.isArray(CAT.VEHICLES)) for (const v of CAT.VEHICLES) add(v, 'spacey');
  return _idx; }
export const rosterInfo = id => rosterIndex().get(id) || null;
export const rosterIds = () => [...rosterIndex().keys()];

// info: { model, name, partIds, hasSpec, missionId, constellation, kind (a visual kind already chosen), house, payloadKg }
export function launcherClass(info = {}) {
  const r = rosterInfo(info.model) || rosterInfo(info.base) || null, kg = info.payloadKg > 0 ? info.payloadKg : r ? r.payloadKg : 0;
  const cls = !kg ? 'unknown' : kg < 350 ? 'micro' : kg < 2500 ? 'small' : kg < 9000 ? 'medium' : kg < 30000 ? 'heavy' : 'super';
  return { cls, kg, gto: r ? r.gto : false, company: info.house || (r && r.company) || info.model || 'spacey' };
}
// the craft type this launch deploys. The same function picks the model that rides under the fairing, so what you see leave
// the rocket is what you can pilot.
export function craftTypeFor(info = {}) {
  const ids = info.partIds || [];
  if (info.kind && TYPE_OF_KIND[info.kind] && !['comsat', 'eo', 'nav'].includes(info.kind)) return TYPE_OF_KIND[info.kind];
  if (ids.includes('crew') || (rosterInfo(info.model) || {}).crew) return 'crew';
  if (info.constellation) return 'leosat';
  const L = launcherClass(info), h = hash(L.company + ':' + (info.model || '')), pick = a => a[h % a.length];
  if (info.kind && !L.kg) return TYPE_OF_KIND[info.kind]; // a bare custom stack keeps the look it already had
  if (info.missionId === 'gto-comsat') return L.kg >= 6000 ? 'geosat' : 'comsat';
  if (!L.kg) return ids.includes('probe') && !ids.includes('sat') ? 'probe' : TYPE_OF_KIND[info.kind] || pick(['comsat', 'smallsat', 'navsat']);
  switch (L.cls) {
    case 'micro': return pick(['cubesat', 'cubesat', 'smallsat']);
    case 'small': return pick(['smallsat', 'leosat', 'probe', 'navsat']);
    case 'medium': return L.gto ? pick(['comsat', 'comsat', 'geosat', 'kick']) : pick(['leosat', 'navsat', 'smallsat', 'cargo']);
    case 'heavy': return L.gto ? pick(['geosat', 'comsat', 'tug']) : pick(['cargo', 'station', 'lander', 'tug']);
    default: return pick(['station', 'tug', 'lander', 'cargo']);
  }
}

// ---- the flight vehicle for a craft ---------------------------------------------------------------------------------------------
// Builds a physics vehicle (same shape as parts.js buildVehicle) at the origin, nose +Y. opts: { m (wet t), name, house, fuel: 0..1,
// mono: 0..1, elec: Wh }. A two-stage type (crew) is service module (stage 0) + capsule (stage 1).
export function buildCraftVehicle(typeId, opts = {}) {
  const T = typeOf(typeId), pr = PROPULSION[T.prop] || PROPULSION.none, m = opts.m > 0 ? opts.m : T.mass, s = Math.max(0.3, Math.min(3, Math.cbrt(m / T.mass)));
  const d = Math.max(0.12, T.d * s), H = Math.max(0.25, T.h * s), nose = { cd: 1.2, rn: d / 3, cpFrac: 0.5 };
  const prop = m * T.propFrac, rcsMass = m * (T.rcs || 0), engM = T.prop === 'none' ? 0 : Math.max(0.0002, m * 0.04), tankDry = prop * 0.08;
  const busM = Math.max(0.0002, m - prop - rcsMass - engM - tankDry);
  const fuelK = opts.fuel === undefined ? 1 : Math.max(0, Math.min(1, opts.fuel)), monoK = opts.mono === undefined ? 1 : Math.max(0, Math.min(1, opts.mono));
  const engH = T.prop === 'none' ? 0 : H * 0.2, tankH = prop > 0 ? H * 0.34 : 0, busH = H - engH - tankH;
  const parts = []; // bottom -> top
  if (T.twoStage) return buildTwoStage(T, pr, m, s, opts);
  if (T.prop !== 'none') parts.push({ id: 'cr-engine', kind: 'engine', h: engH, d: d * 0.6, m: engM, n: 1, gimbal: 0 });
  if (prop > 0) parts.push({ id: 'cr-tank', kind: 'tank', h: tankH, d, m: tankDry, fuelCap: prop, nose });
  parts.push({ id: 'cr-bus', kind: 'pod', h: busH, d, m: busM, nose, rw: 0 });
  let rcsFuel = 0;
  if (rcsMass > 0) { parts.push({ id: 'cr-rcs', kind: 'rcs', h: Math.min(0.4 * s, busH * 0.2), d, m: 0.0002, F: 0.025 * m, isp: 220 }); rcsFuel = rcsMass * monoK; }
  const eng = T.prop === 'none' ? { tv: 0, ispSl: 1, ispVac: 1, gimbal: 0 } : { tv: pr.tPerT * m, ispSl: pr.ispSl, ispVac: pr.ispVac, gimbal: 0 };
  const dry = parts.filter(p => p.kind !== 'pod').reduce((t, p) => t + p.m, 0);
  const v = baseVehicle(T, m, [{ dry, fuel: prop * fuelK, fuelMax: prop, eng, n: 1, fins: 0, parts }], rcsFuel, opts);
  setWheels(v, T); return v;
}
function buildTwoStage(T, pr, m, s, opts) {
  const d = T.d * s, H = T.h * s, nose = { cd: 1.1, rn: d * 0.6, cpFrac: 0.5 };
  const capM = m * 0.5, svcM = m - capM, prop = m * T.propFrac, rcsMass = m * T.rcs, engM = m * 0.03, tankDry = prop * 0.08, svcBus = Math.max(0.01, svcM - prop - engM - tankDry);
  const fuelK = opts.fuel === undefined ? 1 : opts.fuel, monoK = opts.mono === undefined ? 1 : opts.mono;
  const svc = [{ id: 'cr-engine', kind: 'engine', h: H * 0.14, d: d * 0.5, m: engM, n: 1, gimbal: 0 }, { id: 'cr-tank', kind: 'tank', h: H * 0.22, d, m: tankDry, fuelCap: prop }, { id: 'cr-svc', kind: 'decoupler', h: H * 0.1, d, m: svcBus }];
  const abl = Math.min(0.12 * capM, 0.6), cap = [
    { id: 'ablator', kind: 'shield', h: H * 0.06, d, m: abl, rnBase: 1.2 * d, heat: { Tmax: 3000, Tabl: 1450, abl: 0.3 * abl * 8, Habl: 1.2e7, cA: 25000, eps: 0.9, k: 1 } },
    { id: 'cr-pod', kind: 'pod', h: H * 0.3, d: d * 0.92, m: capM - abl - 0.3 - rcsMass - 0.02, nose, rw: 0 },
    { id: 'cr-rcs', kind: 'rcs', h: H * 0.06, d: d * 0.6, m: 0.02, F: 0.025 * m, isp: 220 },
    { id: 'chute', kind: 'chute', h: H * 0.08, d: d * 0.6, m: 0.3, nose: { cd: 1.0, rn: 0.8, cpFrac: 0.45 }, drogue: { cda: 42, qMax: 15000, machMax: 1.2, open: 2.5 }, main: { cda: 1180, vMax: 95, qMax: 4500, open: 6 } }];
  const stages = [
    { dry: svc.reduce((t, p) => t + p.m, 0), fuel: prop * fuelK, fuelMax: prop, eng: { tv: pr.tPerT * m, ispSl: pr.ispSl, ispVac: pr.ispVac, gimbal: 0 }, n: 1, fins: 0, parts: svc },
    { dry: cap.filter(p => p.kind !== 'pod').reduce((t, p) => t + p.m, 0), fuel: 0, fuelMax: 0, eng: { tv: 0, ispSl: 1, ispVac: 1, gimbal: 0 }, n: 1, fins: 0, parts: cap }];
  const v = baseVehicle(T, m, stages, rcsMass * monoK, opts); setWheels(v, T); return v;
}
function baseVehicle(T, m, stages, rcsFuel, opts) {
  const pw = T.power || {}, noP = !!T.noPower || !(pw.batt > 0);
  return { r: [0, 0, 0], v: [0, 0, 0], q: [1, 0, 0, 0], w: [0, 0, 0], throttle: 0, clamped: false, stages, cur: 0, payload: 0, fairing: 0, rcsFuel, rcsOn: true, sas: 'stab',
    input: { pitch: 0, yaw: 0, roll: 0 }, trans: [0, 0, 0], mult: 1, qk: 0, aoa: 0, cdA: 1, ut: 0, auto: false, wMax: T.wMax || 0.25, chute: { state: 'stowed', t: 0 }, chuteCdA: 0,
    craft: { type: T.id, name: opts.name || T.name, house: opts.house || null, m, power: true, solid: false, lit: false, brown: false,
      elec: noP ? 0 : opts.elec !== undefined ? opts.elec : pw.batt * m, elecMax: noP ? 0 : pw.batt * m, solarW: noP ? 0 : (pw.solar || 0) * m, idleW: noP ? 0 : (pw.idle || 0) * m, engW: noP ? 0 : (pw.eng || 0) * m, sun: 1, noPower: noP } };
}
// reaction-wheel torque so the craft can really turn at T.slew rad/s² (kN·m on the pod, from the finished mass properties)
function setWheels(v, T) {
  const I = inertia(v), rw = (T.slew || 0) * I / 1000, pod = v.stages.flatMap(s => s.parts).filter(p => p.kind === 'pod');
  pod.forEach(p => { p.rw = rw / pod.length; });
}
function inertia(v) { // pitch/yaw inertia (kg m²) of a uniform-cylinder stack, fuel full
  let y = 0, m = 0, my = 0; const els = [];
  for (const s of v.stages) for (const p of s.parts) { const mt = (p.m + (p.fuelCap || 0)) * 1000; els.push({ y, h: p.h, d: p.d, m: mt }); m += mt; my += mt * (y + p.h / 2); y += p.h; }
  const yc = my / Math.max(m, 1e-9); let I = 0; for (const e of els) I += e.m * ((3 * (e.d / 2) ** 2 + e.h * e.h) / 12 + (e.y + e.h / 2 - yc) ** 2); return Math.max(I, 1e-6);
}
// Δv of the main engine (m/s) and of the RCS propellant for a vehicle built here or a rocket stage
export function engineDv(v) { let m = 0; for (const s of v.stages.slice(v.cur)) m += s.dry + s.fuel + s.parts.filter(p => p.kind === 'pod').reduce((t, p) => t + p.m, 0); m += v.rcsFuel || 0; let dv = 0;
  for (let i = v.cur; i < v.stages.length; i++) { const s = v.stages[i]; if (s.eng && s.eng.tv > 0 && s.fuel > 0) dv += s.eng.ispVac * G0 * Math.log(m / (m - s.fuel)); m -= s.fuel + s.dry; } return dv; }
export const describeType = id => { const T = typeOf(id), p = PROPULSION[T.prop]; return `${T.name} · ${p.name}`; };

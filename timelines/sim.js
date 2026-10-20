// Headless AUTO flights for the data-only vehicles: builds a game Flight from a stand-in part stack with the
// right stage count, then overwrites each stage's masses/engines with vehicles/catalog.js values (game units: t, kN).
// Uses only the public Flight API (no game files changed). Geometry/aero stay those of the stand-in parts (EST).
import { Flight } from '../flight.js';
import { VEHICLES, ENGINES } from '../vehicles/catalog.js';
const P = (id, n) => (n ? { id, n } : { id });
const STAND_IN = {
  2: [P('fairing'), P('sat'), P('probe'), P('tank-xl'), P('lark'), P('dec'), P('tank-xl'), P('tank-xl'), P('thumper', 5), P('fins')],
  radial: [P('fairing'), P('sat'), P('probe'), P('tank-xl'), P('lark'), P('dec'), P('tank-xl'), P('thumper', 3), P('fins'), P('rdec', 2), P('tank-r'), P('thumper', 2)],
};
export const vehicle = id => VEHICLES.find(v => v.id === id);
function engOf(st) { // one equivalent engine type: summed vac thrust, flow-weighted Isp
  let tv = 0, n = 0, fSl = 0, fV = 0, tSl = 0;
  for (const [id, k] of Object.entries(st.engines)) { const e = ENGINES[id], ev = (st.tVacOverride || e.tVac) * k; tv += ev; n += k; fV += ev / (st.ispOverride?.[1] || e.ispVac); const sl = e.tSl * k; tSl += sl; fSl += sl ? sl / (st.ispOverride?.[0] || e.ispSl) : 0; }
  const ispVac = tv / fV, ispSl = fSl ? tSl / fSl : ispVac * 0.45; // vacuum-only engines: crude SL Isp (EST)
  return { eng: { tv: tv / n, ispSl, ispVac }, n };
}
// opts.payload (kg), opts.mode -> reserve; returns { F, cat }
export function makeFlight(id, opts = {}) {
  const cat = vehicle(id), mode = cat.modes.find(m => m.mode === opts.mode) || cat.modes[0];
  const S = cat.stages.filter(s => !s.parallel), side = cat.stages.find(s => s.parallel);
  const design = { name: id, parts: side ? STAND_IN.radial : STAND_IN[2] };
  const F = new Flight(design, opts.hooks || {}, { earthRot: true, t0: opts.t0 });
  const v = F.v, game = side ? [side, ...S] : S;
  if (v.stages.length !== game.length) throw new Error(`${id}: stand-in has ${v.stages.length} stages, catalog ${game.length}`);
  const payloadT = (opts.payload ?? mode.payloadLEO) / 1000;
  game.forEach((st, i) => {
    const gs = v.stages[i], { eng, n } = engOf(st), dryParts = gs.parts.filter(p => !['pod', 'payload', 'fairing'].includes(p.kind));
    const dry0 = dryParts.reduce((t, p) => t + p.m, 0), cap0 = gs.parts.reduce((t, p) => t + (p.fuelCap || 0), 0), dryT = st.dry / 1000, propT = st.prop / 1000;
    dryParts.forEach(p => { p.m *= dryT / dry0; }); gs.parts.forEach(p => { if (p.fuelCap) p.fuelCap *= propT / cap0; });
    const pay = gs.parts.filter(p => p.kind === 'pod' || p.kind === 'payload'); if (pay.length) { const m0 = pay.reduce((t, p) => t + p.m, 0); pay.forEach(p => { p.m *= payloadT / m0; }); }
    Object.assign(gs, { dry: dryT, fuel: propT, fuelMax: propT, eng: { ...eng, gimbal: gs.eng.gimbal || 0.087 }, n });
  });
  if (v.fairing !== undefined) v.fairing = (cat.fairing || 0) / 1000;
  v._g = null; // stackGeom caches part masses/fuelCap at construction: drop it so the catalog masses take effect
  return { F, cat, mode };
}
// Fly AUTO to orbit with the game's own guidance; we stage the booster ourselves when it reaches the catalog
// recovery reserve (the game's auto-staging plans from the stand-in parts, so it is switched off). Records event times.
export function flyAuto(id, opts = {}) {
  const { F, cat, mode } = makeFlight(id, opts), dt = opts.dt || 0.05, ev = {};
  const at = (x = F) => ({ t: +F.met.toFixed(1), alt: Math.round(x === F ? F.alt : x.alt || 0) });
  const mark = (k, x) => { if (!ev[k]) ev[k] = at(x); };
  const reserveT = (opts.reserve ?? mode.reserve?.[0] ?? 0) / 1000, s0 = cat.stages.find(s => s.parallel) ? 1 : 0;
  let cur = F.v.cur, phase = '';
  F.autoStage = false; F.stagePress(); F.setAuto(true, true);
  if (opts.ascent) F.v.ascentTable = opts.ascent; // timelines/ascent.js table, read by autoGuide
  const peak = { q: 0, t: 0, alt: 0 }; let meco = null;
  for (let t = 0; t < (opts.tMax || 1500); t += dt) {
    if (opts.ascent) F.v.ascentMet = F.met;
    F.realT += dt; F.step(dt);
    const q = F.v.tel ? F.v.tel.q : 0; if (F.v.cur === s0 && q > peak.q) Object.assign(peak, { q, t: +F.met.toFixed(1), alt: Math.round(F.alt) });
    if (F.flags.maxq) mark('maxq'); // the game's Max-Q call (q fell 20 % below its peak)
    if (reserveT > 0 && F.v.cur === s0 && F.v.stages[s0].fuel <= reserveT && F.canStage() && F.alt > 2000) { meco = { t: +F.met.toFixed(1), alt: Math.round(F.alt), v: Math.round(F.v.tel?.vAir ?? 0), vIn: Math.round(Math.hypot(...F.v.v)) }; F.stage(); }
    if (F.v.cur !== cur) { mark(cur === 0 ? 'stage1Sep' : 'stage2Sep'); cur = F.v.cur; }
    if (F.flags.fairing) mark('fairing');
    if (F.flags.cutoff) mark('seco');
    const b = F.booster;
    if (b) { if (b.phase !== phase) { phase = b.phase; if (phase === 'entry burn') mark('entryBurn'); if (phase === 'landing burn' || /controlled descent/.test(phase)) mark('landingBurn'); }
      if (b.state === 'landed') mark('boosterLanded'); }
    if (F.flags.dead || F.flags.stranded || (F.flags.cutoff && (!b || b.state !== 'flying'))) break;
  }
  return { ev, peak, meco, F, cat, orbit: !!F.flags.orbit && !F.flags.dead, dead: F.flags.dead, cause: F.flags.cause, boosterState: F.booster && F.booster.state };
}

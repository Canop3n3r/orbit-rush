// Headless tests for the real game rules in flight.js (the same code main.js runs in the browser).
// Run: node tests/flight.mjs   (exits non-zero on failure)
import * as P from '../physics.js?v=f5';
import { Flight, PRESETS, simulateAuto, planBuild, assessDesign, WARPS, shipPos } from '../flight.js?v=f5';
const D = (...ids) => ({ name: 'test', parts: ids.map(x => { const [id, n] = x.split('*'); return n ? { id, n: +n } : { id }; }) });
// short of Δv: crew pod on a small rocket (stands in for the old 3x/15t/3t/crew build)
const LOWDV = D('crew', 'tank-s', 'mule', 'dec', 'tank-m', 'tank-s', 'thumper*2');
let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log('  ✔', name, extra); } else { fail++; console.log('  ✘', name, extra); } };
const km = m => (m / 1000).toFixed(1) + ' km';
const DEF = PRESETS[0];
// After orbit insertion, coast one full revolution: stable means it never dips into the atmosphere.
const { V } = P;
const pitchOf = v => Math.acos(Math.max(-1, Math.min(1, V.dot(P.noseOf(v), V.norm(v.r)))));
function stableOrbit(F) { return Math.min(...P.orbitPoints(F.v.r, F.v.v, 180).map(p => V.len(p) - P.R)); }

console.log('1. Flying the booster (Y, then Y again) keeps the upper stage on a correct ascent');
for (const [reserve, handBack, label] of [[20, 60, 'staged with 20 t, hand back after 60 s'], [18, 30, '18 t reserve, hand back after 30 s'], [20, undefined, '20 t reserve, never hand back'], [12, 5, '12 t reserve, hand back after 5 s']]) {
  let flatLow = 0, autoSeen = false;
  const r = simulateAuto(DEF, { reserve, flyBooster: true, handBack, each: F => {
    const v = F.v; if (v.auto) autoSeen = true;
    const h = F.alt, pitch = pitchOf(v);
    if (v.cur === 1 && v.thrust > 0 && h < 40000 && pitch > 1.4 && P.orbitOf(v).ap < 300000) flatLow += P.PHYS_DT || 0.02;  // >80° below 40 km = the old bug
  } });
  ok(autoSeen && r.orbit && r.pe > P.ORBIT_PE, label, `orbit=${r.orbit} Ap ${km(r.ap)} Pe ${km(r.pe)} S2 left ${r.s2left.toFixed(2)} t`);
  ok(flatLow < 5, '   no flat (>80°) burn below 40 km under autopilot', `${flatLow.toFixed(1)} s`);
}
{ // without L, same reserve, for comparison
  const r = simulateAuto(DEF, { reserve: 20 });
  ok(r.orbit && r.pe > P.ORBIT_PE && r.boosterLanded, 'same rocket without Y: orbit, and the booster auto-lands on the droneship', `Pe ${km(r.pe)}, ${r.F.flags.booster}`);
}

{ // landing by hand (Y) is possible at full scale: a scripted pilot reads the HUD cues (entry-burn advice, 'burn in T-x s',
  // the hoverslam throttle) and flies them through the manual controls: throttle + retro hold
  const r = simulateAuto(DEF, { reserve: 20, flyBooster: true, each: F => {
    const b = F.booster; if (!F.flyingBooster()) return;
    b.retro = true; b.deck = F.ship && V.len(V.sub(shipPos(F.ship, b.clock, true), b.r)) < 2000 ? 3 : 0; b.manual = false; P.boosterAutopilot(b, P.PHYS_DT || 0.02); b.manual = true; // the cue the HUD shows
    b.ut = b.throttle; b.nSel = b.n;
    if (F.ship && (globalThis.__pk = ((globalThis.__pk || 0) + 1) % 10) === 0) { // grid fins toward the ship (the predicted-miss marker)
      const imp = P.predictImpact({ ...b, throttle: 0, fin: null }); if (imp) { const tgt = shipPos(F.ship, imp.t, true), up = V.norm(imp.r), miss = V.sub(tgt, imp.r), hm = V.sub(miss, V.scale(up, V.dot(miss, up)));
        b.fin = b.throttle > 0 ? null : V.scale(hm, Math.min(1, V.len(hm) / 1000) / Math.max(V.len(hm), 1)); } }
  } });
  ok(r.orbit && r.F.flags.boosterBonus > 2500, 'a scripted pilot can land the booster by hand on the droneship', `${r.F.flags.booster} (+${r.F.flags.boosterBonus})`);
}

console.log('2. AUTO (F) gets to a stable orbit by itself (coast + circularization), warp-to-Ap is clean');
for (const pr of PRESETS) {
  const r = simulateAuto(pr);
  const minH = r.orbit ? stableOrbit(r.F) : 0;
  ok(r.orbit && r.pe > P.ORBIT_PE && minH > 120000, `${pr.name} build on AUTO only`, `Ap ${km(r.ap)} Pe ${km(r.pe)} lowest point over 1 orbit ${km(minH)}`);
}
for (const [label, d] of [['low TWR booster (1.21), 3 stages', D('fairing', 'sat', 'probe', 'tank-m', 'lark', 'dec', 'tank-l', 'mule', 'dec', 'tank-xl', 'tank-xl', 'thumper*4', 'fins')],
  ['very low TWR booster (1.11)', D('fairing', 'sat', 'probe', 'tank-m', 'lark', 'dec', 'tank-xl', 'tank-xl', 'thumper*3', 'fins')],
  ['Mule upper stage', D('fairing', 'probe', 'tank-l', 'mule', 'dec', 'tank-xl', 'tank-xl', 'thumper*4', 'fins')],
  ['small payload, 5 Thumpers (TWR 3.4)', D('probe', 'tank-m', 'lark', 'dec', 'tank-xl', 'thumper*5', 'fins')]]) {
  const r = simulateAuto(d);
  ok(r.orbit && r.pe > P.ORBIT_PE, `AUTO orbit, ${label}`, `Pe ${km(r.pe)}, Δv used ${(r.dvUsed / 1000).toFixed(2)} km/s`);
}
{ const a = assessDesign(D('fairing', 'sat', 'probe', 'tank-l', 'lark', 'dec', 'tank-xl', 'tank-xl', 'thumper*4', 'fins'));
  ok(!a.orbit && /upper stage was too weak/.test(a.text), 'a too-weak upper stage gets the right verdict', a.text); }
{ // real-time loop: AUTO + press G during the coast; warp should go high, not stay "x4 (limited)"
  const F = new Flight(DEF); F.stagePress(); F.setAuto(true);
  let maxW = 1, pressedG = false, apAtG = 0, apMaxCoast = 0, burnWarp = 0, steps = 0, limitedCoast = 0, railsSeen = false, airWarp = 0;
  while (steps++ < 60 * 1200 && !(F.flags.orbit && F.v.guid === 'done')) {
    if (!pressedG && F.v.guid === 'coast' && F.canWarpToAp()) { pressedG = F.startAutoWarp(); apAtG = P.orbitOf(F.v).ap; }
    if (F.v.cur === 0 && F.v.stages[0].fuel <= 20 && F.canStage()) F.stage();
    if (F.alt < P.ATM && F.v.thrust > 0) { F.setWarp(WARPS.length - 1, true); airWarp = Math.max(airWarp, F.effWarp()); F.setWarp(F.autoWarp ? F.warpI : 0, true); }
    F.advance(1 / 60); if (F.rails) railsSeen = true;
    if (F.autoWarp) { maxW = Math.max(maxW, F.effWarp()); if (F.v.thrust <= 0 && F.effWarp() < WARPS[F.warpI]) limitedCoast++; }
    if (F.v.guid === 'coast') apMaxCoast = Math.max(apMaxCoast, P.orbitOf(F.v).ap);
    if (F.v.guid === 'circ' && F.v.thrust > 0) burnWarp = Math.max(burnWarp, F.effWarp());
    if (F.flags.dead || F.flags.stranded) break;
  }
  const o = P.orbitOf(F.v);
  ok(pressedG, 'G accepted while AUTO coasts');
  ok(maxW >= 25, 'warp-to-Ap reaches high warp while coasting', `max ×${maxW}`);
  ok(limitedCoast === 0, 'no "(limited)" warp while coasting');
  ok(railsSeen, 'high warp while coasting above 140 km uses exact Kepler rails');
  ok(airWarp === 4, 'warp is capped at ×4 with engines on in the atmosphere', `×${airWarp}`);
  ok(burnWarp <= 1, 'warp drops to ×1 before the AUTO circularization burn', `×${burnWarp}`);
  ok(apMaxCoast - apAtG < 3000, 'Ap does not keep climbing during the coast', `${km(apAtG)} -> max ${km(apMaxCoast)}`);
  ok(F.flags.orbit && o.pe > P.ORBIT_PE, 'orbit reached after warp-to-Ap', `Pe ${km(o.pe)}`);
}

console.log('3. Fairing jettison and mission clock are consistent');
{
  for (const [label, opts] of [['AUTO, default', {}], ['AUTO, booster flown', { reserve: 20, flyBooster: true }], ['AUTO, staged early', { reserve: 40 }]]) {
    let jettAlt = null, jettQ = null;
    const r = simulateAuto(DEF, { ...opts, each: F => { if (jettAlt === null && F.flags.fairing) { jettAlt = F.alt; jettQ = F.v.tel.heat; } } });
    ok(r.F.flags.fairing === 1 && r.F.v.fairing === 0 && jettAlt !== null && jettAlt > P.FAIRING_ALT && jettAlt < P.FAIRING_ALT_MAX + 1500 && (jettQ < P.FAIRING_QDOT * 1.2 || jettAlt > P.FAIRING_ALT_MAX),
      `${label}: fairing jettisoned above ${P.FAIRING_ALT / 1000} km once heating < 1.1 kW/m²`, jettAlt === null ? 'never' : `${km(jettAlt)}, ${jettQ.toFixed(0)} W/m²`);
  }
  // never staging: fairing still drops (it used to require stage 2)
  const F = new Flight(DEF); F.stagePress(); F.setAuto(true);
  for (let i = 0; i < 50 * 400 && !F.flags.fairing && !F.flags.dead; i++) { F.realT += 0.02; F.step(0.02); }
  ok(F.flags.fairing === 1, 'fairing drops even on the first stage', `stage ${F.v.cur + 1} at ${km(F.alt)}`);
  // clock
  const C = new Flight(DEF);
  for (let i = 0; i < 600; i++) C.advance(1 / 60);       // 10 s on the pad before ignition
  ok(C.met === 0, 'T+ clock does not run on the pad before ignition', `met=${C.met}`);
  C.stagePress(); let liftReal = null;
  for (let i = 0; i < 600; i++) { C.advance(1 / 60); if (liftReal === null && C.flags.liftoff) liftReal = i; }
  ok(C.flags.liftoff === 1, 'liftoff happens after ignition');
  const expect = (600 - liftReal) / 60 * 2; // 2x sim speed
  ok(Math.abs(C.met - expect) < 0.2, 'T+ starts at liftoff', `met=${C.met.toFixed(2)} expected ${expect.toFixed(2)}`);
}

console.log('4. Feedback matches what happened');
{ // score freeze
  const F = new Flight(LOWDV); F.stagePress(); F.setAuto(true);
  let ended = false, endScore = 0, later = 0;
  for (let i = 0; i < 120 * 1500; i++) { F.realT += 1 / 120; F.step(1 / 120); if (F.flags.stranded && !ended) { ended = true; endScore = F.finish(); } if (ended && ++later > 120 * 60) break; }
  ok(ended && F.score() === endScore, 'corner score equals end-dialog score after the end screen', `${endScore} vs ${F.score()} (rocket kept coasting 60 s)`);
  ok(F.flags.cause === 'dv' && /Δv/.test(F.advice()), 'low-Δv build gets Δv advice', F.advice());
}
// Scripted pilot: hold a pitch-from-vertical schedule (due east) with SAS stability, full throttle, stage when empty.
function manual(pitchAt, label, cfg = DEF) {
  const F = new Flight(cfg); F.stagePress(); let hq = false; const v = F.v; v.sas = 'stab';
  for (let i = 0; i < 50 * 1500 && !F.flags.dead && !F.flags.stranded && !F.flags.orbit; i++) {
    F.realT += 0.02;
    if (!v.clamped) v.sasHold = P.dirOfPitch(pitchAt(F.alt), P.localFrame(v));
    if (v.cur < F.last && v.stages[v.cur].fuel <= 0 && F.canStage()) F.stage();
    F.step(0.02); if (/HIGH Q/.test(F.hint())) hq = true;
  }
  return { F, hq };
}
{
  const flat = manual(h => Math.min(1.3, h / 6000), 'flat');
  ok((flat.F.flags.stranded && flat.F.flags.cause === 'flat' && /too flat/.test(flat.F.advice())) || /ground|over-pressure|breakup/.test(flat.F.flags.dead), 'too-flat climb fails in a way that explains it', flat.F.flags.dead || flat.F.advice());
  const steep = manual(h => h < 60000 ? 0.05 : 0.3, 'steep');
  ok(steep.F.flags.stranded && steep.F.flags.cause === 'steep' && /too steep/.test(steep.F.advice()), 'too-steep climb gets "too steep" advice', steep.F.flags.dead || steep.F.advice());
  const hq = manual(h => Math.min(1.35, Math.sqrt(h / 70000) * 1.5), 'hq', PRESETS[1]);
  ok(hq.hq && hq.F.flags.highQ, 'HIGH Q prompt appears on a full-throttle manual ascent (Light & fast build)', `max Q ${(hq.F.maxQ / 1000).toFixed(1)} kPa`);
  const m1 = hq.F.flags.mach1; ok(m1 === 1, 'Mach 1 is announced on the way up');
}

console.log('5. Clarity: staging guard, presets, landing warning');
{
  const F = new Flight(DEF);
  ok(F.stagePress() === 'ignite' && F.v.cur === 0, 'first SPACE ignites only');
  for (let i = 0; i < 50 * 30; i++) { F.realT += 0.02; F.step(0.02); }
  ok(F.stagePress() === 'armed' && F.v.cur === 0, 'next SPACE only arms staging');
  F.realT += 3; ok(F.stagePress() === 'armed' && F.v.cur === 0, 'a SPACE more than 2 s later re-arms instead of staging');
  F.realT += 0.5; ok(F.stagePress() === 'stage' && F.v.cur === 1, 'second SPACE within 2 s stages');
  ok(PRESETS[0].name === 'Recommended', 'first hangar preset is Recommended');
  const p = planBuild(DEF); ok(p.minReserve > 0 && p.orbit, 'hangar plan: Recommended build can land the booster and still orbit', `stage with ≥ ${p.minReserve} t`);
  const bad = planBuild(LOWDV); ok(!bad.orbit, 'hangar plan flags a build that cannot land + orbit');
  const pr = simulateAuto(DEF, { reserve: p.minReserve });
  ok(pr.boosterLanded && pr.orbit, 'staging with the planned reserve: booster auto-lands and the payload still orbits', pr.F.flags.booster);
  const msg = [];
  simulateAuto(DEF, { reserve: 0.6, hooks: { toast: m => msg.push(m) } });
  ok(msg.some(m => /not enough for auto-landing/.test(m)), 'staging with too little fuel warns that the booster won\'t land', msg.find(m => /STAGE SEP/.test(m)));
}
console.log('6. Telemetry exposed for effects and lessons (Phase 2/3)');
{
  const F = new Flight(DEF); F.stagePress(); F.setAuto(true, true); const seen = { Tstag: 0, heat: 0, mach: 0, q: 0, space: 0 };
  for (let i = 0; i < 50 * 400 && !F.flags.space; i++) { F.realT += 0.02; F.step(0.02); const t = F.tel; seen.Tstag = Math.max(seen.Tstag, t.Tstag); seen.heat = Math.max(seen.heat, t.heat); seen.mach = Math.max(seen.mach, t.mach); seen.q = Math.max(seen.q, t.q); }
  const t = F.tel;
  ok(['alt', 'mach', 'q', 'aoa', 'gload', 'rho', 'T', 'Tstag', 'heat', 'flowBody', 'vAir', 'ycom', 'ycp'].every(k => k in t) && t.flowBody.length === 3, 'per-frame telemetry: Mach, q, AoA, g, stagnation T, heat flux, body-frame flow direction, CoM/CoP');
  ok(F.flags.space === 1 && seen.mach > 5 && seen.q > 20000 && seen.Tstag > 1000 && seen.heat > 1e4, 'Kármán line flagged; ascent peaks look physical', `M${seen.mach.toFixed(1)}, Max-Q ${(seen.q / 1000).toFixed(1)} kPa, T₀ ${seen.Tstag.toFixed(0)} K, q̇ ${(seen.heat / 1000).toFixed(0)} kW/m²`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

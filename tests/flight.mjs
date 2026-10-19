// Headless tests for the real game rules in flight.js (the same code main.js runs in the browser).
// Run: node tests/flight.mjs   (exits non-zero on failure)
import * as P from '../physics.js?v=mm1';
import { Flight, PRESETS, simulateAuto, planBuild, WARPS } from '../flight.js?v=mm1';
const D = (...ids) => ({ name: 'test', parts: ids.map(x => { const [id, n] = x.split('*'); return n ? { id, n: +n } : { id }; }) });
// short of Δv: crew pod on a small rocket (stands in for the old 3x/15t/3t/crew build)
const LOWDV = D('crew', 'tank-s', 'mule', 'dec', 'tank-m', 'tank-s', 'thumper*2');
let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log('  ✔', name, extra); } else { fail++; console.log('  ✘', name, extra); } };
const km = m => (m / 1000).toFixed(1) + ' km';
const DEF = PRESETS[0];
// After orbit insertion, coast one full revolution: stable means it never dips into the atmosphere.
function stableOrbit(F) {
  const c = { ...F.v, stages: F.v.stages.map(s => ({ ...s })), throttle: 0 }; let minH = Infinity;
  const o = P.orbitOf(c), T = 2 * Math.PI * Math.sqrt(o.a ** 3 / P.MU);
  for (let t = 0; t < T; t += 0.5) { P.stepVehicle(c, 0.5); minH = Math.min(minH, P.altOf(c)); }
  return minH;
}

console.log('1. Flying the booster (L, then L again) keeps the upper stage on a correct ascent');
for (const [reserve, handBack, label] of [[8, 60, 'playtest case: staged ~8 t early, hand back after 60 s'], [4, 30, '4 t reserve, hand back after 30 s'], [6, undefined, '6 t reserve, never hand back'], [2, 5, '2 t reserve, hand back after 5 s']]) {
  let flatLow = 0, autoSeen = false;
  const r = simulateAuto(DEF, { reserve, flyBooster: true, handBack, each: F => {
    const v = F.v; if (v.auto) autoSeen = true;
    const h = F.alt, pitch = Math.abs(Math.atan2(Math.sin(Math.atan2(v.y, v.x) - v.ang), Math.cos(Math.atan2(v.y, v.x) - v.ang)));
    if (v.cur === 1 && v.thrust > 0 && h < 40000 && pitch > 1.4 && P.orbitOf(v).ap < 300000) flatLow += 1 / 120;  // >80° below 40 km = the old bug
  } });
  ok(autoSeen && r.orbit && r.pe > 70000, label, `orbit=${r.orbit} Ap ${km(r.ap)} Pe ${km(r.pe)} S2 left ${r.s2left.toFixed(2)} t`);
  ok(flatLow < 5, '   no flat (>80°) burn below 40 km under autopilot', `${flatLow.toFixed(1)} s`);
}
{ // without L, same reserve, for comparison
  const r = simulateAuto(DEF, { reserve: 8 });
  ok(r.orbit && r.pe > 70000, 'same rocket without L still reaches orbit', `Pe ${km(r.pe)}`);
}

console.log('2. AUTO (F) gets to a stable orbit by itself (coast + circularization), warp-to-Ap is clean');
for (const pr of PRESETS) {
  const r = simulateAuto(pr);
  const minH = r.orbit ? stableOrbit(r.F) : 0;
  ok(r.orbit && r.pe > 70000 && minH > 70000, `${pr.name} build on AUTO only`, `Ap ${km(r.ap)} Pe ${km(r.pe)} lowest point over 1 orbit ${km(minH)}`);
}
for (const [label, d] of [['heavy, low TWR (3 Thumpers, 37 t)', D('fairing', 'sat', 'probe', 'tank-m', 'lark', 'dec', 'tank-xl', 'tank-l', 'thumper*3', 'fins')],
  ['big upper stage', D('fairing', 'sat', 'probe', 'tank-m', 'tank-s', 'lark', 'dec', 'tank-xl', 'thumper*3')],
  ['Mule upper stage', D('fairing', 'probe', 'tank-m', 'mule', 'dec', 'tank-xl', 'thumper*4', 'fins')],
  ['crew on 4 Thumpers', D('crew', 'tank-m', 'lark', 'dec', 'tank-xl', 'tank-m', 'thumper*4', 'fins')]]) {
  const r = simulateAuto(d);
  ok(r.orbit && r.pe > 70000, `AUTO orbit, ${label}`, `Pe ${km(r.pe)}`);
}
{ // real-time loop: AUTO + press G during the coast; warp should go high, not stay "x4 (limited)"
  const F = new Flight(DEF); F.stagePress(); F.setAuto(true);
  let maxW = 1, pressedG = false, apAtG = 0, apMaxCoast = 0, burnWarp = 0, steps = 0, limitedCoast = 0;
  while (steps++ < 60 * 1200 && !(F.flags.orbit && F.v.guid === 'done')) {
    if (!pressedG && F.v.guid === 'coast' && F.canWarpToAp()) { pressedG = F.startAutoWarp(); apAtG = P.orbitOf(F.v).ap; }
    if (F.v.cur === 0 && F.v.stages[0].fuel <= 4 && F.canStage()) F.stage();
    F.advance(1 / 60);
    if (F.autoWarp) { maxW = Math.max(maxW, F.effWarp()); if (F.v.thrust <= 0 && F.effWarp() < WARPS[F.warpI]) limitedCoast++; }
    if (F.v.guid === 'coast') apMaxCoast = Math.max(apMaxCoast, P.orbitOf(F.v).ap);
    if (F.v.guid === 'circ' && F.v.thrust > 0) burnWarp = Math.max(burnWarp, F.effWarp());
    if (F.flags.dead || F.flags.stranded) break;
  }
  const o = P.orbitOf(F.v);
  ok(pressedG, 'G accepted while AUTO coasts');
  ok(maxW >= 25, 'warp-to-Ap reaches high warp while coasting', `max ×${maxW}`);
  ok(limitedCoast === 0, 'no "(limited)" warp while coasting');
  ok(burnWarp <= 1, 'warp drops to ×1 before the AUTO circularization burn', `×${burnWarp}`);
  ok(apMaxCoast - apAtG < 3000, 'Ap does not keep climbing during the coast', `${km(apAtG)} -> max ${km(apMaxCoast)}`);
  ok(F.flags.orbit && o.pe > 70000, 'orbit reached after warp-to-Ap', `Pe ${km(o.pe)}`);
}

console.log('3. Fairing jettison and mission clock are consistent');
{
  for (const [label, opts] of [['AUTO, default', {}], ['AUTO, booster flown', { reserve: 6, flyBooster: true }], ['AUTO, staged dry by AUTO', {}]]) {
    let jettAlt = null;
    const r = simulateAuto(DEF, { ...opts, each: F => { if (jettAlt === null && F.flags.fairing) jettAlt = F.alt; } });
    ok(r.F.flags.fairing === 1 && r.F.v.fairing === 0 && jettAlt !== null && Math.abs(jettAlt - P.FAIRING_ALT) < 1500, `${label}: fairing jettisoned at ${P.FAIRING_ALT / 1000} km`, jettAlt === null ? 'never' : km(jettAlt));
  }
  // never staging: fairing still drops (it used to require stage 2)
  const F = new Flight(DEF); F.stagePress(); F.setAuto(true);
  for (let i = 0; i < 120 * 200 && !F.flags.fairing && !F.flags.dead; i++) { F.realT += 1 / 120; F.step(1 / 120); }
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
function manual(pitchAt, label, cfg = DEF) { // cfg = design // fly with a fixed pitch schedule, full throttle, stage when empty
  const F = new Flight(cfg); F.stagePress(); let hq = false;
  for (let i = 0; i < 120 * 1500 && !F.flags.dead && !F.flags.stranded && !F.flags.orbit; i++) {
    F.realT += 1 / 120; const v = F.v, up = Math.atan2(v.y, v.x);
    if (!v.clamped) v.ang = up - pitchAt(F.alt);
    if (v.cur === 0 && v.stages[0].fuel <= 0 && F.canStage()) F.stage();
    F.step(1 / 120); if (/HIGH Q/.test(F.hint())) hq = true;
  }
  return { F, hq };
}
{
  const flat = manual(h => Math.min(1.25, h / 8000), 'flat');
  ok(flat.F.flags.stranded && flat.F.flags.cause === 'flat' && /too flat/.test(flat.F.advice()) && !/flatter/.test(flat.F.advice()), 'too-flat climb gets "too flat" advice (not "flatter climb")', flat.F.flags.dead || flat.F.advice());
  const hqDef = manual(h => Math.min(1.2, Math.sqrt(h / 50000) * 1.4), 'hq');
  ok(!hqDef.hq || hqDef.F.maxQ > 25, 'no HIGH Q prompt when Q stays low', `max Q ${hqDef.F.maxQ.toFixed(0)} kPa`);
  const steep = manual(h => h < 40000 ? 0.1 : 0.3, 'steep');
  ok(steep.F.flags.stranded && steep.F.flags.cause === 'steep' && /too steep/.test(steep.F.advice()), 'too-steep climb gets "too steep" advice', steep.F.flags.dead || steep.F.advice());
  const hq = manual(h => Math.min(1.2, Math.sqrt(h / 50000) * 1.4), 'hq', PRESETS[1]);
  ok(hq.hq && hq.F.flags.highQ, 'HIGH Q prompt appears on a full-throttle manual ascent (Light & fast build)', `max Q ${hq.F.maxQ.toFixed(0)} kPa`);
}

console.log('5. Clarity: staging guard, presets, landing warning');
{
  const F = new Flight(DEF);
  ok(F.stagePress() === 'ignite' && F.v.cur === 0, 'first SPACE ignites only');
  for (let i = 0; i < 120 * 30; i++) { F.realT += 1 / 120; F.step(1 / 120); }
  ok(F.stagePress() === 'armed' && F.v.cur === 0, 'next SPACE only arms staging');
  F.realT += 3; ok(F.stagePress() === 'armed' && F.v.cur === 0, 'a SPACE more than 2 s later re-arms instead of staging');
  F.realT += 0.5; ok(F.stagePress() === 'stage' && F.v.cur === 1, 'second SPACE within 2 s stages');
  ok(PRESETS[0].name === 'Recommended', 'first hangar preset is Recommended');
  const p = planBuild(DEF); ok(p.minReserve > 0 && p.orbit, 'hangar plan: Recommended build can land the booster and still orbit', `stage with ≥ ${p.minReserve} t`);
  const bad = planBuild(LOWDV); ok(!bad.orbit, 'hangar plan flags a build that cannot land + orbit');
  const msg = [];
  simulateAuto(DEF, { reserve: 0.6, hooks: { toast: m => msg.push(m) } });
  ok(msg.some(m => /not enough for auto-landing/.test(m)), 'staging with too little fuel warns that the booster won\'t land', msg.find(m => /STAGE SEP/.test(m)));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

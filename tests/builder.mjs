// Part-builder tests: per-stage Δv/TWR math, staging from decouplers, validation, templates on AUTO,
// and a hand-built three-stage rocket that stages correctly in the real flight rules.
// Run: node tests/builder.mjs   (exits non-zero on failure)
import * as P from '../physics.js?v=f5b.1';
import { PARTS, TEMPLATES, TANK_DRY, analyze, designStats, validate, splitStages, swapStages, insertPart, movePart, removePart, setEngines, buildVehicle, aeroBalance } from '../parts.js?v=f5b.1';
import { Flight, simulateAuto, assessDesign } from '../flight.js?v=f5b.1';
let pass = 0, fail = 0;
const ok = (c, name, extra = '') => { if (c) { pass++; console.log('  ✔', name, extra); } else { fail++; console.log('  ✘', name, extra); } };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const D = (...ids) => ({ name: 'test', parts: ids.map(x => { const [id, n] = x.split('*'); return n ? { id, n: +n } : { id }; }) });
const { V } = P;
const g = P.G0, km = m => (m / 1000).toFixed(1) + ' km';

console.log('1. Mass, Δv and TWR per stage');
{
  const d = D('probe', 'tank-m', 'lark', 'dec', 'tank-xl', 'thumper*3'), s = designStats(d), Pt = PARTS;
  // by hand from the catalog: payload = probe; S2 = FT-20 + Lark; S1 = separator + FT-100 + 3 Thumpers
  const pay = Pt.probe.m, s2dry = Pt['tank-m'].fuel * TANK_DRY + Pt.lark.m, s2f = Pt['tank-m'].fuel, s1dry = Pt.dec.m + Pt['tank-xl'].fuel * TANK_DRY + 3 * Pt.thumper.m, s1f = Pt['tank-xl'].fuel;
  const m0a = pay + s2dry + s2f + s1dry + s1f, m1a = m0a - s1f, m0b = pay + s2dry + s2f, m1b = m0b - s2f;
  ok(s.stages.length === 2, 'two stages from one separator');
  ok(near(s.stages[0].m0, m0a) && near(s.stages[0].m1, m1a), 'stage 1 wet/dry mass', `${s.stages[0].m0.toFixed(2)} → ${s.stages[0].m1.toFixed(2)} t`);
  ok(near(s.stages[1].m0, m0b) && near(s.stages[1].m1, m1b), 'stage 2 wet/dry mass', `${s.stages[1].m0.toFixed(2)} → ${s.stages[1].m1.toFixed(2)} t`);
  const th = Pt.thumper, lk = Pt.lark, dv1 = (th.ispSl + th.ispVac) / 2 * g * Math.log(m0a / m1a), dv2 = lk.ispVac * g * Math.log(m0b / m1b);
  ok(near(s.stages[0].dv, dv1) && near(s.stages[1].dv, dv2), 'Δv per stage = Isp·g0·ln(m0/m1)', `${s.stages[0].dv.toFixed(0)} + ${s.stages[1].dv.toFixed(0)} m/s`);
  ok(near(s.total, dv1 + dv2), 'total Δv is the sum');
  const twr1 = 3 * th.tv * th.ispSl / th.ispVac / (m0a * g), twr2 = lk.tv / (m0b * g);
  ok(near(s.stages[0].twr, twr1) && near(s.stages[1].twr, twr2), 'TWR: stage 1 at sea level, stage 2 in vacuum', `${s.stages[0].twr.toFixed(3)} / ${s.stages[1].twr.toFixed(3)}`);
  ok(near(s.stages[0].burn, s1f / (3 * th.tv / (th.ispVac * g))), 'burn time = fuel / mass flow', `${s.stages[0].burn.toFixed(1)} s`);
  // mixed engines in one stage: thrust adds, Isp is the thrust-weighted harmonic mean
  const m = analyze(D('probe', 'tank-l', 'thumper', 'lark')).stages[0], tv = th.tv + lk.tv, isp = tv / (th.tv / th.ispVac + lk.tv / lk.ispVac);
  ok(near(m.eng.tv * m.n, tv) && near(m.eng.ispVac, isp) && m.n === 2, 'mixed engines combine (thrust sum, harmonic Isp)', `${(m.eng.tv * m.n).toFixed(0)} kN, Isp ${m.eng.ispVac.toFixed(1)} s`);
  // the flight vehicle uses exactly these numbers
  const v = buildVehicle(d);
  ok(near(P.massOf(v), m0a) && v.stages[0].n === 3 && near(v.stages[0].eng.tv, th.tv) && near(v.stages[1].fuel, s2f), 'flight vehicle has the built mass, engines and fuel', `${P.massOf(v).toFixed(2)} t`);
  const F = new Flight(d, {}, { earthRot: false }); F.stagePress(); for (let i = 0; i < 600 && F.v.clamped; i++) F.step(1 / 120);
  const up = V.norm(F.v.r), v0 = V.dot(F.v.v, up); F.step(0.5); const acc = (V.dot(F.v.v, up) - v0) / 0.5;
  const expect = 3 * th.tv * 1000 * th.ispSl / th.ispVac / (P.massOf(F.v) * 1000) - P.gravityAt(F.alt);
  ok(Math.abs(acc - expect) < 0.3, 'liftoff acceleration matches built thrust/mass', `${acc.toFixed(2)} vs ${expect.toFixed(2)} m/s²`);
  // geometry: tank length follows its propellant volume, stack length is the sum of the parts
  const g2 = P.stackGeom(v); ok(Math.abs(g2.L - v.stages.flatMap(s => s.parts).filter(p => p.kind !== 'fins' && p.kind !== 'fairing').reduce((t, p) => t + p.h, 0)) < 1e-9, 'stack length = sum of part heights', `${g2.L.toFixed(1)} m, ⌀ ${g2.d} m`);
}

console.log('1b. Aero balance (CoM vs CoP) shown in the hangar');
{
  const base = D('fairing', 'sat', 'probe', 'tank-m', 'lark', 'dec', 'tank-l', 'tank-xl', 'thumper*3'), withFins = { ...base, parts: [...base.parts, { id: 'fins' }] };
  const a = aeroBalance(base), b = aeroBalance(withFins);
  ok(b.ycp < a.ycp && b.margin > a.margin + 1, 'tail fins pull the CoP aft and add static margin', `${a.margin.toFixed(2)} → ${b.margin.toFixed(2)} cal`);
  ok(b.stable && !a.stable, 'with fins stable, without fins unstable');
  ok(validate(base).warnings.some(w => /unstable/i.test(w)) && !validate(withFins).warnings.some(w => /unstable/i.test(w)), 'validation warns about an unstable rocket');
  ok(b.marginEmpty > b.margin, 'margin grows as the booster drains (CoM moves up)', `${b.margin.toFixed(2)} → ${b.marginEmpty.toFixed(2)} cal`);
  ok(TEMPLATES.every(t => aeroBalance(t).stable), 'every template is aerodynamically stable');
}

console.log('2. Stages, validation and editing');
{
  const d = D('fairing', 'probe', 'tank-s', 'spark', 'dec', 'tank-m', 'mule', 'dec', 'tank-l', 'thumper*2', 'fins');
  const st = splitStages(d);
  ok(st.length === 3 && st[0].includes(7) && st[1].includes(4) && st[2].includes(0), 'separators split 3 stages; each separator drops with the stage below it');
  ok(validate(d).ok, 'sensible 3-stage design validates');
  ok(!validate(D('tank-m', 'lark')).ok && /command pod/.test(validate(D('tank-m', 'lark')).errors[0]), 'no pod → error');
  ok(validate(D('probe', 'tank-m', 'dec', 'tank-xl', 'thumper')).errors.some(e => /Stage 2 has fuel but no engine/.test(e)), 'stage without engine → error');
  ok(validate(D('probe', 'lark', 'dec', 'tank-xl', 'thumper')).errors.some(e => /no fuel tank/.test(e)), 'engine without tank → error');
  ok(validate(D('tank-m', 'lark', 'dec', 'probe', 'tank-xl', 'thumper')).errors.some(e => /top stage/.test(e)), 'pod below a separator → error');
  ok(validate(D('probe', 'tank-m', 'lark', 'dec')).errors.some(e => /very bottom/.test(e)), 'separator at the bottom → error');
  ok(validate(D('probe', 'tank-xl', 'spark')).warnings.some(w => /below 1/.test(w)), 'TWR < 1 → warning');
  const sw = swapStages(d, 1, 2), ids = sw.parts.map(p => p.id).join(',');
  ok(ids === 'fairing,probe,tank-m,mule,dec,tank-s,spark,dec,tank-l,thumper,fins', 'stage reorder swaps engines+tanks, pod/fairing stay on top', ids);
  ok(validate(sw).ok && designStats(sw).stages.length === 3, 'reordered design still valid');
  let e = insertPart(D('probe'), 'tank-m', 1); e = insertPart(e, 'lark', 2); e = setEngines(e, 2, 9);
  ok(e.parts[2].n === 5, 'engine count clamps to 5');
  e = movePart(e, 2, 1); ok(e.parts[1].id === 'lark', 'move part'); e = removePart(e, 1); ok(e.parts.length === 2, 'remove part');
}

console.log('3. Every template reaches orbit on AUTO');
ok(TEMPLATES[0].name === 'Recommended', 'Recommended is the first (default) template');
for (const t of TEMPLATES) {
  const r = simulateAuto(t), s = designStats(t);
  ok(validate(t).ok && r.orbit && r.pe > P.ORBIT_PE, `${t.name} (${s.stages.length} stages, ${s.total.toFixed(0)} m/s)`, `Ap ${km(r.ap)} Pe ${km(r.pe)}`);
}

console.log('4. Hand-built three-stage rocket stages correctly');
{
  const d = D('fairing', 'probe', 'tank-m', 'lark', 'dec', 'tank-l', 'mule*2', 'dec', 'tank-xl', 'tank-l', 'thumper*4', 'fins');
  const st = designStats(d); ok(st.stages.length === 3 && validate(d).ok, '3 stages, valid', st.stages.map(x => `${x.dv.toFixed(0)} m/s/TWR ${x.twr.toFixed(2)}`).join(' · '));
  // AUTO flight: staging order, mass drop at each separation, only the active stage burns fuel
  const seq = [0], drops = [], burnLeak = []; let prev = null;
  const r = simulateAuto(d, { each: F => {
    const v = F.v;
    if (prev && v.cur !== prev.cur) { seq.push(v.cur); drops.push({ got: prev.m - P.massOf(v), want: prev.stageDry + prev.stageFuel + (prev.fair - v.fairing) }); }
    if (prev && v.cur === prev.cur) v.stages.forEach((s, i) => { if (i !== v.cur && s.fuel !== prev.fuels[i]) burnLeak.push(i); });
    prev = { cur: v.cur, m: P.massOf(v), stageDry: v.stages[v.cur].dry, stageFuel: v.stages[v.cur].fuel, fair: v.fairing, fuels: v.stages.map(s => s.fuel) };
  } });
  ok(seq.join('') === '012', 'stages fire in order 1 → 2 → 3', seq.map(x => x + 1).join(' → '));
  ok(drops.length === 2 && drops.every(x => Math.abs(x.got - x.want) < 0.05), 'each separation drops exactly that stage (dry + leftover fuel)', drops.map(x => x.got.toFixed(2) + ' t').join(', '));
  ok(burnLeak.length === 0, 'only the active stage burns fuel');
  ok(r.orbit && r.pe > P.ORBIT_PE, '3-stage rocket reaches orbit on AUTO', `Pe ${km(r.pe)}, top stage ${r.s2left.toFixed(2)} t left`);
  ok(r.F.flags.fairing === 1, 'fairing jettisoned');
  // manual staging needs the double press each time
  const F = new Flight(d); F.stagePress(); F.setAuto(true, true); F.autoStage = false; let presses = 0;
  for (let i = 0; i < 120 * 900 && F.v.cur < 2 && !F.flags.dead; i++) {
    F.realT += 1 / 120; F.step(1 / 120);
    if (F.v.stages[F.v.cur].fuel < 0.5 && F.canStage()) { const a = F.stagePress(); F.realT += 0.2; const b = F.stagePress(); if (a === 'armed' && b === 'stage') presses++; }
  }
  ok(F.v.cur === 2 && presses === 2, 'manual SPACE-SPACE staging works through all three stages');
  ok(F.booster && splitStages(d)[0].length > 0, 'first stage becomes the recoverable booster; later stages are debris');
}

console.log('5. Clear advice when a build cannot make orbit');
{
  const heavy = assessDesign(D('crew', 'tank-xl', 'tank-xl', 'lark')); ok(!heavy.orbit && /TWR/.test(heavy.text), 'too heavy to lift off', heavy.text);
  const short = assessDesign(D('crew', 'tank-s', 'mule', 'dec', 'tank-m', 'tank-s', 'thumper*2')); ok(!short.orbit && /Δv|fuel/.test(short.text), 'not enough Δv', short.text);
  const inv = assessDesign(D('probe', 'tank-m', 'dec', 'tank-xl', 'thumper')); ok(!inv.orbit && /no engine/.test(inv.text), 'invalid design explains the error', inv.text);
  const good = assessDesign(TEMPLATES[0]); ok(good.orbit && /reaches orbit/.test(good.text), 'Recommended gets a ✔ verdict', good.text);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

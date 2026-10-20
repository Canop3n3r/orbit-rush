// Phase 3 tests: the Academy. Every lesson's pass check triggers on a scripted correct play and not on a wrong
// one (headless, driving the real flight rules), progress save/load and unlocking, and the formula values the
// concept cards show match the physics modules (which they import — no duplicated constants).
// Run: node tests/academy.mjs   (exits non-zero on failure)
import { readFileSync } from 'node:fs';
import * as P from '../physics.js?v=f4';
import { designStats, cloneDesign } from '../parts.js?v=f4';
import { Flight } from '../flight.js?v=f4';
import * as A from '../academy.js?v=f4';
import * as C from '../physics/patched.js?v=f4';
const { V, R } = P;
let pass = 0, fail = 0;
const ok = (c, name, extra = '') => { if (c) { pass++; console.log('  ✔', name, extra); } else { fail++; console.log('  ✘', name, extra); } };
const rel = (a, b) => Math.abs(a - b) / Math.abs(b);
const L = id => A.LESSONS.find(l => l.id === id);

// A play: a Tutor plus a tiny harness standing in for main.js (hangar state, launches, the camera mode).
function play(id) {
  const lesson = L(id), T = new A.Tutor(lesson), S = { state: lesson.start.mode, design: cloneDesign(lesson.start.design), F: null, ui: { camMode: 'chase' } };
  const upd = (dt = 0) => T.update({ state: S.state, F: S.state === 'flight' ? S.F : null, design: S.design, ui: S.ui, dt });
  const api = {
    T, S, upd,
    build(design) { S.state = 'build'; if (design) S.design = cloneDesign(design); S.F = null; upd(); return api; },
    launch() { S.state = 'flight'; S.F = new Flight(S.design, {}, {}); if (lesson.start.setup) lesson.start.setup(S.F); upd(); return S.F; },
    // fly: step the sim in dt steps, calling ctl(F, t) each step and the tutor every 0.1 s; stop when ctl returns 'stop'
    fly(T0, ctl, dt = 0.02, fast) {
      const F = S.F; let acc = 0;
      for (let t = 0; t < T0; ) { if (ctl && ctl(F, t) === 'stop') break; const h = fast ? fast(F, dt) : dt; F.step(h); F.realT = (F.realT || 0) + h; t += h; acc += h; if (acc >= 0.1) { upd(acc); acc = 0; } if (F.flags.dead && !T.passed) { upd(); break; } if (T.passed) break; }
      upd(); return api;
    },
  };
  if (S.state === 'flight') api.launch(); else upd();
  return api;
}
const sasKick = (F, kick = 0.04) => { if (!F._kicked && F.alt > 1500) { F._kicked = true; F.setSAS('off'); F.v.w = [kick, 0, 0]; } };
const vz = v => V.dot(v.v, V.norm(v.r));
const smartQ = F => { F.v.ut = F.tel.q > 24000 ? 0.5 : F.tel.q > 20000 ? 0.75 : 1; };
const coastFast = (F, dt) => (F.alt > 130000 && F.ret && F.ret.phase === 'coast' ? Math.min(1, dt * 25) : dt);

console.log('1. Lesson pass checks: scripted correct play passes, wrong play does not');
{ // 1 controls & staging
  const g = play('controls'); g.S.F.stagePress(); g.fly(120, F => { if (F.alt > 1100 && F.v.cur === 0) F.stage(); });
  ok(g.T.passed && g.T.done, '1 Controls: ignite, climb to 1 km, stage → pass', `alt ${(g.S.F.flags.maxAlt / 1000).toFixed(1)} km, stage ${g.S.F.v.cur + 1}`);
  const w = play('controls'); w.S.F.stagePress(); w.fly(60);
  ok(!w.T.passed && w.T.i === 3, '1 Controls: climb but never stage → no pass (waits at the staging step)');
}
{ // 2 TWR
  const g = play('twr'); ok(g.T.i === 0 && g.T.text(g.T.L && { stats: designStats(g.S.design), state: 'build', ...g.S }).includes('0.'), '2 TWR: starts with stage 1 TWR < 1', `TWR ${designStats(g.S.design).stages[0].twr.toFixed(2)}`);
  const fixed = cloneDesign(g.S.design); fixed.parts = fixed.parts.map((p, i) => (p.id === 'mule' ? { id: 'thumper', n: 3 } : p)); g.build(fixed);
  ok(g.T.i === 1, '2 TWR: fixing the engines (TWR ≥ 1.2) completes the hangar step', `TWR ${designStats(fixed).stages[0].twr.toFixed(2)}`);
  g.launch(); g.S.F.stagePress(); g.fly(90);
  ok(g.T.passed, '2 TWR: the fixed rocket lifts off and climbs past 2 km → pass');
  const w = play('twr'); w.launch(); w.S.F.stagePress(); w.fly(20);
  ok(!w.T.passed && /heavy|TWR/.test(w.T.failMsg || ''), '2 TWR: launching the underpowered rocket → no pass', w.T.failMsg);
}
{ // 3 aero balance
  const g = play('aero'); g.launch(); g.S.F.stagePress(); g.fly(90, F => sasKick(F));
  ok(g.T.mem.sawFlip && !g.T.passed, '3 Aero: fin-less rocket with SAS off flips (seen), not yet a pass', g.S.F.flags.dead || '');
  const finned = cloneDesign(g.S.design); finned.parts.push({ id: 'fins' }); g.build(finned);
  ok(g.T.i === 4, '3 Aero: adding tail fins (stable margin) completes the hangar step');
  g.launch(); g.S.F.stagePress(); g.fly(120, F => sasKick(F));
  ok(g.T.passed, '3 Aero: the finned rocket weathervanes straight to 12 km with SAS off → pass', `max AoA ${(g.T.fm.maxAoA * 57.3).toFixed(1)}°`);
  const w = play('aero'); for (let k = 0; k < 2; k++) { w.launch(); w.S.F.stagePress(); w.fly(90, F => sasKick(F)); }
  ok(!w.T.passed, '3 Aero: flying only the fin-less rocket (twice) → no pass');
}
{ // 4 Max-Q
  const g = play('maxq'); g.S.F.stagePress(); g.S.F.setAuto(true, true); g.fly(240, F => smartQ(F));
  ok(g.T.passed, `4 Max-Q: AUTO steering + player throttling keeps Max-Q under ${A.Q_LIMIT / 1000} kPa → pass`, `Max-Q ${(g.S.F.maxQ / 1000).toFixed(1)} kPa`);
  const w = play('maxq'); w.S.F.stagePress(); w.S.F.setAuto(true, true); w.fly(240, F => { F.v.ut = 1; });
  ok(!w.T.passed && /Max-Q/.test(w.T.failMsg || ''), '4 Max-Q: full throttle all the way → no pass', `${(w.S.F.maxQ / 1000).toFixed(1)} kPa — ${w.T.failMsg}`);
  ok(g.S.F.autoThrottle === false, '4 Max-Q: the lesson hands the throttle to the player (AUTO steers only)');
}
{ // 5 gravity turn
  const g = play('gravity'); g.S.F.stagePress(); g.S.F.setAuto(true, true); g.fly(1500, null, 0.05);
  ok(g.T.passed, '5 Gravity turn: AUTO gravity turn reaches orbit → pass', `Pe ${(P.orbitOf(g.S.F.v).pe / 1000).toFixed(0)} km`);
  const w = play('gravity'); w.S.F.stagePress(); w.fly(600, F => { F.v.ut = 1; if (F.v.cur === 0 && F.v.stages[0].fuel <= 0) F.stage(); }, 0.05);
  ok(!w.T.passed && !w.S.F.flags.orbit, '5 Gravity turn: straight up at full throttle → no orbit, no pass', `max alt ${(w.S.F.flags.maxAlt / 1000).toFixed(0)} km`);
}
{ // 6 orbits
  const circ = (sas, stopPe) => (F, t) => {
    const o = P.orbitOf(F.v), tta = P.timeToApV(F.v);
    if (t < 1) { F._map = true; } if (F._map && t > 0.5) { F._map = false; }
    if (!F._s) { F._s = 1; F.setSAS(sas); }
    if (!F._b && !F._d && tta < 15) F._b = 1;
    if (F._b) { F.v.ut = 1; if (stopPe(o) || F.v.stages[F.v.cur].fuel <= 0) { F.v.ut = 0; F._b = 0; F._d = 1; } }
  };
  const g = play('orbits'); g.S.ui.camMode = 'map'; g.upd(); g.S.ui.camMode = 'chase';
  g.fly(4000, circ('prograde', o => o.pe > 300000), 0.1);
  const o = P.orbitOf(g.S.F.v);
  ok(g.T.passed, '6 Orbits: map, SAS prograde, burn at Ap until Pe ≈ Ap → pass', `${(o.pe / 1000).toFixed(0)} × ${(o.ap / 1000).toFixed(0)} km`);
  const w = play('orbits'); w.S.ui.camMode = 'map'; w.upd(); w.S.ui.camMode = 'chase';
  w.fly(4000, circ('retrograde', o => o.pe < 100000), 0.1);
  ok(!w.T.passed && /retrograde/.test(w.T.failMsg || ''), '6 Orbits: burning retrograde at Ap → no pass', w.T.failMsg);
}
{ // 7 attitude
  const g = play('attitude'); const F = g.S.F;
  g.fly(60, (F, t) => {
    if (t < 0.1) F.setSAS('off');
    F.v.input = { pitch: t > 1 && t < 2.2 ? 1 : 0, yaw: t > 3 && t < 4.2 ? 1 : 0, roll: t > 5 && t < 6.2 ? 1 : 0 };
    if (t > 7 && !F.v.rcsOn) F.toggleRCS();
    if (t > 8 && t < 8.05) F.setSAS('prograde');
    if (g.T.i === 6 && F.v.sas !== 'retrograde') F.setSAS('retrograde');
  });
  ok(g.T.passed, '7 Attitude: SAS off, pitch/yaw/roll, RCS, hold prograde then retrograde → pass', `steps ${g.T.i}/${g.T.L.steps.length}`);
  const w = play('attitude'); w.fly(60);
  ok(!w.T.passed && w.T.i === 0, '7 Attitude: doing nothing → no pass');
  void F;
}
{ // 8 deorbit & reentry
  const g = play('reentry'); g.S.F.deorbit(); g.fly(4000, null, 0.05, coastFast);
  ok(g.T.passed && !g.S.F.flags.dead, '8 Reentry: O, AUTO deorbit, shield first through the heat pulse → pass', `peak ${(g.S.F.maxHeat / 1000).toFixed(0)} kW/m²`);
  const w = play('reentry'); w.S.F.deorbit(); w.fly(4000, F => { if (F.v.cur > F.lastPow && F.v.sas !== 'prograde') { F.setSAS('prograde'); } }, 0.05, coastFast);
  ok(!w.T.passed && /burn|overheat|tumbl|breakup|Lost/i.test(w.T.failMsg || ''), '8 Reentry: flying nose-first (SAS prograde) → no pass', w.T.failMsg);
}
{ // 9 parachutes
  const g = play('chutes'); g.fly(900, F => { const c = F.v.chute.state; if (g.T.i === 1 && c === 'stowed') F.deployChute(); if (c === 'drogue' && F.tel.vAir < 90) F.deployChute(); });
  ok(g.T.passed, '9 Parachutes: drogues inside the limits, then mains → recovered → pass', `touchdown ${g.S.F.flags.touchdown.toFixed(1)} m/s`);
  const w = play('chutes'); w.fly(900, F => { if (F.v.chute.state === 'stowed') F.deployChute(); });
  ok(!w.T.passed && /shred/.test(w.T.failMsg || ''), '9 Parachutes: deploying at Mach 2 → shredded → no pass', w.T.failMsg);
  const w2 = play('chutes'); w2.fly(900);
  ok(!w2.T.passed && w2.S.F.flags.dead, '9 Parachutes: never deploying → impact → no pass', w2.S.F.flags.dead);
}
{ // 10 booster landing
  const burn = (F) => { const v = F.v, sp = vz(v), hb = A.burnHeight(F), hg = A.heightAboveGround(F), g = P.gravityAt(F.alt), T = P.maxThrust(v, F.tel.p), m = P.massOf(v) * 1000;
    if (!F._burn && sp < 0 && hg < hb * 1.2 + 15) F._burn = true;
    if (F._burn) v.ut = sp < -8 ? 1 : Math.min(1, g * m / T * (sp < -3 ? 1.05 : 0.9)); };
  const g = play('landing'); g.fly(300, burn);
  ok(g.T.passed, '10 Landing: suicide burn at the predicted height → soft upright landing → pass', `touchdown ${g.S.F.flags.touchdown.toFixed(1)} m/s`);
  const w = play('landing'); w.fly(300);
  ok(!w.T.passed && w.S.F.flags.dead, '10 Landing: never lighting the engine → crash → no pass', w.S.F.flags.dead);
  const w2 = play('landing'); w2.fly(300, F => { F.v.ut = 1; });
  ok(!w2.T.passed, '10 Landing: burning from the start → runs dry high up → no pass', w2.S.F.flags.dead);
}

console.log('2. Progress: save / load / unlock / skip');
{
  const mem = {}, store = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
  let p = A.loadProgress(store);
  ok(!p.seen && Object.keys(p.passed).length === 0, 'empty store → fresh progress');
  ok(A.isUnlocked(p, 0) && !A.isUnlocked(p, 1), 'only lesson 1 unlocked at first');
  A.markPassed(p, 'controls'); p.seen = true; ok(A.saveProgress(store, p), 'saved');
  p = A.loadProgress(store); ok(p.passed.controls && p.seen && A.isUnlocked(p, 1) && !A.isUnlocked(p, 2), 'reload: lesson 1 passed, lesson 2 unlocked, lesson 3 locked');
  A.markSkipped(p, 'twr'); A.saveProgress(store, p); p = A.loadProgress(store);
  ok(A.isUnlocked(p, 2) && !p.passed.twr && p.skipped.twr, 'skipping lesson 2 unlocks lesson 3 without marking it passed');
  ok(A.nextLesson(p) === 1, 'next lesson suggested: the skipped one (2)');
  A.markPassed(p, 'twr'); ok(p.passed.twr && !p.skipped.twr, 'passing a skipped lesson clears the skip');
  mem[A.PROGRESS_KEY] = '{not json'; ok(Object.keys(A.loadProgress(store).passed).length === 0, 'corrupt storage → fresh progress (no throw)');
  const bad = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  ok(!A.saveProgress(bad, p) && A.loadProgress(bad).v === 1, 'storage that throws (private mode) is tolerated');
}


console.log('1b. Solar-system lessons');
{ // 11 transfer: open map, plan, node, warp & burn → reaches the Moon
  const g = play('transfer'), F = g.S.F; g.S.ui.camMode = 'map'; g.upd(); g.S.ui.camMode = 'chase';
  ok(g.T.i >= 1, '11 transfer: map step done');
  const pl = C.planFull('earth', F.v.r, F.v.v, F.tAbs, 'moon', { minWait: 600 }); F.target = 'moon'; g.upd();
  const n = F.addNode(pl.tuned); g.upd(); ok(g.T.i >= 3 && !g.T.passed, '11 transfer: planner + node steps done, not passed before burning');
  F.applyNodeNow(n); g.upd(); ok(g.T.passed, '11 transfer: burn that reaches the Moon passes', `Δv ${F.dvUsed.toFixed(0)} m/s`);
  const g2 = play('transfer'), F2 = g2.S.F; const n2 = F2.addNode({ t: F2.tAbs + 600, pro: 2600, nrm: 0, rad: 0 }); F2.applyNodeNow(n2); g2.upd();
  ok(!g2.T.passed, '11 transfer: a blind 2.6 km/s burn does not pass');
}
{ // 12 soi: warp into the Moon's SOI
  const g = play('soi'), F = g.S.F; ok(F.body === 'earth' && F.target === 'moon', '12 soi: starts on a lunar transfer');
  ok(!g.T.passed, '12 soi: not passed before the SOI');
  F.warpToSOI(); for (let i = 0; i < 4000 && F.body !== 'moon'; i++) { F.advance(1 / 30); if (i % 3 === 0) g.upd(0.1); }
  g.upd(); ok(F.body === 'moon' && g.T.passed, '12 soi: entering the Moon SOI passes', F.body);
}
console.log('3. Formula values in lessons come from the physics modules');
{
  const src = readFileSync(new URL('../academy.js', import.meta.url), 'utf8');
  const dup = ['9.80665', '9.81', '3.986', '6378', '6371', '1.7415', '101325', '1.225', '7.2921'].filter(x => src.includes(x));
  ok(dup.length === 0, 'academy.js re-types no physical constant (G0, μ, R, Sutton–Graves k, p0, ρ0, ω)', dup.join(', '));
  ok(/from '\.\/physics\.js/.test(src) && /from '\.\/parts\.js/.test(src), 'academy.js imports physics.js and parts.js');
  const card = (id, c = {}) => L(id).concept.body(c);
  const val = (html, key) => +((html.match(new RegExp(`data-v="${key}">([^<]+)<`)) || [])[1] || 'NaN').replace(/[^0-9.\-]/g, '');
  const d = L('twr').start.design, s = designStats(d), h2 = card('twr', { stats: s });
  ok(Math.abs(val(h2, 'dv0') - Math.round(s.stages[0].dv)) <= 1, 'lesson 2 card: stage-1 Δv = Isp·g0·ln(m0/mf) equals the builder\'s Δv', `${val(h2, 'dv0')} vs ${s.stages[0].dv.toFixed(0)} m/s`);
  ok(rel(A.calc.rocketEq(s.stages[0].ispUsed, s.stages[0].m0, s.stages[0].m1), s.stages[0].dv) < 1e-9, 'calc.rocketEq ≡ designStats Δv');
  ok(Math.abs(val(h2, 'dvTotal') - Math.round(s.total)) <= 1, 'lesson 2 card: total Δv equals designStats total');
  const F = new Flight(L('orbits').start.design, {}, {}); F.placeInOrbit(200000);
  ok(rel(V.len(F.v.v), A.calc.vCirc(200000)) < 1e-9, 'calc.vCirc(200 km) is the speed the sim uses for a circular orbit', `${A.calc.vCirc(200000).toFixed(0)} m/s`);
  const h5 = card('gravity'); ok(Math.abs(val(h5, 'vc200') - Math.round(A.calc.vCirc(200000))) <= 1, 'lesson 5 card shows that same v_circ');
  const F6 = new Flight(L('orbits').start.design, {}, {}); F6.placeOrbit(160000, 320000);
  ok(rel(P.orbitOf(F6.v).T, A.calc.period(160000, 320000)) < 1e-6, 'calc.period matches the Kepler module period for the lesson-6 orbit', `${(A.calc.period(160000, 320000) / 60).toFixed(1)} min`);
  const iss = A.calc.period(400000) / 60; ok(iss > 92 && iss < 93, 'ISS reference: ~400 km → ~92 min period', `${iss.toFixed(1)} min`);
  const vAp = A.calc.visViva(R + 320000, R + 240000), o6 = P.orbitOf(F6.v);
  ok(rel(vAp * (R + 320000), V.len(F6.v.v) * (R + 160000)) < 1e-6, 'vis-viva speed at Ap conserves angular momentum with the sim\'s Pe speed', `${vAp.toFixed(0)} m/s at Ap`);
  ok(Math.abs(val(card('orbits'), 'circDv') - Math.round(A.calc.circDv(160000, 320000))) <= 1 && A.calc.circDv(160000, 320000) > 30 && A.calc.circDv(160000, 320000) < 60, 'lesson 6 card: circularization Δv (~45 m/s)', `${A.calc.circDv(160000, 320000).toFixed(1)} m/s`);
  void o6;
  const Fq = new Flight(L('maxq').start.design, {}, {}); Fq.stagePress(); for (let i = 0; i < 2000; i++) Fq.step(0.02);
  ok(rel(A.calc.dynamicPressure(Fq.tel.rho, Fq.tel.vAir), Fq.tel.q) < 1e-6, 'calc.dynamicPressure ½ρv² equals the sim\'s q in flight', `${(Fq.tel.q / 1000).toFixed(1)} kPa at ${(Fq.alt / 1000).toFixed(1)} km`);
  ok(rel(A.calc.mach(Fq.tel.vAir, Fq.tel.a), Fq.tel.mach) < 1e-6, 'calc.mach equals the sim\'s Mach');
  const a11 = P.atmosphere(11000); ok(Math.abs(val(card('maxq'), 'qEx') - +(A.calc.dynamicPressure(a11.rho, 450) / 1000).toFixed(1)) < 0.051, 'lesson 4 card: q example uses the USSA76 density at 11 km');
  ok(rel(A.calc.heatFlux(1e-4, 7000, 2), P.suttonGraves(1e-4, 7000, 2)) < 1e-12, 'calc.heatFlux is physics Sutton–Graves');
  const rho60 = P.atmosphere(60000).rho; ok(Math.abs(val(card('reentry'), 'sgEx') - Math.round(P.suttonGraves(rho60, 7000, 2.5) / 1000)) <= 1, 'lesson 8 card: the q̇ example equals physics.suttonGraves');
  const Fl = new Flight(L('landing').start.design, {}, {}); L('landing').start.setup(Fl);
  const hb = A.burnHeight(Fl), T = P.maxThrust(Fl.v, Fl.tel.p), m = P.massOf(Fl.v) * 1000, vzz = -vz(Fl.v);
  ok(rel(hb, vzz * vzz / (2 * (T / m - P.gravityAt(Fl.alt)))) < 1e-9 && hb > 50 && hb < 1000, 'lesson 10 burn height h = v²/(2(T/m − g)) from the engine model', `${hb.toFixed(0)} m`);
  ok(Math.abs(val(card('landing', { F: Fl }), 'hBurn') - Math.round(hb)) <= 1, 'lesson 10 card shows that burn height');
  const vt = val(card('chutes'), 'vTerm'); ok(vt > 6 && vt < 12, 'lesson 9 card: terminal speed under mains is under the safe touchdown speed', `${vt} m/s`);
  const twr = A.calc.twr(s.stages[0].thrust * 1000, s.stages[0].m0 * 1000); ok(rel(twr, s.stages[0].twr) < 1e-6, 'calc.twr equals the builder\'s TWR', twr.toFixed(3));
}

console.log('4. Lesson definitions');
{
  ok(A.LESSONS.length === 12 && new Set(A.LESSONS.map(l => l.id)).size === 12, 'twelve lessons with unique ids');
  ok(A.LESSONS.every(l => l.title && l.goal && l.steps.length && l.concept && typeof l.pass === 'function'), 'each has a title, goal, steps, concept card and pass check');
  for (const l of A.LESSONS) { let h = ''; try { h = l.concept.body({ stats: designStats(l.start.design) }); } catch (e) { h = ''; } if (!h || /NaN|undefined/.test(h)) ok(false, `concept card ${l.id} renders cleanly`); }
  ok(true, 'every concept card renders without NaN/undefined (no flight)');
  ok(Object.keys(A.GLOSSARY).length >= 15 && Object.values(A.GLOSSARY).every(s => s.length > 20 && s.length < 220), 'glossary: a one-line explanation for each HUD readout');
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

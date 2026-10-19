// Phase 2 tests: reentry heating (Sutton–Graves, free-molecular bridging, real-gas stagnation temperature),
// the per-part thermal model (radiative equilibrium, heat soak, ablation, failure), parachute deploy limits,
// a scripted deorbit + reentry of the recovery capsule (survives with a shield, burns up without), the full
// AUTO round trip, and the effect-intensity mappings (monotonic in Mach / q / heat flux).
// Run: node tests/heat.mjs   (exits non-zero on failure)
import * as P from '../physics.js?v=fx1';
import { TEMPLATES, cloneDesign, buildVehicle, recoveryInfo, validate } from '../parts.js?v=fx1';
import { Flight, chuteLimits, simulateAuto, simulateMission, planBuild, SAFE_TOUCHDOWN, DEORBIT_PE } from '../flight.js?v=fx1';
import * as FX from '../fxmap.js?v=fx1';
const { V, R } = P;
let pass = 0, fail = 0;
const ok = (c, name, extra = '') => { if (c) { pass++; console.log('  ✔', name, extra); } else { fail++; console.log('  ✘', name, extra); } };
const rel = (a, b) => Math.abs(a - b) / Math.abs(b);
const kW = x => (x / 1000).toFixed(0) + ' kW/m²';
const HOME = TEMPLATES.find(t => t.name === 'Orbit & home');
const withShield = (d, id) => { const n = cloneDesign(d); n.parts = n.parts.flatMap(p => (p.id === 'ablator' ? (id ? [{ id }] : []) : [p])); return n; };
const monotone = (f, xs, dir = 1) => xs.every((x, i) => i === 0 || dir * (f(x) - f(xs[i - 1])) >= -1e-12);
const range = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));

console.log('1. Stagnation-point heating (Sutton–Graves) and the rarefied limit');
{
  const k = P.SUTTON_GRAVES_K;
  ok(Math.abs(k - 1.7415e-4) < 1e-9, 'Sutton–Graves constant for Earth air k = 1.7415e-4 (SI)');
  ok(rel(P.heatFlux(1e-4, 7000, 1), k * Math.sqrt(1e-4 / 1) * 7000 ** 3) < 1e-9, 'continuum flux q = k √(ρ/rₙ) V³', kW(P.heatFlux(1e-4, 7000, 1)));
  ok(rel(P.heatFlux(1e-3, 6000, 1) / P.heatFlux(1e-3, 3000, 1), 8) < 1e-9, 'doubling V multiplies the heat flux by 8 (V³)');
  ok(rel(P.heatFlux(4e-4, 5000, 2) / P.heatFlux(1e-4, 5000, 2), 2) < 1e-9, '4× density doubles it (√ρ)');
  ok(rel(P.heatFlux(1e-4, 5000, 0.5) / P.heatFlux(1e-4, 5000, 2), 2) < 1e-9, 'a 4× smaller nose radius doubles it (1/√rₙ): blunt bodies run cooler');
  // order of magnitude for orbital reentry: ~7.5 km/s at 65-75 km on a 3 m capsule shield → a few hundred kW/m²
  const q70 = P.heatFlux(P.atmosphere(70000).rho, 7400, 3);
  ok(q70 > 1e5 && q70 < 2e6, 'LEO capsule at 70 km, 7.4 km/s, rₙ 3 m: 0.1–2 MW/m² (Apollo/Soyuz-class)', kW(q70));
  const qSharp = P.heatFlux(P.atmosphere(70000).rho, 7400, 0.1);
  ok(qSharp > 3 * q70, 'a sharp 10 cm nose at the same point would take > 3× more', kW(qSharp));
  // free-molecular cap in the thermosphere
  const a2 = P.atmosphere(250000), qfm = P.freeMolecularFlux(a2.rho, 7800);
  ok(P.heatFlux(a2.rho, 7800, 0.5) <= qfm * 1.0001 && P.suttonGraves(a2.rho, 7800, 0.5) > qfm, 'at 250 km the continuum formula over-predicts; the flux is capped at the free-molecular ½αρV³', `${P.heatFlux(a2.rho, 7800, 0.5).toFixed(1)} vs SG ${P.suttonGraves(a2.rho, 7800, 0.5).toFixed(1)} W/m²`);
  const a30 = P.atmosphere(30000);
  ok(rel(P.heatFlux(a30.rho, 1500, 0.5), P.suttonGraves(a30.rho, 1500, 0.5)) < 1e-9, 'continuum at 30 km: pure Sutton–Graves');
  ok(P.knudsen(1.225, 1) < 1e-6 && P.flowRegime(P.knudsen(P.atmosphere(300000).rho, 1)) === 'free-molecular' && P.flowRegime(P.knudsen(P.atmosphere(110000).rho, 1)) === 'transitional',
    'Knudsen regimes: continuum at sea level, transitional at 110 km, free-molecular at 300 km', `Kn(300 km) ${P.knudsen(P.atmosphere(300000).rho, 1).toExponential(1)}`);
}

console.log('2. Stagnation temperature and Mach in rarefied air (phase-1 rough edge)');
{
  const a = P.atmosphere(60000), M = 7400 / a.a, ideal = P.stagnationTempIdeal(a.T, M), real = P.stagnationTemp(a.T, M, 0);
  ok(ideal > 25000 && real > 5000 && real < 8000, 'orbital speed: ideal-gas T₀ ~27,000 K, capped to ~7,000 K for dissociating air', `${ideal.toFixed(0)} → ${real.toFixed(0)} K`);
  ok(P.stagnationTemp(250, 3, 0) === P.stagnationTempIdeal(250, 3), 'below the dissociation range T₀ = T(1 + 0.2M²) exactly');
  const T300 = P.atmosphere(300000).T, w = P.rarefaction(P.knudsen(P.atmosphere(300000).rho, 0.5));
  ok(w === 1 && P.stagnationTemp(T300, 12, w) === T300, 'free-molecular (300 km): no shock layer, T₀ falls back to the kinetic air temperature', `${T300.toFixed(0)} K`);
  // a vehicle coasting in a 300 km orbit: HUD Mach suppressed, T0 = ambient
  const v = buildVehicle(TEMPLATES[0]); v.clamped = false; v.earthRot = false; const r = R + 300000, vc = Math.sqrt(P.MU / r);
  v.r = [r, 0, 0]; v.v = [0, vc, 0]; v.q = V.qFromTo([0, 1, 0], [0, 1, 0]); v.w = [0, 0, 0]; v.throttle = 0; v.cmdTorque = [0, 0, 0]; v.clock = 0; P.stepVehicle(v, 0.02);
  ok(v.tel.machShown === null && v.tel.regime === 'free-molecular' && Math.abs(v.tel.Tstag - v.tel.T) < 1, 'telemetry at 300 km: Mach hidden, regime free-molecular, T₀ = T', `Mach(raw) ${v.tel.mach.toFixed(1)}, T₀ ${v.tel.Tstag.toFixed(0)} K`);
  v.r = [R + 40000, 0, 0]; v.v = [0, 1500, 0]; P.stepVehicle(v, 0.02);
  ok(v.tel.machShown > 4 && v.tel.regime === 'continuum', 'telemetry at 40 km: continuum, Mach shown', `M ${v.tel.machShown.toFixed(2)}`);
}

console.log('3. Per-part thermal model');
{
  const part = (kind, heat) => ({ id: 'x', kind, d: 2.5, h: 1, heat });
  const mk = (p, flow = [0, -1, 0]) => { const g = { thermalList: [{ p, d: 2.5, y: 0, h: 1, th: P.thermalOf(p) }] }; p.Ts = p.Ti = 300; p.abl = (p.heat && p.heat.abl) || 0; p.abl0 = p.abl; return g; };
  // radiative equilibrium under a steady flux (no failure limit)
  const p = part('tank', { Tmax: 1e9 }), g = mk(p), qs = 2e5, T0 = 6000;
  for (let t = 0; t < 3000; t += 0.05) P.stepThermal({}, g, qs, T0, 250, 0, [0, -1, 0], 0.05);
  const th = P.thermalOf(p), f = P.exposure(g.thermalList, [0, -1, 0])[0];
  const resid = f * qs * (T0 - p.Ts) / (T0 - 300) - th.eps * P.SIGMA * (p.Ts ** 4 - P.T_SPACE ** 4) - th.k * (p.Ts - p.Ti);
  ok(Math.abs(resid) < 0.01 * f * qs && p.Ts > 1000 && p.Ts < 1500, 'steady heating converges to radiative equilibrium (convection in = εσT⁴ out)', `${p.Ts.toFixed(0)} K, residual ${resid.toFixed(0)} W/m²`);
  // heat soak: interior keeps rising after the heating pulse ends
  const s = part('pod', { Tmax: 1e9, Tin: 1e9 }), gs = mk(s); let skinPeak = 0, tPeak = 0, inPeak = 0, tIn = 0;
  for (let t = 0; t < 600; t += 0.05) { P.stepThermal({}, gs, t < 60 ? 3e5 : 0, 6000, 250, 0, [0, -1, 0], 0.05); if (s.Ts > skinPeak) { skinPeak = s.Ts; tPeak = t; } if (s.Ti > inPeak) { inPeak = s.Ti; tIn = t; } }
  ok(tIn > tPeak + 20 && inPeak > 320 && inPeak < skinPeak, 'heat soak: the interior peaks after the skin, while the skin cools by radiation', `skin ${skinPeak.toFixed(0)} K @${tPeak.toFixed(0)} s, interior ${inPeak.toFixed(0)} K @${tIn.toFixed(0)} s`);
  // ablator: holds its char temperature and loses mass; tiles don't ablate
  const ab = { ...part('shield', { Tmax: 3000, Tabl: 1450, abl: 0.3, Habl: 1.2e7, cA: 25000, eps: 0.9, k: 1 }) }, ga = mk(ab, [0, 1, 0]); let tmax = 0;
  for (let t = 0; t < 120; t += 0.05) { P.stepThermal({}, ga, 1.2e6, 7000, 250, 0, [0, 1, 0], 0.05); tmax = Math.max(tmax, ab.Ts); }
  ok(tmax <= 1450 + 1e-6 && ab.abl < 0.3 && ab.abl > 0, 'ablator: face held at its 1,450 K char temperature while the ablator burns away', `max ${tmax.toFixed(0)} K, ablator ${(ab.abl * 1000).toFixed(0)} of 300 kg`);
  const tl = part('shield', { Tmax: 1e9, cA: 20000, eps: 0.88, k: 1.5 }), gt = mk(tl, [0, 1, 0]);
  for (let t = 0; t < 120; t += 0.05) P.stepThermal({}, gt, 1.2e6, 7000, 250, 0, [0, 1, 0], 0.05);
  ok(tl.Ts > 1900, 'the same pulse takes a reusable tile shield past 1,900 K (its limit): ablators are for the hottest entries', `${tl.Ts.toFixed(0)} K`);
  // failure flag
  const fz = part('payload'), gf = mk(fz); let r = null;
  for (let t = 0; t < 300 && !(r && r.fail); t += 0.05) r = P.stepThermal({}, gf, 3e5, 6000, 250, 0, [0, -1, 0], 0.05);
  ok(r.fail && r.fail.p === fz, 'a part past its limit is flagged as failed', `${fz.Ts.toFixed(0)} K > ${P.thermalOf(fz).Tmax} K`);
  // hot-wall: slow air can't heat a skin above the recovery temperature
  const hw = part('tank', { Tmax: 1e9 }), gh = mk(hw);
  for (let t = 0; t < 2000; t += 0.1) P.stepThermal({}, gh, 5e4, 420, 300, 0.5, [0, -1, 0], 0.1);
  ok(hw.Ts <= 421, 'hot-wall correction: the skin never exceeds the stagnation temperature', `${hw.Ts.toFixed(1)} K ≤ 420 K`);
  // exposure: leading face, windward side, wake behind a shield
  const L = [{ kind: 'shield', d: 2.5 }, { kind: 'pod', d: 2.5 }, { kind: 'chute', d: 1.6 }];
  const ex0 = P.exposure(L, [0, 1, 0]), exN = P.exposure(L, [0, -1, 0]), exA = P.exposure(L, V.norm([Math.sin(0.5), 1, 0]));
  ok(ex0[0] > 0.7 && ex0[1] < 0.03 && exN[2] > 0.7, 'the leading face takes the stagnation heating: shield when base-first, the nose when nose-first', `base-first [${ex0.map(x => x.toFixed(2))}], nose-first [${exN.map(x => x.toFixed(2))}]`);
  ok(exA[1] > ex0[1] * 3, 'angle of attack heats the windward side (crossflow)', `pod ${ex0[1].toFixed(3)} → ${exA[1].toFixed(3)} at 27°`);
}

console.log('4. Parachute deploy limits');
{
  const spec = cloneDesign(HOME) && { drogue: { cda: 42, qMax: 15000, machMax: 1.2, open: 2.5 }, main: { cda: 1180, vMax: 95, qMax: 4500, open: 6 } };
  const T = (mach, q, vAir, rho = 0.5) => ({ mach, machShown: mach, q, vAir, rho });
  ok(chuteLimits(spec, T(0.8, 8000, 250), 'drogue').ok, 'drogues open at Mach 0.8, 8 kPa');
  ok(!chuteLimits(spec, T(1.5, 8000, 450), 'drogue').ok, 'drogues refuse above Mach 1.2', chuteLimits(spec, T(1.5, 8000, 450), 'drogue').why);
  ok(!chuteLimits(spec, T(0.9, 20000, 300), 'drogue').ok, 'drogues refuse above 15 kPa', chuteLimits(spec, T(0.9, 20000, 300), 'drogue').why);
  ok(chuteLimits(spec, T(0.2, 2000, 70), 'main').ok && !chuteLimits(spec, T(0.4, 4000, 130), 'main').ok && !chuteLimits(spec, T(0.25, 5000, 90), 'main').ok, 'mains open under 95 m/s and 4.5 kPa only');
  ok(chuteLimits(spec, { mach: 20, machShown: null, q: 1, vAir: 7000, rho: 1e-9 }, 'drogue').hard, 'no deployment in near-vacuum (nothing to inflate)');
  // in a flight: deploying outside the limits shreds the canopy
  const F = new Flight(HOME, {}, { earthRot: true }).placeInOrbit(170000, 2); const v = F.v;
  v.r = [R + 20000, 0, 0]; v.v = [0, 0, 0]; v.v = V.add(P.airVel({ ...v, v: [0, 0, 0] }).map(x => -x), [-700, 0, 0]); P.stepVehicle(v, 0.02);
  const r1 = F.deployChute();
  ok(r1 === 'shredded' && v.chute.state === 'failed', 'P at Mach 2+ in a flight shreds the drogues', `M ${v.tel.mach.toFixed(1)} q ${(v.tel.q / 1000).toFixed(1)} kPa → ${r1}`);
  const F2 = new Flight(HOME, {}, { earthRot: false }).placeInOrbit(170000, 2), v2 = F2.v;
  v2.r = [R + 8000, 0, 0]; v2.v = [-150, 0, 0]; P.stepVehicle(v2, 0.02);
  ok(F2.deployChute() === 'drogue' && v2.chute.state === 'drogue', 'inside the limits the drogues open', `M ${v2.tel.mach.toFixed(2)} q ${(v2.tel.q / 1000).toFixed(1)} kPa`);
  for (let t = 0; t < 3; t += 0.02) F2.step(0.02);
  ok(v2.chuteCdA > 40, 'drogues inflate over ~2.5 s', `CdA ${v2.chuteCdA.toFixed(0)} m²`);
}

console.log('5. Scripted deorbit and reentry of the recovery capsule');
const reentry = (design, label) => {
  const F = new Flight(design, {}, { earthRot: true }); F.placeInOrbit(170000); F.deorbit();
  let t = 0, peak = 0, peakAlt = 0, burnPe = null;
  while (t < 9000 && !F.flags.dead && !F.flags.recovered) {
    const dt = F.ret.phase === 'coast' && F.alt > 130000 ? 0.5 : 0.02; F.step(dt); t += dt;
    if (burnPe === null && F.ret.phase !== 'align' && F.ret.phase !== 'burn') burnPe = P.orbitOf(F.v).pe;
    if (F.v.tel.heat > peak) { peak = F.v.tel.heat; peakAlt = F.alt; }
  }
  return { F, t, peak, peakAlt, burnPe };
};
{
  ok(recoveryInfo(HOME).capsule && recoveryInfo(HOME).bottomShield && recoveryInfo(HOME).chute && validate(HOME).ok, 'the Orbit & home template is a valid recovery capsule (shield at the bottom, chutes on top, own stage)');
  const a = reentry(HOME, 'ablator'), sh = a.F.v.stages[a.F.v.cur].parts.find(p => p.kind === 'shield');
  ok(a.burnPe !== null && a.burnPe < DEORBIT_PE + 2000, 'deorbit burn lowers periapsis into the atmosphere', `Pe ${(a.burnPe / 1000).toFixed(0)} km`);
  ok(a.F.v.cur === a.F.last, 'the capsule separates from the service stage before entry');
  ok(a.F.flags.recovered && a.F.flags.touchdown <= SAFE_TOUCHDOWN, 'with the ablative shield the capsule survives and splashes down under main chutes', `touchdown ${a.F.flags.touchdown?.toFixed(1)} m/s after ${(a.t / 60).toFixed(0)} min, ${a.F.flags.dead || 'alive'}`);
  ok(a.peak > 2e5 && a.peak < 2e6, 'peak stagnation heating is orbital-reentry class (0.2–2 MW/m²)', `${kW(a.peak)} at ${(a.peakAlt / 1000).toFixed(0)} km`);
  ok(a.F.maxGret > 3 && a.F.maxGret < 12, 'ballistic entry deceleration 3–12 g', `${a.F.maxGret.toFixed(1)} g`);
  ok(sh && sh.abl < sh.abl0 && sh.abl > 0.5 * sh.abl0, 'some ablator burned away, most of it left', sh ? `${(sh.abl / sh.abl0 * 100).toFixed(0)}% left` : '');
  const tile = reentry(withShield(HOME, 'tile'), 'tile');
  ok(tile.F.flags.recovered, 'a reusable tile shield also survives this LEO entry', `${tile.F.flags.recovered ? 'recovered' : tile.F.flags.dead}`);
  const none = reentry(withShield(HOME, null), 'none');
  ok(none.F.flags.dead && none.F.flags.cause === 'burnup', 'without a heat shield the capsule burns up', none.F.flags.dead);
  ok(!validate(withShield(HOME, null)).warnings.every(w => !/no heat shield/.test(w)), 'the hangar warns about chutes without a heat shield');
  // no parachutes: survives the heat, crashes
  const noCh = cloneDesign(HOME); noCh.parts = noCh.parts.filter(p => p.id !== 'chute');
  const nc = reentry(noCh, 'nochute');
  ok(nc.F.flags.dead && nc.F.flags.cause === 'impact' && nc.F.flags.touchdown > 50, 'without parachutes it survives the heat but hits the ground hard', nc.F.flags.dead);
  // flying nose-first (SAS fighting the weathervane is not possible on a capsule): heat lands on the chute pack
  const F = new Flight(HOME, {}, { earthRot: true }); F.placeInOrbit(170000); F.deorbit();
  let t = 0; while (F.ret.phase !== 'coast' && t < 400) { F.step(0.02); t += 0.02; }
  F.ret.auto = false; F.v.sas = 'prograde'; for (; t < 9000 && !F.flags.dead && !F.flags.recovered; ) { const dt = F.alt > 130000 ? 0.5 : 0.02; F.step(dt); t += dt; }
  ok(F.flags.dead || F.v.chute.state === 'failed', 'pointed nose-first (SAS prograde) the capsule loses its parachutes or burns up', F.flags.dead || 'chutes ' + F.v.chute.state);
}

console.log('6. Full AUTO round trip, ascent heating, margins');
{
  const r = simulateMission(HOME, { dt: 1 / 25, earthRot: true });
  ok(r.orbit && r.recovered, 'Orbit & home: AUTO to orbit, O to deorbit, capsule home', `orbit ${r.orbit}, ${r.recovered ? 'touchdown ' + r.touchdown.toFixed(1) + ' m/s' : r.dead}`);
  let worst = 0, worstName = '';
  for (const t of TEMPLATES) {
    let hot = 0; const a = simulateAuto(t, { dt: 1 / 20, each: F => { hot = Math.max(hot, F.v.tel.hotFrac); } });
    if (hot > worst) { worst = hot; worstName = t.name; }
    ok(a.orbit && hot < 0.9, `${t.name}: ascent heating stays under 90% of every part's limit`, `hottest ${(hot * 100).toFixed(0)}%`);
  }
  const pl = planBuild(TEMPLATES[0]), rr = simulateAuto(TEMPLATES[0], { reserve: pl.minReserve }), top = rr.F.v.stages[rr.F.lastPow];
  ok(pl.orbit && rr.orbit && rr.boosterLanded && rr.s2left > 0.1 * top.fuelMax, 'Recommended: booster lands AND the upper stage keeps >10% fuel (healthier margin)', `${rr.s2left.toFixed(1)} of ${top.fuelMax} t left, reserve ${pl.minReserve} t`);
  ok(P.INSERT_ALT === undefined, 'unused INSERT_ALT constant removed');
}

console.log('7. Effect intensity mappings (fxmap.js)');
{
  const Ms = range(0, 25, 251), qs = range(0, 80000, 161), hs = [0, 1e3, 5e3, 2e4, 5e4, 1e5, 2e5, 5e5, 1e6, 3e6, 1e7];
  ok(monotone(M => FX.shockStrength(M, 30000), Ms) && monotone(q => FX.shockStrength(3, q), qs), 'shock strength is non-decreasing in Mach and in q');
  ok(FX.shockStrength(0.9, 50000) === 0 && FX.shockStrength(2, 30000) > 0.7, 'no shock cone subsonic; a strong one at Mach 2 and 30 kPa');
  ok(monotone(M => FX.compressionGlow(M, 20000), Ms) && monotone(q => FX.compressionGlow(8, q), qs), 'compressed-air glow non-decreasing in Mach and q');
  ok(monotone(FX.plasmaIntensity, hs) && FX.plasmaIntensity(1e4) < 0.05 && FX.plasmaIntensity(1e6) > 0.95, 'plasma intensity non-decreasing in heat flux: off at 10 kW/m², full at 1 MW/m²');
  ok(range(4.4, 5.9, 10).every((x, i, a) => i === 0 || FX.plasmaIntensity(10 ** x) > FX.plasmaIntensity(10 ** a[i - 1])), 'plasma intensity strictly increasing between 25 kW/m² and 800 kW/m²');
  const c0 = FX.plasmaColor(1800), c1 = FX.plasmaColor(4500), c2 = FX.plasmaColor(7200);
  ok(c0[0] > c0[2] * 3 && c1[1] > 0.85 && c2[2] > c2[1], 'plasma colour orange → white → violet with stagnation temperature', `[${c0.map(x => x.toFixed(2))}] [${c1.map(x => x.toFixed(2))}] [${c2.map(x => x.toFixed(2))}]`);
  ok(monotone(q => FX.vaporCone(0.97, q, 6000), qs) && monotone(h => FX.vaporCone(0.97, 30000, h), range(0, 20000, 41), -1), 'vapor cone non-decreasing in q, non-increasing with altitude (drier air)');
  ok(monotone(M => FX.vaporCone(M, 30000, 6000), range(0.5, 0.97, 30)) && monotone(M => FX.vaporCone(M, 30000, 6000), range(1.05, 2, 30), -1) && FX.vaporCone(1.6, 30000, 6000) === 0 && FX.vaporCone(0.97, 30000, 6000) > 0.5,
    'vapor cone is a transonic band: grows toward Mach 1, gone by ~1.3');
  const pas = range(101325, 0, 60);
  ok(monotone(pa => FX.plumeShape(pa).width, pas) && monotone(pa => FX.plumeShape(pa).length, pas) && FX.plumeShape(0).width > 5 * FX.plumeShape(101325).width, 'engine plume widens as the ambient pressure drops (underexpanded)', `${FX.plumeShape(101325).width.toFixed(2)} → ${FX.plumeShape(0).width.toFixed(2)}`);
  ok(FX.plumeShape(101325).diamonds > 0.9 && FX.plumeShape(5000).diamonds === 0, 'shock diamonds low down only');
  ok(monotone(q => FX.flowStreaks(q, 1), qs) && FX.flowStreaks(0, 2) === 0, 'airflow streaks non-decreasing in q, none in vacuum');
  ok(Math.abs(FX.machAngle(2) - Math.PI / 6) < 1e-12 && FX.shockStandoff(20, 3) < FX.shockStandoff(3, 3), 'Mach angle asin(1/M); bow-shock standoff shrinks at higher Mach');
  ok(monotone(FX.skinGlow, range(300, 3000, 50)) && FX.skinGlow(700) === 0, 'skin glow starts at the Draper point (~800 K)');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

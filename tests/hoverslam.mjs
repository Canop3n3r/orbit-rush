// Hoverslam (suicide burn) for every auto landing: the shared solver (1-D drops at many TWRs / bodies), the booster
// return (live entry burn → grid-fin coast → landing burn) including an off-nominal steep/fast entry, the low-TWR
// fallback, and a one-tap Moon landing (airless: deorbit + hoverslam, no entry burn).
// Run: node tests/hoverslam.mjs
import * as P from '../physics.js?v=f5a.2';
import { Flight, PRESETS, simulateAuto, landingCheck } from '../flight.js?v=f5a.2';
import { TEMPLATES } from '../parts.js?v=f5a.2';
import { Director, MISSIONS } from '../fun/director.js?v=f5a.2';
const { V } = P;
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fail++; console.log('  ✘', m); } };
// 1-D drop: mass m (kg) with fuel mf, thrust T, isp, from h0 at v0 down, gravity g, simple drag k·v²/m
function drop({ h0, v0, m0, mf, T, isp = 300, g, k = 0, thrMin = 0.4, dt = 1 / 50 }) {
  let h = h0, v = v0, m = m0, fuel = mf, burning = false, lit = false, ign = null, t = 0, maxThr = 0;
  while (h > 0 && t < 2000) {
    const aD = k * v * v / m, sol = P.hoverslamSolve({ h, vDown: v, m, Tmax: fuel > 0 ? T : 0, thrMin, g, aDrag: aD * 0.5, burning, lit }); if (sol.ignite && sol.throttle > 0) lit = true;
    burning = sol.ignite && sol.throttle > 0; if (burning && ign == null) ign = { h, v, aMax: sol.aMax, aD };
    const thr = fuel > 0 ? sol.throttle : 0; maxThr = Math.max(maxThr, thr);
    const mdot = thr * T / (isp * 9.80665); fuel = Math.max(0, fuel - mdot * dt); m = m0 - (mf - fuel);
    v += (g - aD - thr * T / m) * dt; h -= v * dt; t += dt;
    if (v < 0 && h > 0.5 && !burning) v = Math.max(v, -0.5); // (no hover: never climbs back meaningfully)
  }
  return { v, fuelLeft: fuel, ign, used: mf - fuel, maxThr, t };
}
console.log('1. Solver: 1-D hoverslams land under 2 m/s with the ignition near the ideal');
for (const [name, c] of [
  ['Earth booster, TWR≈3', { h0: 6000, v0: 280, m0: 30e3, mf: 8e3, T: 900e3, g: 9.81, k: 0.9 }],
  ['Earth booster, TWR≈6 (light)', { h0: 5000, v0: 250, m0: 25e3, mf: 5e3, T: 1500e3, g: 9.81, k: 0.9 }],
  ['Moon lander, TWR≈2.5', { h0: 9000, v0: 120, m0: 4000, mf: 1500, T: 16e3, g: 1.62 }],
  ['Mars lander, TWR≈2', { h0: 9000, v0: 150, m0: 6000, mf: 2000, T: 45e3, g: 3.71, k: 0.05 }],
  ['Ganymede, TWR≈4', { h0: 2000, v0: 100, m0: 3000, mf: 1000, T: 17e3, g: 1.43 }]]) {
  const r = drop(c), ideal = P.idealIgnAlt(r.ign.v, r.ign.aMax, c.g, r.ign.aD * 0.5);
  ok(Math.abs(r.v) < 2, `${name}: touchdown ${Math.abs(r.v).toFixed(2)} m/s`);
  ok(Math.abs(r.ign.h - ideal) / ideal < 0.06, `${name}: ignition ${r.ign.h.toFixed(0)} m vs ideal ${ideal.toFixed(0)} m`);
  const dvIdeal = r.ign.v + c.g * r.ign.v / (r.ign.aMax * P.THR_AIM - c.g), dvUsed = (c.isp ?? 300) * 9.80665 * Math.log(c.m0 / (c.m0 - r.used));
  ok(dvUsed < dvIdeal * 1.25 + 30, `${name}: burn Δv ${dvUsed.toFixed(0)} m/s (gravity-loss-bound ${dvIdeal.toFixed(0)})`);
  ok(r.maxThr <= 1 && r.maxThr > 0.8, `${name}: flew near the aim throttle (max ${r.maxThr.toFixed(2)})`);
}
{ const s = P.hoverslamSolve({ h: 1000, vDown: 100, m: 1000, Tmax: 1000 * 9.81 * 1.05, g: 9.81 });
  ok(s.lowTWR && !s.noLand, 'TWR 1.05: flagged low → controlled-descent fallback (warn)');
  const r = drop({ h0: 4000, v0: 40, m0: 1000, mf: 600, T: 1000 * 9.81 * 1.25, g: 9.81 });
  ok(Math.abs(r.v) < 3, `low TWR 1.25 still sets down controlled (${Math.abs(r.v).toFixed(1)} m/s)`);
  ok(P.hoverslamSolve({ h: 1000, vDown: 100, m: 1000, Tmax: 9000, g: 9.81 }).noLand, 'TWR < 1: flagged cannot land'); }
{ const s = P.hoverslamSolve({ h: 20000, vDown: 300, m: 1000, Tmax: 30000, g: 9.81 });
  ok(!s.ignite && s.tIgn > 10 && s.throttle === 0, `coasting: no fuel wasted, 'burn in T-${s.tIgn.toFixed(0)} s' cue`);
  ok(P.hoverslamSolve({ h: 0.02, vDown: 1, m: 1000, Tmax: 30000, g: 9.81, burning: true }).throttle === 0, 'cut at touchdown (no hover)'); }

console.log('2. Booster return: live entry burn → grid-fin coast → hoverslam');
const DEF = PRESETS[0];
{ let ign = null, first = null, track = [], legsAt = null;
  const r = simulateAuto(DEF, { reserve: 20, each: F => { const b = F.booster; if (!b || b.state !== 'flying') return; const h = V.len(b.r) - P.R;
    if (b.phase === 'landing burn' && !first) first = { h, burnIn: b.burnIn }; if (b.legs && legsAt == null) legsAt = h; track.push(b.phase); } });
  const b = r.F.booster;
  ok(r.boosterLanded, 'nominal: booster auto-lands on the droneship: ' + r.F.flags.booster);
  ok(b.touchV < 2, `nominal: touchdown ${b.touchV.toFixed(2)} m/s`);
  ok(b.stages[0].fuel < 3, `nominal: little fuel left (${b.stages[0].fuel.toFixed(2)} t)`);
  ok(first && first.h < 3000, `hoverslam lights late (${first && first.h.toFixed(0)} m)`);
  ok(legsAt != null && legsAt < 2000, `legs deploy on time (${legsAt && legsAt.toFixed(0)} m)`);
  ok(track.includes('grid-fin glide') && !track.slice(track.indexOf('grid-fin glide')).includes('entry burn'), 'coast on grid fins between entry and landing burns');
  ok(b.ignAlt != null && Math.abs(b.ignAlt - P.idealIgnAlt(b.ignV, (b.hs ? b.hs.aMax : 60), 9.8)) / b.ignAlt < 0.35, `ignition ${b.ignAlt.toFixed(0)} m near ideal`); }
{ // off-nominal: same booster state at separation but 25% faster and steeper → the live predictor must burn more
  const F = new Flight(DEF, {}); let sep = null;
  simulateAuto(DEF, { reserve: 20, each: F2 => { if (!sep && F2.booster && F2.booster.state === 'flying') sep = { ...F2.booster, r: [...F2.booster.r], v: [...F2.booster.v], stages: F2.booster.stages.map(s => ({ ...s })) }; } });
  const nom = landingCheck(sep), up = V.norm(sep.r);
  const hot = { ...sep, r: [...sep.r], v: V.add(V.scale(sep.v, 1.25), V.scale(up, 150)), stages: sep.stages.map(s => ({ ...s })) };
  const pk0 = P.predictEntryPeaks({ ...hot, stages: hot.stages.map(s => ({ ...s })), r: [...hot.r], v: [...hot.v] });
  const off = landingCheck(hot);
  ok(nom.lands, `nominal check lands (${nom.speed.toFixed(1)} m/s, ${nom.fuelLeft.toFixed(2)} t left)`);
  ok(pk0.q > P.ENTRY_Q_MAX * 0.9 || pk0.qdot > P.ENTRY_QDOT_MAX * 0.9, `off-nominal path would exceed limits unburned (q ${pk0.q.toFixed(0)} kPa, q̇ ${(pk0.qdot / 1000).toFixed(0)} kW/m²)`);
  ok(!off.burned, 'off-nominal (25% faster, steeper): entry burn keeps it from burning up');
  ok(off.lands && off.speed < 2, `off-nominal still lands (${off.speed.toFixed(2)} m/s, ${off.fuelLeft.toFixed(2)} t left)`); }

console.log('3. Airless body: one-tap Moon landing = deorbit + hoverslam');
{ const T0 = P.tFromDate(Date.UTC(2026, 9, 19, 15)); const tpl = n => TEMPLATES.find(t => t.name === n);
  const F = new Flight(tpl(MISSIONS.moon.tpl), {}, { t0: T0 }), D = new Director(F, 'moon', { say: () => {} }); let cue = null, entry = false;
  for (let i = 0; i < 2e6 && D.active; i++) { D.tick(1 / 30); F.advance(1 / 30); if (D.phase === 'descent' && F.landCue && F.landCue.burnIn > 2 && F.landCue.burnIn < 60) cue = F.landCue.burnIn; }
  ok(F.flags.landed && F.body === 'moon', 'Moon: landed — ' + D.result);
  ok(F.flags.touchdown < 2, `Moon touchdown ${(+F.flags.touchdown).toFixed(2)} m/s`);
  ok(cue != null, `'burn in T-x s' cue counted down (${cue && cue.toFixed(1)} s seen)`);
  ok(F.v.ignAlt != null, `Moon: braking began at ${F.v.ignAlt && F.v.ignAlt.toFixed(0)} m`); }
console.log(`hoverslam: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

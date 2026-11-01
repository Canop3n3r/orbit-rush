// f6.5 pre-launch transfer planner: window maths, launch geometry, burn sequence, verdict. Run: node tests/transfer_plan.mjs
import * as P from '../physics.js?v=f5.9-13';
import * as C from '../physics/patched.js?v=f5.9-13';
import * as T from '../physics/transfer_plan.js?v=f5.9-13';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fail++; console.log('FAIL', m); } };
const DAY = 86400, t0 = P.tFromDate(Date.UTC(2026, 9, 25, 15)), D2R = Math.PI / 180;
console.log('1. Earth orientation and local time');
{ const h = T.localHour(-80.6043, t0); ok(Math.abs(h - 9.85) < 0.4, 'Local solar time 80.6° W at 15:00 UTC on 25 Oct is about 09:50: ' + T.fmtHour(h));
  const h2 = T.localHour(-80.6043, t0 + DAY / 2); ok(Math.abs(((h2 - h + 24) % 24) - 12) < 0.1, 'twelve hours later it is 12 h on'); 
  const e = T.eraAt(t0 + 86164.0905), e0 = T.eraAt(t0); ok(Math.abs(((e - e0 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) < 0.002, 'one sidereal day turns the Earth once'); }
console.log('2. Mars: launch window, recurrence, Δv');
const mars = T.planTransfer({ target: 'mars', t0 });
ok(mars.ok, 'a Mars plan exists');
{ const w = mars.windows; ok(w.length >= 2, 'two Mars windows inside 3 years: ' + w.map(x => x.date.toISOString().slice(0, 10)).join(', '));
  const gap = (w[1].t - w[0].t) / DAY; ok(gap > 700 && gap < 850, `Earth-Mars windows recur about every 26 months: ${gap.toFixed(0)} days (${(gap / 30.44).toFixed(1)} months)`);
  const m = mars.launch.date.getUTCMonth(), y = mars.launch.date.getUTCFullYear(); ok(y === 2026 && (m === 9 || m === 10 || m === 11), 'the 2026 window is Oct-Dec 2026: ' + mars.launch.date.toISOString());
  ok(mars.dvDep > 3300 && mars.dvDep < 4200, 'departure burn from 200 km ' + mars.dvDep.toFixed(0) + ' m/s'); ok(mars.dvCap > 1500 && mars.dvCap < 2800, 'arrival burn ' + mars.dvCap.toFixed(0) + ' m/s');
  ok(mars.flightTime / DAY > 200 && mars.flightTime / DAY < 400, 'flight time ' + (mars.flightTime / DAY).toFixed(0) + ' days'); ok(mars.c3 / 1e6 > 7 && mars.c3 / 1e6 < 20, 'C3 ' + (mars.c3 / 1e6).toFixed(1) + ' km²/s²'); }
console.log('3. Moon');
const moon = T.planTransfer({ target: 'moon', t0 });
{ ok(moon.ok && moon.dvDep > 3000 && moon.dvDep < 3350, 'trans-lunar burn ' + moon.dvDep.toFixed(0) + ' m/s'); ok(moon.dvCap > 700 && moon.dvCap < 1100, 'lunar capture ' + moon.dvCap.toFixed(0) + ' m/s');
  ok(moon.flightTime / DAY > 2.5 && moon.flightTime / DAY < 6.5, 'flight time ' + (moon.flightTime / DAY).toFixed(1) + ' days'); }
console.log('4. Launch geometry and burn sequence');
for (const pl of [mars, moon]) {
  const L = pl.launch, b = pl.burns; ok(L.t > t0 && L.t < pl.departT, pl.targetName + ': launch is in the future and before the departure burn');
  ok(pl.departT - L.t < T.MAX_COAST + T.ASCENT_S + 60, pl.targetName + `: parking-orbit coast ${(L.coast / 60).toFixed(0)} min (≤ ${(T.MAX_COAST / 60).toFixed(0)} min)`);
  ok(L.resid < 0.02, pl.targetName + ': the parking orbit reaches the burn point on time (phase error ' + (L.resid / D2R).toFixed(3) + '°)');
  ok(b.map(x => x.key).join() === 'tmi,mid,cap' && b[0].t < b[1].t && b[1].t < b[2].t, pl.targetName + ': burns in order departure, midcourse, arrival');
  ok(Math.abs(b[2].t - (pl.departT + pl.flightTime)) < 1, pl.targetName + ': arrival burn at arrival time');
  ok(L.incl >= 0 && L.incl < 100 && L.azimuth > 0 && L.azimuth < 155, pl.targetName + `: inclination ${L.incl.toFixed(1)}°, azimuth ${L.azimuth.toFixed(0)}°`);
  ok(L.localHour >= 0 && L.localHour < 24, pl.targetName + ': local launch time ' + T.fmtHour(L.localHour) + ' at ' + L.siteName);
  ok(Math.abs(pl.required - (pl.ascentDv + pl.dvDep + pl.dvMid + pl.dvCap)) < 1e-6, pl.targetName + ': total = ascent + departure + midcourse + arrival'); }
console.log('5. Site choice responds to the geometry');
{ const sites = T.launchSites(), one = [sites[0]], p1 = T.planTransfer({ target: 'mars', t0, sites: one }); ok(p1.ok && p1.launch.site === sites[0].id, 'a single allowed site is used');
  ok(p1.required >= mars.required - 1e-6, 'the best of all sites needs no more Δv than any one site (' + mars.required.toFixed(0) + ' ≤ ' + p1.required.toFixed(0) + ')'); }
console.log('6. In-flight planner honours the planned day');
{ // a parking orbit state; planFull with departT puts the node at the planned time (within the orbit)
  const r0 = P.R + 200000, v0 = Math.sqrt(P.MU / r0), Rr = [r0, 0, 0], Vv = [0, v0, 0], dep = t0 + 3 * DAY;
  const pl = C.planFull('earth', Rr, Vv, t0, 'mars', { departT: dep, minWait: 600 }); ok(pl && Math.abs(pl.node.t - dep) < 5500 + 1, 'node within one orbit of the planned departure: ' + (pl ? ((pl.node.t - dep) / 60).toFixed(0) + ' min' : 'none')); }
console.log('7. Verdict in plain words');
{ const need = mars.required; ok(T.verdict(mars, need * 1.3).level === 'ok', 'plenty of Δv → ok'); ok(T.verdict(mars, need * 1.05).level === 'tight', 'a little spare → tight'); ok(T.verdict(mars, need * 0.8).level === 'no', 'short → no');
  ok(/short on fuel/.test(T.verdict(mars, need * 0.8).text), 'plain-word text'); ok(T.verdict(mars, 0).level === 'none', 'no Δv figure → no verdict'); }
console.log('8. Targets');
ok(!T.planTransfer({ target: 'earth', t0 }).ok && !T.planTransfer({ target: 'io', t0 }).ok, 'only the Moon and the planets are offered'); ok(T.canPlan('venus') && T.canPlan('mars') && T.canPlan('moon') && T.canPlan('jupiter') && !T.canPlan('sun'), 'canPlan');
console.log(`transfer_plan: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

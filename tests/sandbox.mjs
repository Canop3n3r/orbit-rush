// f5.4 sandbox launch-from-anywhere: spawn on the surface of the Moon / Mars / an Earth site and fly AUTO to orbit.
import * as P from '../physics.js';
import { Flight, PRESETS } from '../flight.js';
import { siteOpts, SITES, launchBodies } from '../sites.js';
import { latLonToGame } from '../gfx/earthmap.js';
import { offTargets } from '../physics/guidance.js';
let fail = 0; const ok = (c, n, x = '') => { console.log(c ? '  ✔' : '  ✘', n, x); if (!c) fail++; };
ok(launchBodies(P.BODIES).includes('moon') && !launchBodies(P.BODIES).includes('jupiter'), 'surface worlds listed, gas giants not');
for (const [body, si] of [['moon', 0], ['mars', 0], ['earth', 1]]) { const [, name, lat, lon] = SITES[body][si];
  const F = new Flight(PRESETS[0], {}, siteOpts({ body, lat, lon, name }, latLonToGame)), b = P.BODIES[body];
  const up = P.V.norm(F.v.r), la = Math.asin(up[2]) * 180 / Math.PI;
  ok(F.body === body && F.alt > 0 && F.alt < 60, `${name}: spawns on ${b.name}'s surface`, `h ${F.alt.toFixed(1)} m`);
  if (body !== 'earth') ok(Math.abs(la - lat) < 0.5, `${name}: at the site latitude`, la.toFixed(2));
  P.stepVehicle(F.v, 0); const g = P.muOf(F.v) / P.V.len(F.v.r) ** 2; ok(Math.abs(g - b.mu / b.R ** 2) / g < 0.01, `${name}: local gravity`, g.toFixed(2) + ' m/s²');
  F.stagePress(); F.setAuto(true, true); let t = 0;
  for (; t < 3000; t += 0.02) { F.realT += 0.02; F.step(0.02); if (F.flags.dead) break; if (body === 'earth' ? F.flags.orbit && F.v.guid === 'done' : (F.goals[body] || {}).orbit && F.v.guid === 'done') break; }
  const o = P.orbitOf(F.v), floor = body === 'earth' ? P.ORBIT_PE : offTargets(body).floor;
  ok(!F.flags.dead && F.body === body && o.e < 1 && o.pe > floor, `${name}: AUTO reaches orbit of ${b.name}`, `Ap ${(o.ap / 1e3).toFixed(0)} km Pe ${(o.pe / 1e3).toFixed(0)} km, ${t.toFixed(0)} s`);
}
// f5.4f: RTLS boosters from the cape sites land on the real Landing Zone One (~9-15 km away), not the 1.6 km fallback
{ const { SHOWROOM } = await import('../fun/showroom.js'); const r = SHOWROOM.find(x => x.check === 'booster' && x.design.recovery === 'rtls');
  for (const id of ['cape', 'capen']) { const p = SITES.earth.find(x => x[0] === id), o = siteOpts({ body: 'earth', id, name: p[1], lat: p[2], lon: p[3] }, latLonToGame);
    const F = new Flight(r.design, {}, o); F.stagePress(); F.setAuto(true, true);
    for (let t = 0; t < 2400; t += 0.05) { F.realT += 0.05; F.step(0.05); if (F.flags.dead) break; if (F.booster && F.booster.state !== 'flying' && F.flags.orbit) break; }
    const b = F.booster, d = b && b.ef ? Math.acos(Math.min(1, P.V.dot(b.ef, o.lzEf))) * 6371000 : 1e9, far = Math.acos(Math.min(1, P.V.dot(o.lzEf, o.siteEf))) * 6371;
    ok(b && b.state === 'landed' && d < 300 && far > 5, `${p[1]}: RTLS booster lands on Landing Zone One`, `${d.toFixed(0)} m off, LZ ${far.toFixed(1)} km from the pad`); } }
process.exit(fail ? 1 : 0);

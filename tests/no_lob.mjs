// f5.7d (QA f5.6x P2 "AUTO lob"): Heron-9 went up to 184 km, fell back to 108 km with the upper engine lit, then reached orbit.
// A weak upper stage now climbs so it tops out near the target apoapsis about when it reaches orbital speed.
import * as P from '../physics.js?v=f5.7h';
import { Flight } from '../flight.js?v=f5.7h';
import * as V from '../physics/vec.js?v=f5.7h';
import { simulateAuto } from '../flight.js?v=f5.7h';
import { SHOWROOM } from '../fun/showroom.js?v=f5.7h';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  ✔' : 'FAIL', m); };
for (const id of ['swift', 'atlas', 'needle']) {
  const F = new Flight(JSON.parse(JSON.stringify(SHOWROOM.find(r => r.id === id).design)), {}, {}); F.stagePress(); F.setAuto(true, true);
  let pk = 0, drop = 0;
  for (let i = 0; i < 30 * 3000 && !F.flags.dead; i++) { F.advance(1 / 30); const h = F.alt; pk = Math.max(pk, h); drop = Math.max(drop, pk - h); if (F.flags.orbit && F.v.guid === 'done') break; }
  const o = P.orbitOf(F.v);
  ok(!F.flags.dead && F.flags.orbit && o.ap > 175000 && o.ap < 200000 && o.pe > 145000, `${id}: AUTO orbit ${(o.ap / 1000).toFixed(0)} × ${(o.pe / 1000).toFixed(0)} km`);
  ok(drop < 15000, `${id}: no lob (peak ${(pk / 1000).toFixed(0)} km, worst fall-back ${(drop / 1000).toFixed(0)} km)`);
}
// f5.7h (QA f5.6x): re-AUTO after a navball detour (AUTO off at 1.2 km, nose 19-24° off for 2.5-3 s) sagged 169 → 154 km before orbit
const d9 = SHOWROOM.find(r => r.id === 'swift').design;
for (const [ang, hold] of [[0.33, 2.5], [0.42, 3]]) { let st = 0, t0 = 0, pk = 0, drop = 0;
  const r = simulateAuto(JSON.parse(JSON.stringify(d9)), { earthRot: true, each: (F, tt) => { const v = F.v; pk = Math.max(pk, F.alt); drop = Math.max(drop, pk - F.alt);
    if (st === 0 && F.alt > 1200) { st = 1; t0 = tt; F.setAuto(false, true); F.setSAS('stab'); const up = V.norm(v.r), e = P.eastOf(v.r), n = V.norm(V.add(V.scale(up, Math.cos(ang)), V.scale(e, Math.sin(ang)))); v.holdAtt = { n, t: V.qrot(v.q, [0, 0, -1]) }; }
    if (st === 1 && tt - t0 > hold) { st = 2; F.setAuto(true, true); } } });
  ok(r.orbit && r.pe > 145000, `swift re-AUTO after a ${Math.round(ang * 57.3)}° detour: orbit ${(r.ap / 1000).toFixed(0)} × ${(r.pe / 1000).toFixed(0)} km`);
  ok(drop < 5000, `swift re-AUTO after a ${Math.round(ang * 57.3)}° detour: no sag (worst fall-back ${(drop / 1000).toFixed(0)} km)`); }
console.log(`no_lob: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

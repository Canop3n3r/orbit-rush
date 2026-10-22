// f5.7d (QA f5.6x P2 "AUTO lob"): Heron-9 went up to 184 km, fell back to 108 km with the upper engine lit, then reached orbit.
// A weak upper stage now climbs so it tops out near the target apoapsis about when it reaches orbital speed.
import * as P from '../physics.js?v=f5.7d';
import { Flight } from '../flight.js?v=f5.7d';
import { SHOWROOM } from '../fun/showroom.js?v=f5.7d';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  ✔' : 'FAIL', m); };
for (const id of ['swift', 'atlas', 'needle']) {
  const F = new Flight(JSON.parse(JSON.stringify(SHOWROOM.find(r => r.id === id).design)), {}, {}); F.stagePress(); F.setAuto(true, true);
  let pk = 0, drop = 0;
  for (let i = 0; i < 30 * 3000 && !F.flags.dead; i++) { F.advance(1 / 30); const h = F.alt; pk = Math.max(pk, h); drop = Math.max(drop, pk - h); if (F.flags.orbit && F.v.guid === 'done') break; }
  const o = P.orbitOf(F.v);
  ok(!F.flags.dead && F.flags.orbit && o.ap > 175000 && o.ap < 200000 && o.pe > 145000, `${id}: AUTO orbit ${(o.ap / 1000).toFixed(0)} × ${(o.pe / 1000).toFixed(0)} km`);
  ok(drop < 15000, `${id}: no lob (peak ${(pk / 1000).toFixed(0)} km, worst fall-back ${(drop / 1000).toFixed(0)} km)`);
}
console.log(`no_lob: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

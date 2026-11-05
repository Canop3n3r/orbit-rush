// OR-016: phone AUTO upper-stage takeover. Around 60 km the pitch program steps ~30°
// (q falling through 1 kPa, then 0.5 kPa) and the nose is left ~39° off the commanded
// attitude. Budget: stay within 12° of that target for the whole upper-stage burn.
import * as P from '../physics.js?v=f5.9-27';
import { Flight } from '../flight.js?v=f5.9-31';
import { SHOWROOM } from '../fun/showroom.js?v=f5.9-27';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fail++; console.log('  ✘', m); } };
const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, P.V.dot(P.V.norm(a), P.V.norm(b))))) * 180 / Math.PI;

for (const id of ['swift', 'heron']) {
  const design = SHOWROOM.find(r => r.id === id).design;
  const F = new Flight(JSON.parse(JSON.stringify(design)), {}, { recovery: design.recovery || 'ship' });
  F.stagePress(); F.setAuto(true, true);
  let maxOff = 0, at60 = null;
  for (let i = 0; i < 60 * 800 && !F.flags.dead; i++) {
    F.advance(1 / 60);
    const v = F.v;
    if (!(F.autoOn && v.steerDir && v.cur > 0 && v.cur <= F.lastPow && F.alt > 50000)) continue;
    const off = ang(P.noseOf(v), v.steerDir);
    if (off > maxOff) maxOff = off;
    if (!at60 && F.alt > 60000) at60 = off;
    if (F.flags.orbit && v.guid === 'done') break;
  }
  const o = P.orbitOf(F.v);
  ok(maxOff <= 12, `${id} AUTO upper stage stays within 12° of the commanded attitude (max ${maxOff.toFixed(1)}°, at 60 km ${at60 == null ? 'n/a' : at60.toFixed(1)}°)`);
  ok(!F.flags.dead && F.flags.orbit && o.ap > 170000 && o.ap < 210000 && o.pe > 140000, `${id} AUTO still inserts (${(o.ap / 1000).toFixed(0)} × ${(o.pe / 1000).toFixed(0)} km)`);
}
console.log(`upper_coast: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

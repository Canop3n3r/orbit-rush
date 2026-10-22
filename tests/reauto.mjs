// f5.6u (QA f5.6s P1): AUTO off at ~1.2 km, a 2-3 s navball detour (nose 15-30° off vertical), then AUTO back on must
// still reach orbit: AUTO re-plans from the current state (guid reset; a weak upper stage sinking below 120 km may
// pitch up to hold altitude instead of falling back into the air). Run: node tests/reauto.mjs
import * as P from '../physics.js';
import * as V from '../physics/vec.js';
import { simulateAuto } from '../flight.js';
import { SHOWROOM } from '../fun/showroom.js';
let p = 0, f = 0; const t = (c, m) => { if (c) { p++; console.log('  ✔ ' + m); } else { f++; console.log('  ✘ ' + m); } };
const fly = (d, ang, hold) => { let st = 0, t0 = 0; return simulateAuto(d, { earthRot: true, each: (F, tt) => { const v = F.v;
  if (ang && st === 0 && F.alt > 1200) { st = 1; t0 = tt; F.setAuto(false, true); F.setSAS('stab'); const up = V.norm(v.r), e = P.eastOf(v.r), n = V.norm(V.add(V.scale(up, Math.cos(ang)), V.scale(e, Math.sin(ang)))); v.holdAtt = { n, t: V.qrot(v.q, [0, 0, -1]) }; v.sasHold = n; }
  if (st === 1 && tt - t0 > hold) { st = 2; F.setAuto(true, true); } } }); };
for (const id of ['swift', 'needle', 'heron']) { const r = SHOWROOM.find(x => x.id === id); if (!r || !r.design) continue;
  const b = fly(r.design, 0, 0); t(b.orbit, `${r.name}: plain AUTO reaches orbit (${Math.round(b.ap / 1000)}×${Math.round(b.pe / 1000)} km)`);
  for (const [a, h] of [[0.26, 2], [0.33, 2.5], [0.42, 3]]) { const x = fly(r.design, a, h); t(x.orbit && !x.dead, `${r.name}: AUTO off at 1.2 km, ${Math.round(a * 57.3)}° detour for ${h} s, AUTO on → orbit (${Math.round(x.ap / 1000)}×${Math.round(x.pe / 1000)} km${x.dead ? ', ' + x.dead : ''})`); } }
console.log(`reauto: ${p} passed, ${f} failed`); process.exit(f ? 1 : 0);

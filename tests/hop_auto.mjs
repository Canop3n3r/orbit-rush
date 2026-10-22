// fx-1 (QA B5): Grasshopper on plain AUTO (missions hidden) hops and lands on the pad instead of flying an orbital
// gravity turn and crashing inverted. The player arms AUTO, presses STAGE, and the hop director takes over.
import * as P from '../physics.js?v=fx1';
import { Flight } from '../flight.js?v=fx1';
import { SHOWROOM } from '../fun/showroom.js?v=fx1';
import { hopAuto, isHopper } from '../fun/director.js?v=fx1';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  ✔' : 'FAIL', m); };
const T0 = P.tFromDate(Date.UTC(2026, 9, 19, 15)), tpl = SHOWROOM.find(r => r.id === 'hopper').design;
ok(isHopper({ name: 'Grasshopper' }) && !isHopper({ name: 'Orbit & home' }), 'isHopper');
const F = new Flight(tpl, {}, { t0: T0 }); F.setAuto(true, true); F.stagePress(); let D = null, maxAlt = 0;
for (let i = 0; i < 30 * 600 && !F.flags.dead && !F.flags.landed; i++) { if (!D && F.ignited && F.autoOn) D = hopAuto(F, {}); if (D && D.active) D.tick(1 / 30); F.advance(1 / 30); maxAlt = Math.max(maxAlt, F.alt); }
ok(!!D, 'AUTO + STAGE on a hopper starts the hop autopilot');
ok(maxAlt > 2000 && maxAlt < 4500, `hops to ~3 km (max ${Math.round(maxAlt)} m)`);
ok(!F.flags.dead, 'does not crash: ' + (F.flags.dead || 'ok'));
ok(!!F.flags.landed, 'lands back on the ground');
console.log(`hop_auto: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

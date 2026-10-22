// f5.7e (QA f5.6x B5): the New Glendale booster under AUTO no longer burns up on re-entry: its entry burn may dip into the
// landing budget when the predicted peaks are far over the limit. OPEN: with the 67 t spec reserve it still lands hard (BOARD fx-ng).
import * as P from '../physics.js?v=f5.7e';
import { Flight } from '../flight.js?v=f5.7e';
import { specFor, specDesign } from '../fun/specstack.js?v=f5.7e';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  ✔' : 'FAIL', m); };
const F = new Flight(specDesign(specFor('new-glendale')), {}, { t0: P.tFromDate(Date.UTC(2026, 9, 19, 15)) }); F.setAuto(true, true); F.stagePress();
for (let i = 0; i < 60 * 30 * 20 && !F.flags.dead; i++) { F.advance(1 / 30); const b = F.booster; if (b && b.state !== 'flying') break; }
ok(F.booster && !/burned up/.test(F.flags.booster || ''), `new-glendale: booster survives re-entry (${F.booster ? F.booster.state : '-'}${F.flags.booster ? ', ' + F.flags.booster : ''})`);
console.log(`ng_entry: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

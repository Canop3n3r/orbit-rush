// f5.7g (QA f5.6x B5): the New Glendale booster under AUTO stages earlier/slower (the sourced 67 t reserve is a floor; AUTO keeps
// Δv ≈ 0.8 × separation speed) so it flies entry + landing burns and lands softly, and the upper stage still reaches orbit.
import * as P from '../physics.js?v=f5.7e';
import { Flight } from '../flight.js?v=f5.7e';
import { specFor, specDesign } from '../fun/specstack.js?v=f5.7e';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  ✔' : 'FAIL', m); };
const F = new Flight(specDesign(specFor('new-glendale')), {}, { t0: P.tFromDate(Date.UTC(2026, 9, 19, 15)) }); F.setAuto(true, true); F.stagePress();
let sepV = 0, sepF = 0, bDone = false; for (let i = 0; i < 60 * 30 * 40 && !F.flags.dead; i++) { const c0 = F.v.cur; if (c0 === 0) { sepV = Math.hypot(...F.v.v); sepF = F.v.stages[0].fuel; } F.advance(1 / 30); const b = F.booster; if (b && b.state !== 'flying') bDone = true; if (bDone && F.flags.orbit && F.v.guid === 'done') break; }
ok(sepV < 2800 && sepF >= 67, `new-glendale: stages slower than 2.9 km/s with at least the 67 t reserve (${sepV.toFixed(0)} m/s, ${sepF.toFixed(0)} t)`);
ok(F.booster && F.booster.state === 'landed', `new-glendale: booster lands softly (${F.booster ? F.booster.state : '-'}${F.flags.booster ? ', ' + F.flags.booster : ''})`);
const o = P.orbitOf(F.v); ok(!F.flags.dead && F.flags.orbit && o.pe > 145000, `new-glendale: upper stage still reaches orbit (${(o.ap / 1000).toFixed(0)} × ${(o.pe / 1000).toFixed(0)} km)`);
ok(F.booster && !/burned up/.test(F.flags.booster || ''), `new-glendale: booster survives re-entry (${F.booster ? F.booster.state : '-'}${F.flags.booster ? ', ' + F.flags.booster : ''})`);
console.log(`ng_entry: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

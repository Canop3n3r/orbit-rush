// f5.1h (Aaron): every ladder mission flies the rocket the player picked (3 qualifying picker rockets each), never a swap,
// AUTO only when asked. Flown headlessly on the real physics with the mission director (the AUTO path).
import { Flight } from '../flight.js?v=f5.3b3';
import { Director } from '../fun/director.js?v=f5.3b3';
import { SHOWROOM } from '../fun/showroom.js?v=f5.3b3';
import { LADDER } from '../fun/ladder.js?v=f5.3b3';
import { qualifying, launchPlan, autoNote } from '../fun/mispick.js?v=f5.3b3';
import { pickBase } from '../fun/stagemap.js?v=f5.3b3';
import { specFor } from '../fun/specstack.js?v=f5.3b3';
import { STAGE_KEYS, HEIGHTS } from '../gfx/vehicles/stage_keys.js?v=f5.3b3';
import { cloneDesign } from '../parts.js?v=f5.3b3';
import * as P from '../physics.js?v=f5.3b3';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fail++; console.log('FAIL', m); } };
const houses = Object.keys(STAGE_KEYS).map(id => ({ model: id, name: id, base: pickBase(STAGE_KEYS[id], HEIGHTS[id] || 50) })).filter(h => SHOWROOM.some(r => r.id === h.base) && !specFor(h.model));
const T0 = P.tFromDate(Date.UTC(2026, 9, 19, 15));
const ids = [...new Set(LADDER.filter(c => c.how === 'mission').map(c => c.mission))];
ok(ids.length >= 3, 'ladder missions: ' + ids.join(','));
for (const id of ids) {
  const q = qualifying(id, SHOWROOM, houses); ok(q.length >= 3, `${id}: ${q.length} qualifying picker rockets`);
  for (const r of q.slice(0, 3)) {
    const base = SHOWROOM.find(x => x.id === r.base), d = { ...cloneDesign(base.design), name: r.name }; if (r.model) d.model = r.model;
    const plan = launchPlan(d, true); ok(plan.design.name === r.name && (plan.design.model || null) === (r.model || null) && JSON.stringify(plan.design.parts) === JSON.stringify(d.parts), `${id}/${r.name}: launch plan is the picked rocket`);
    ok(!launchPlan(d, false).auto && /AUTO is off/.test(autoNote(false, r.name)) && /AUTO mission/.test(autoNote(true, r.name)), `${id}/${r.name}: AUTO opt-in, said clearly`);
    const F = new Flight(plan.design, {}, { t0: T0 }), D = new Director(F, id, {}); const parts0 = JSON.stringify(plan.design.parts);
    for (let i = 0; i < 2e6 && D.active; i++) { D.tick(1 / 30); F.advance(1 / 30); }
    ok(D.ok, `${id}/${r.name}: ${D.result}`); ok(JSON.stringify(plan.design.parts) === parts0 && plan.design.name === r.name, `${id}/${r.name}: no swap during the flight`);
  }
}
console.log(`mispick: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

// AUTO flight events vs real timelines (timelines/data.js), flown headlessly with the vehicles/ catalog. Run: node tests/timelines.mjs
import { MISSIONS, AUTO_EVENTS } from '../timelines/data.js';
import { flyAuto } from '../timelines/sim.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fail++; console.log('  ✘', m); } };
const TOL = 0.15;
for (const m of MISSIONS) {
  const r = flyAuto(m.vehicle, { mode: m.mode, reserve: m.reserve, payload: m.payload });
  console.log(`${m.id} (${m.vehicle}): orbit=${r.orbit} booster=${r.boosterState || '-'} ${r.cause || ''}`);
  ok(r.orbit, `${m.id}: AUTO reaches orbit`);
  for (const k of AUTO_EVENTS) {
    if (m.events[k] === undefined) continue;
    const got = r.ev[k] ? r.ev[k].t : null, want = m.events[k];
    ok(got !== null && Math.abs(got / want - 1) <= TOL, `${m.id} ${k}: AUTO ${got === null ? 'never' : got.toFixed(0) + ' s'} vs real ${want} s${got !== null ? ` (${((got / want - 1) * 100).toFixed(0)}%)` : ''}`);
  }
}
console.log(`\ntimelines: ${pass} passed, ${fail} failed (tolerance ±${TOL * 100}%)`); if (fail) process.exit(1);

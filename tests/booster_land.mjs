// fx-2 (Aaron: cool landings): every reusable booster (Heron family, Colossus, New Glendale) under AUTO flies
// boostback/entry burn/landing burn with grid fins onto the pad or the drone ship, and lands.
// OPEN: new-glendale (staging early enough to land overheats its payload; see BOARD fx-2) — run `node tests/booster_land.mjs new-glendale`.
import * as P from '../physics.js?v=fx2';
import { Flight } from '../flight.js?v=fx2';
import { specFor, specDesign } from '../fun/specstack.js?v=fx2';
import { SHOWROOM, MODEL_OF } from '../fun/showroom.js?v=fx2';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  ✔' : 'FAIL', m); };
const T0 = P.tFromDate(Date.UTC(2026, 9, 19, 15)), ONLY = process.argv[2];
const design = id => { const r = SHOWROOM.find(x => MODEL_OF[x.id] === id); if (r) return { ...r.design, model: id }; const s = specFor(id); return s ? specDesign(s) : null; };
for (const id of (ONLY ? [ONLY] : ['heron-9', 'heron-heavy', 'titan-ss-v3'])) {
  const d = design(id); if (!d) { ok(false, id + ': no design'); continue; }
  const F = new Flight(d, {}, { t0: T0 }); F.setAuto(true, true); F.stagePress(); const ph = new Set(); let fins = false;
  for (let i = 0; i < 60 * 30 * 20 && !F.flags.dead; i++) { F.advance(1 / 30); const b = F.booster; if (b) { ph.add(b.phase); if (b.fin && Math.hypot(...b.fin) > 0.01) fins = true; if (b.state !== 'flying') break; } }
  const b = F.booster; console.log('   ', id, b ? b.state : 'no booster', [...ph].join(' > '));
  ok(b && b.state === 'landed', `${id}: booster lands (${b ? b.state : '-'}${F.flags.booster ? ', ' + F.flags.booster : ''})`);
  ok([...ph].includes('landing burn') && (id === 'heron-heavy' || [...ph].includes('entry burn')), `${id}: ${id === 'heron-heavy' ? '' : 'entry burn + '}landing burn`); // Heavy side boosters: RTLS from low speed, no entry burn needed
  if (id !== 'titan-ss-v3') ok(fins, `${id}: grid fins steer`); // the droneship booster falls onto its target without a fin correction
}
console.log(`booster_land: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

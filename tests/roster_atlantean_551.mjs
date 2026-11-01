// atlantean-v-551: 5 strap-on solids everywhere (roster, flight stack, model stage keys, Blender spec) and the v5 LEO payload vs the
// sourced figure. Source: spec:atlantean-v#srb-count (5xx: 0–5 SRBs, 551 = 5) and spec:atlantean-v#leo-v5 (18,814 kg). Run: node tests/roster_atlantean_551.mjs
import { readFileSync } from 'node:fs';
import { ROSTER_ULX, ENGINES_ULX } from '../vehicles/catalog.js';
import { rosterFor, specDesign } from '../fun/specstack.js';
import { STAGE_KEYS } from '../gfx/vehicles/stage_keys.js';
import { modelPayload, TOL } from '../vehicles/roster/loss.js';
let pass = 0, fail = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); c ? pass++ : fail++; };
const SRB = 5, ID = 'atlantean-v-551';
const v = ROSTER_ULX.find(x => x.id === 'atlantean-v' && /^v5\b/.test(x.variant)), b = v.stages[0];
ok(b.propellant === 'solid' && b.engines['ulx-s1'] === SRB && b.engineCount === SRB && b.boosters === SRB, `roster v5: ${SRB} solid boosters, 1 motor each`);
ok(/5 boosters/.test(v.variant), `roster v5 label says 5 boosters (${v.variant})`);
const d = specDesign(rosterFor(ID), ID, ID), rd = d.parts.find(p => p.id === 'rdec');
ok(rd && rd.n === SRB, `flight stack: radial symmetry ${rd && rd.n} = ${SRB} (was 6: boosters + core engine)`);
ok(d.spec.stages[0].radial && d.spec.stages[0].boosters === SRB, `flight stack: booster phase carries boosters = ${SRB}`);
for (const id of [ID, ID + '-l']) { const k = (STAGE_KEYS[id] || []).filter(x => /^srb\d/.test(x)).length; ok(k === SRB, `model ${id}: ${k} srb stages`); }
const bl = JSON.parse(readFileSync(new URL('../tools/blender/specs/' + ID + '.json', import.meta.url))).stages.filter(s => /^srb\d/.test(s.key)).length;
ok(bl === SRB, `Blender spec ${ID}: ${bl} srb stages`);
// payload: loss model as is (never tuned); the roster records v5 as a known gap above ±TOL
const m = v.modes[0], r = modelPayload(v, ENGINES_ULX, m), got = typeof r === "number" ? r : r.payload, err = got / m.payload - 1, pct = Math.round(err * 100);
if (Math.abs(err) <= TOL) ok(true, `v5 LEO ${(got / 1000).toFixed(2)} t vs sourced ${(m.payload / 1000).toFixed(2)} t (${pct}%) within ±${TOL * 100}%`);
else ok(!!m.knownGap && Math.abs(err) <= 0.2, `KNOWN GAP v5 LEO ${(got / 1000).toFixed(2)} t vs sourced ${(m.payload / 1000).toFixed(2)} t (${pct}%), outside ±${TOL * 100}%: ${m.knownGap}`);
console.log(`\nroster_atlantean_551: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

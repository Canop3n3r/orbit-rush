// Side-booster counts: every house rocket with a parallel booster phase has a sourced roster `boosters` count (spec:<family>#boosters,
// GCAT via rocketdb stage-0 counts) and the flight stack's radial symmetry equals it (never the engine count). Run: node tests/roster_boosters.mjs
import { rosterFor, specDesign, specStages, SPEC_OK } from '../fun/specstack.js';
let pass = 0, fail = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); c ? pass++ : fail++; };
const WANT = { 'space-truck': 2, 'thorin-agenta': 3, 'deltoid': 9, 'deltoid-3': 9, 'arion-5': 2, 'arion-62': 2, 'arion-64': 4, 'titanus-4': 2,
  'jade-lantern-5b': 4, 'polar-slinger': 6, 'tsubame': 2, 'rodnik': 4, 'atlantean-v-551': 5, 'deltoid-4-heavy': 2 };
const withRadial = SPEC_OK.filter(id => rosterFor(id) && specStages(rosterFor(id))[0].radial);
ok(withRadial.length === 14 && withRadial.every(id => id in WANT), `14 house rockets with side boosters, all covered (${withRadial.join(', ')})`);
for (const [id, n] of Object.entries(WANT)) {
  const v = rosterFor(id), S = specStages(v), rd = specDesign(v, id, id).parts.find(p => p.id === 'rdec');
  const bs = v.stages.filter(s => (s.group || 0) === 0 && s.boosters !== undefined);
  ok(bs.length > 0 && bs.every(s => /^spec:[a-z0-9-]+#boosters$/.test(s.boostersSrc) || /^spec:atlantean-v#srb-count$/.test(s.boostersSrc)), `${id}: boosters cited (${bs.map(s => s.boostersSrc).join(', ')})`);
  ok(S[0].boosters === n && rd && rd.n === n, `${id}: ${n} side boosters in roster and flight stack (rdec ${rd && rd.n}, parallel-phase engines ${S[0].n})`);
}
console.log(`\nroster_boosters: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

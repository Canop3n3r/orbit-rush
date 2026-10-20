// Roster 'spacey': INFORMATION ONLY. Runs the roster loss model on the existing hand-sourced catalog entries (their own
// payload tests are authoritative and unchanged). Adapter assumptions (ESTIMATE): burn = rated flow (prop·Isp_vac·g0/T_vac);
// a `parallel` stage shares a group with the next; reserve[i] is carried as stage-i dry mass; orbit 185 km circular at the
// catalog lat; frontal area from diam (3.7 m if absent). Never fails the suite. Run: node tests/roster_spacey.mjs
import { VEHICLES, ENGINES } from '../vehicles/catalog.js';
import { SPACEY_CATALOG_IDS } from '../vehicles/roster/spacey.js';
import { modelPayload, TOL } from '../vehicles/roster/loss.js';
const G0 = 9.80665, E = {};
for (const [k, e] of Object.entries(ENGINES)) E[k] = { ...e };
for (const id of SPACEY_CATALOG_IDS) {
  const c = VEHICLES.find(v => v.id === id); if (!c) { console.log('  ? missing catalog id', id); continue; }
  for (const md of c.modes) {
    let g = 0; const stages = c.stages.map((s, i) => {
      const T = Object.entries(s.engines).reduce((a, [k, n]) => a + n * E[k].tVac * 1e3, 0), mdot = Object.entries(s.engines).reduce((a, [k, n]) => a + n * E[k].tVac * 1e3 / (E[k].ispVac * G0), 0);
      const st = { engines: s.engines, dry: s.dry + ((md.reserve || [])[i] || 0), prop: s.prop - ((md.reserve || [])[i] || 0), burn: (s.prop - ((md.reserve || [])[i] || 0)) / mdot, group: g, recovery: s.recovery };
      if (!s.parallel) g++; return st; });
    const d = c.diam || 3.7, v = { id, stages, area: Math.PI * d * d / 4 * (c.stages[0].parallel ? 3 : 1), fairing: c.fairing || 0 };
    const mode = { payload: md.payloadLEO, orbit: { hp: 185, ha: 185, inc: c.lat } };
    const r = modelPayload(v, E, mode), err = r.payload / md.payloadLEO - 1;
    console.log(`  i ${id} [${md.mode}] roster model ${(r.payload / 1000).toFixed(2)} t vs catalog ${(md.payloadLEO / 1000).toFixed(2)} t (${(err * 100).toFixed(0)}%) ${Math.abs(err) <= TOL ? 'within' : 'outside'} ±${TOL * 100}%`);
  }
}
console.log('\nroster_spacey: information only (0 failed)');

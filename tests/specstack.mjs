// f5.2: house rockets with Vehicle Specs' roster data fly their own physics stack (mass, thrust, Isp, stage count).
import { Flight } from '../flight.js?v=f5.3b2';
import * as P from '../physics.js?v=f5.3b2';
import { SPEC_OK, rosterFor, modelled, specDesign, specStages } from '../fun/specstack.js?v=f5.3b2';
import { audit } from '../fun/stagemap.js?v=f5.3b2';
import { STAGE_KEYS } from '../gfx/vehicles/stage_keys.js?v=f5.3b2';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fail++; console.log('FAIL', m); } };
for (const id of SPEC_OK) { const v = rosterFor(id); ok(v && modelled(v), `${id}: roster ${v && v.id} modelled`); if (!v) continue;
  const d = specDesign(v, id, id), S = specStages(v), F = new Flight(JSON.parse(JSON.stringify(d)), {}, {});
  ok(F.v.spec && F.v.stages.length === S.length, `${id}: ${S.length} physics stages from the roster`);
  const want = S.reduce((t, s) => t + s.dry + s.fuel + (s.payload || 0), 0) + (v.fairing || 0) / 1000, got = P.massOf(F.v), extra = got - want;
  ok(extra > -0.01 && extra < 1.5, `${id}: liftoff mass ${got.toFixed(1)} t = roster (with fairing) ${want.toFixed(1)} t + probe/shroud ${extra.toFixed(2)} t`);
  ok(F.v.stages.every((s, i) => s.eng.tv === S[i].tv && s.n === S[i].n && s.eng.ispVac === S[i].ispVac), `${id}: thrust, engine count and Isp from the roster`);
  ok(audit(STAGE_KEYS[id], F.v.stages).ok, `${id}: model stage groups match`);
  F.stagePress(); F.setAuto(true, true); let c = 0, ev = 0; for (let i = 0; i < 30 * 1800 && !F.flags.dead && !F.flags.orbit; i++) { F.advance(1 / 30); if (F.v.cur !== c) { c = F.v.cur; ev++; } }
  ok(F.flags.orbit && ev >= 1, `${id}: orbit on AUTO after ${ev} separations`); }
const a = rosterFor('arion-5'), b = rosterFor('tsubame'); ok(JSON.stringify(specStages(a)) !== JSON.stringify(specStages(b)), 'two house rockets differ in physics, not just the model');
console.log(`specstack: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

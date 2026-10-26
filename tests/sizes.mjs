// sizes-1 (owner: "a lot of rocket sizes are very off"): every house rocket is drawn and flown at its real-world height and
// core diameter (vehicles/dims.js). Before, the model was scaled to whatever generic part stack it flew (2-8x off).
// Checks: (1) the physics stack (the height the model is scaled to) is within 5 % of the target height and its core tank
// diameter within 5 % of the target diameter; (2) the rendered body diameter (model width x height scale x xz) is within 5 %;
// (3) every house model in stage_keys has a dims entry.
import { SHOWROOM, EXTRA_STACKS } from '../fun/showroom.js?v=f5.8c';
import { pickBase } from '../fun/stagemap.js?v=f5.8c';
import { specFor, specDesign } from '../fun/specstack.js?v=f5.8c';
import { STAGE_KEYS } from '../gfx/vehicles/stage_keys.js?v=f5.8c';
import { buildVehicle } from '../parts.js?v=f5.8c';
import * as P from '../physics.js?v=f5.8c';
import { DIMS, dimsOf } from '../vehicles/dims.js?v=f5.8c';
import { RETIRED } from '../fun/showroom.js?v=f5.8c';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const near = (a, b, tol = 0.05) => Math.abs(a / b - 1) <= tol;
const designOf = id => { const sp = specFor(id); if (sp) return specDesign(sp, id, id); const own = SHOWROOM.find(r => r.model === id); if (own) return own.design;
  const b = pickBase(STAGE_KEYS[id] || [], DIMS[id].art[0]), r = SHOWROOM.find(x => x.id === b) || EXTRA_STACKS[b]; return r && { ...r.design, model: id }; };
const SKIP = new Set(['catch-tower', 'payload-roadster', 'payload-flatsat-stack', 'selene', 'ares', 'featherwing-1', 'new-shepherdish']); // new-shepherdish: not in any house set (not shown) // pad hardware, payloads, retired stacks, air-launch combo
for (const id of Object.keys(STAGE_KEYS)) if (!SKIP.has(id)) ok(DIMS[id], `${id}: has a dims entry`);
for (const [id, dm] of Object.entries(DIMS)) {
  const d = designOf(id); ok(d, `${id}: flyable stack`); if (!d) continue;
  const v = buildVehicle(d), g = P.stackGeom(v), body = v.stages.filter(s => !s.radial).flatMap(s => s.parts).filter(p => p.kind === 'tank');
  const dc = Math.max(...body.map(p => p.d));
  ok(near(g.L, dm.h), `${id}: physics/render height ${g.L.toFixed(1)} m vs ${dm.h} m`);
  ok(near(dc, dm.d), `${id}: physics core diameter ${dc.toFixed(2)} m vs ${dm.d} m`);
  const rendered = dm.art[1] * (g.L / dm.art[0]) * dm.xz;
  if (!dm.taper) ok(near(rendered, dm.d), `${id}: rendered body diameter ${rendered.toFixed(2)} m vs ${dm.d} m`);
  ok(dm.xz >= 0.8 && dm.xz <= 1.45, `${id}: width correction ${dm.xz} stays mild`);
}
// the showroom's own rockets fly under their saved model ids (incl. renamed art ids)
for (const r of SHOWROOM) if (r.model && !RETIRED.has(r.id)) { const dm = dimsOf(r.model); ok(dm, `${r.id} (${r.model}): dims`); if (!dm) continue;
  const L = P.stackGeom(buildVehicle(r.design)).L; ok(near(L, dm.h), `${r.id} (${r.model}): height ${L.toFixed(1)} m vs ${dm.h} m`); }
console.log(`sizes: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

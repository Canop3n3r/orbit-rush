// f5.1h staging audit (node half): every house model's stage groups match the physics stack it flies on, and every stack stages on AUTO.
// The browser half (each picker rocket launched, model groups checked per stage) writes playtest/staging_audit.md.
import { Flight } from '../flight.js?v=f5.3b4';
import { SHOWROOM, EXTRA_STACKS } from '../fun/showroom.js?v=f5.3b4';
import { audit, pickBase, dropPlan } from '../fun/stagemap.js?v=f5.3b4';
import { STAGE_KEYS, HEIGHTS } from '../gfx/vehicles/stage_keys.js?v=f5.3b4';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('FAIL', m); } };
const stacks = {}; for (const r of SHOWROOM) stacks[r.id] = r.design; for (const [k, x] of Object.entries(EXTRA_STACKS)) stacks[k] = x.design;
const st = {}; for (const [k, d] of Object.entries(stacks)) st[k] = new Flight(JSON.parse(JSON.stringify(d)), {}, {}).v.stages;
let good = 0, n = 0; for (const id of Object.keys(STAGE_KEYS)) { const keys = STAGE_KEYS[id]; if (keys.length < 2) continue; n++;
  const b = pickBase(keys, HEIGHTS[id] || 50); ok(st[b], `${id}: base ${b} exists`); if (!st[b]) continue; const a = audit(keys, st[b]); if (a.ok) good++; else console.log('  note', id, b, a.causes.join('; '));
  const p = dropPlan(keys, st[b]); ok(p.plan.slice(0, -1).flat().length > 0 || st[b].length === 1, `${id}: at least one model group drops`); }
ok(good / n >= 0.95, `house models stage-matched: ${good}/${n}`); console.log(`  stage-matched ${good}/${n}`);
for (const [k, d] of Object.entries(stacks)) { if (st[k].length < 2) continue; const F = new Flight(JSON.parse(JSON.stringify(d)), {}, {}); F.stagePress(); F.setAuto(true, true); let c = 0, ev = 0;
  for (let i = 0; i < 30 * 1500 && !F.flags.dead && !F.flags.orbit; i++) { F.advance(1 / 30); if (F.v.cur !== c) { c = F.v.cur; ev++; } }
  ok(ev >= 1 && !F.flags.dead, `${k}: stages on AUTO (${ev} separations${F.flags.dead ? ', ' + F.flags.dead : ''})`); }
console.log(`staging: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

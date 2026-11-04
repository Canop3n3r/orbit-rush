// logos-deploy-1: payload appendage timing (stowed at 0, deployed at 1, moving in between). Run: node tests/payload_deploy.mjs
import assert from 'node:assert/strict';
import { wingAngles, rollOut, boomOut, hinge, FOLD } from '../gfx/vehicles/deploy_math.js';
for (const n of [2, 3, 6]) for (const s of [-1, 1]) { const a0 = wingAngles(0, n, s), a1 = wingAngles(1, n, s), am = wingAngles(0.5, n, s);
  assert.equal(a0.length, n); assert.ok(Math.abs(a0[0]) > 1.5 && a0.slice(1).every(a => Math.abs(a) > FOLD * 0.99), `n=${n} s=${s}: stowed folded`);
  assert.ok(a1.every(a => Math.abs(a) < 1e-9), `n=${n}: flat when deployed`); assert.ok(am.some((a, i) => Math.abs(a) < Math.abs(a0[i]) - 0.05), `n=${n}: moving at k=0.5`);
  for (let i = 1; i < n; i++) assert.ok(Math.sign(a0[i]) !== Math.sign(a0[i - 1]) || i === 1, 'accordion alternates');
  let prev = a0.map(Math.abs); for (let k = 0.05; k <= 1.0001; k += 0.05) { const a = wingAngles(k, n, s).map(Math.abs); assert.ok(a.every((v, i) => v <= prev[i] + 1e-9), 'unfolds monotonically'); prev = a; } }
assert.ok(rollOut(0).unroll < 0.05 && Math.abs(rollOut(0).mast) > 1.5 && rollOut(1).unroll === 1 && rollOut(1).mast === 0, 'roll-out: stowed drum, full blanket');
assert.ok(boomOut(0) < 0.2 && boomOut(1) === 1 && boomOut(0.7) > boomOut(0.5), 'boom telescopes out');
assert.ok(hinge(0, 2) === 2 && hinge(1, 2) === 0, 'hinged antenna opens');
// every payload kind has a deploy rig (source check: the BUILD kinds get wings + EXTRA, the craft shapes return rig)
const src = (await import('node:fs')).readFileSync(new URL('../gfx/vehicles/payloads.js', import.meta.url), 'utf8'), craft = (await import('node:fs')).readFileSync(new URL('../gfx/vehicles/craft_models.js', import.meta.url), 'utf8');
const { KINDS } = await import('../gfx/vehicles/payload_kinds.js');
for (const k of KINDS) { if (k === 'roadster') continue; const inBuild = new RegExp(`\\n  ${k}\\(b, w, hi\\)`).test(src); const inCraft = new RegExp(`\\n  ${k}\\(det\\)[\\s\\S]*?rig`).test(craft);
  assert.ok(inBuild ? new RegExp(`\\n  ${k}: \\(\\)`).test(src) : inCraft, `kind ${k} has deployables`); }
console.log('payload_deploy ok');

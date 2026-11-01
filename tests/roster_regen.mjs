// Regeneration check (Vehicle Specs lane): the 4 rocketdb-generated roster files (dougwing, convex, isra, jaxo) come back
// byte-identical from a full private regen, and every roster booster count (all 9 booster files) regenerates with no diff.
// The generator and rocketdb are private tooling on the specs box; elsewhere this test reports SKIP and passes.
// Run: node tests/roster_regen.mjs
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const WT = fileURLToPath(new URL('..', import.meta.url)), WK = process.env.GEN_TOOLS || '/workspace/wk';
const steps = [['full regen: 4 generated files zero diff', 'regen_current.sh'], ['booster counts: 9 files regenerate with no diff', 'test_boosters_regen.sh']];
if (!steps.every(([, f]) => existsSync(`${WK}/${f}`))) { console.log(`roster_regen: SKIP (private generator not found in ${WK})`); process.exit(0); }
let fail = 0;
for (const [what, f] of steps) { const r = spawnSync('bash', [`${WK}/${f}`, WT], { encoding: 'utf8' });
  console.log((r.status === 0 ? '  ✔ ' : '  ✘ ') + what + '\n' + (r.stdout || '').trim().split('\n').map(l => '      ' + l).join('\n')); if (r.status !== 0) { fail++; console.log(r.stderr); } }
console.log(`\nroster_regen: ${steps.length - fail} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

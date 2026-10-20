// f3: AUTO stages the booster itself with landing fuel left, and the booster flies home. Run: node tests/f3.mjs
import * as P from '../physics.js?v=f5a.1';
import { simulateAuto } from '../flight.js?v=f5a.1';
import { SHOWROOM } from '../fun/showroom.js?v=f5a.1';
import { TEMPLATES } from '../parts.js?v=f5a.1';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fail++; console.log('  ✘', m); } };
for (const d of [SHOWROOM.find(r => r.id === 'kestrel').design, TEMPLATES.find(t => t.name === 'Light & fast')]) {
  const r = simulateAuto(d, { dt: 1 / 20, tMax: 3000 });
  ok(r.orbit && r.pe > P.ORBIT_PE, `${d.name}: AUTO alone reaches orbit (${(r.pe / 1000).toFixed(0)} km Pe)`);
  ok(r.boosterLanded, `${d.name}: AUTO staged with landing fuel and the booster landed itself (no STAGE taps)`);
}
const off = simulateAuto(SHOWROOM.find(r => r.id === 'kestrel').design, { dt: 1 / 20, autoStage: false });
ok(!off.boosterLanded, 'with auto-staging off the booster burns dry (manual staging path unchanged)');
import { readFileSync } from 'fs';
ok(!/master\.connect\(master\)/.test(readFileSync(new URL('../main.js', import.meta.url), 'utf8')), 'audio master gain goes to the speakers (not wired to itself)');
console.log(`f3: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

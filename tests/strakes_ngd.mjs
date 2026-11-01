// stages-pass-2: the reusable Blue-HZ first stage carries two aft side strakes (strake_0/1 pivots) at every tier. Run: node tests/strakes_ngd.mjs
import { readFileSync } from 'node:fs';
let pass = 0, fail = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); t ? pass++ : fail++; };
for (const tier of ['hi', 'mid', 'lo']) {
  const b = readFileSync(new URL(`../assets/rockets/new-glendale/s1.${tier}.glb`, import.meta.url)); const n = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + n).toString()); const names = (j.nodes || []).map(x => x.name || '');
  ok(names.filter(s => /^strake_\d+$/.test(s)).length === 2, `new-glendale s1.${tier}: 2 strakes (${names.filter(s => /strake/.test(s)).join(',')})`);
}
console.log(`\nstrakes_ngd: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

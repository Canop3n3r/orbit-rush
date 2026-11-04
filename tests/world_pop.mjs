// world-pop-1: site dressing rules (pure, no three.js): every scatter / hills part keeps its plants and rocks on land, off the pad,
// trench, roads and buildings; photo assets stay inside the phone budget (1024 px colour, 512 px normal, < 4 MB in total).
// Run: node tests/world_pop.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
let pass = 0, fail = 0; const ok = (c, n) => { if (c) pass++; else fail++; console.log((c ? '  ✔ ' : '  ✘ ') + n); };
import { landTest, keepOut } from '../gfx/sites/worldmask.js';
const W = { 'cape-north': 1, 'cape-heritage': 1, atoll: 1 };
for (const id of Object.keys(W)) { const S = (await import(`../gfx/sites/site_${id}.js`)).SITE, land = landTest(S), free = keepOut(S);
  const sc = S.layout.find(o => o.k === 'scatter'), hl = S.layout.find(o => o.k === 'hills'), pad = S.layout.find(o => o.k === 'pad');
  ok(!!sc && !!hl, `${id}: has scatter + hills`);
  const bl = S.layout.find(o => o.k === 'belts'); ok(!!bl && (bl.road || bl.perimeter || bl.coast) > 0, `${id}: has world-pop-2 belts (road / perimeter / coast tree lines)`);
  if (bl?.perimeter) ok(!free(0, 0) && bl.ring > pad.r * 1.35 + 10, `${id}: belt ring ${bl.ring} m sits outside the pad keep-out`);
  ok(!free(0, 0) && !free(0, pad.r) && !free(pad.r * 1.3, 0) && !free(0, pad.r * 1.2), `${id}: pad, fence and trench exit are keep-out`);
  for (const o of S.layout.filter(o => o.k === 'road')) { const [a, b] = o.pts; ok(!free((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), `${id}: road ${JSON.stringify(a)} is keep-out`); }
  for (const o of S.layout.filter(o => ['hangar', 'block', 'tanks', 'lot', 'vab'].includes(o.k))) ok(!free(...o.at), `${id}: ${o.k} at ${o.at} is keep-out`);
  ok(land(0, 0) && land(0, 0, 50), `${id}: pad on land`);
  let sea = 0; for (let t = 0; t < 64; t++) if (!land(Math.cos(t / 64 * 6.283) * sc.r1, Math.sin(t / 64 * 6.283) * sc.r1)) sea++;
  ok(id === 'atoll' ? sea === 0 : sea > 0, `${id}: scatter ring ${sc.r1} m ${id === 'atoll' ? 'stays on the island sand' : 'reaches the coast (sea side is excluded)'} (${sea}/64 sea)`);
  if (!hl.islets) ok(hl.r0 > (S.layout.find(o => o.k === 'vab') ? 7000 : 3000), `${id}: hills start past the complex (${hl.r0} m)`); }
const dir = new URL('../assets/world/', import.meta.url); let bytes = 0;
for (const f of readdirSync(dir)) { bytes += statSync(new URL(f, dir)).size; const b = readFileSync(new URL(f, dir)); ok(b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP', `${f}: webp`);
  const w = b.readUInt16LE(26) & 0x3fff, h = b.readUInt16LE(28) & 0x3fff; /* lossy VP8 frame header */ ok(f.includes('_nor') ? w <= 512 && h <= 512 : w <= 1024 && h <= 1024, `${f}: ${w}x${h}`); }
ok(bytes < 4e6, `assets/world total ${(bytes / 1e6).toFixed(2)} MB < 4 MB (shared by every site)`);
ok(/assets\/world/.test(readFileSync(new URL('../CREDITS.md', import.meta.url), 'utf8')), 'CREDITS.md lists assets/world');
console.log(`world_pop: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

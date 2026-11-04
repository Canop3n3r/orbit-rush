// logos-deploy-1: every launch house has an original logo spec, a shipped SVG, and its own atlas cell. Run: node tests/logos.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LOGOS, HOUSE_IDS, ATLAS, cellOf, uvRect, svgOf } from '../gfx/vehicles/logos_spec.js';
import { HOUSES } from '../fun/picker.js';
for (const [h] of HOUSES) assert.ok(LOGOS[h], `house ${h} has a logo`);
assert.ok(LOGOS.originals, 'the game\'s own Originals house has a logo');
assert.ok(HOUSE_IDS.length <= ATLAS.cols * ATLAS.rows, 'all houses fit one atlas');
const cells = new Set(); for (const h of HOUSE_IDS) { const c = cellOf(h); assert.ok(c.x + ATLAS.cw <= ATLAS.size && c.y + ATLAS.ch <= ATLAS.size, h + ' cell inside the atlas'); const k = c.x + ',' + c.y; assert.ok(!cells.has(k), h + ' own cell'); cells.add(k);
  for (const part of ['mark', 'word', 'flag']) { const r = uvRect(h, part); assert.ok(r.every(v => v >= 0 && v <= 1) && r[2] > r[0] && r[3] > r[1], `${h} ${part} uv rect`); } }
const marks = new Set(); for (const h of HOUSE_IDS) { const L = LOGOS[h]; assert.ok(L.word && L.word.length <= 12, h + ' short wordmark'); assert.ok(L.layers.length >= 2 && L.layers.every(([d, ci]) => /^M[-\d.]/.test(d) && L.c[ci]), h + ' mark has >=2 layers of valid paths');
  assert.ok(L.flag.length >= 2, h + ' country stripe'); const sig = L.layers.map(l => l[0]).join('|'); assert.ok(!marks.has(sig), h + ' mark is unique'); marks.add(sig);
  assert.equal(readFileSync(new URL(`../brand/logos/${h}.svg`, import.meta.url), 'utf8'), svgOf(h), h + '.svg is current (node tools/gen_logos.mjs)'); }
assert.ok(/originals|ORIGINAL/i.test(readFileSync(new URL('../CREDITS.md', import.meta.url), 'utf8')) && /brand\/logos/.test(readFileSync(new URL('../CREDITS.md', import.meta.url), 'utf8')), 'CREDITS.md credits brand/logos');
console.log('logos ok', HOUSE_IDS.length, 'houses');

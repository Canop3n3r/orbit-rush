// f5 world-1 budget/regression checks (node tests/world_budget.mjs)
import { readFileSync } from 'node:fs';
import { WORLD_TIERS, CLOUD_LAYER, worldTier, lonLatToDir } from '../gfx/world/tiers.js';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : (fail++, console.log('FAIL', m)); };
ok(worldTier('high', true) === 'low' && worldTier('med', true) === 'low', 'touch devices always get the 2D cloud tier');
ok(worldTier('low', false) === 'low', 'low preset (software GPU) gets 2D clouds');
ok(!WORLD_TIERS.low.volumetric && WORLD_TIERS.low.steps === 0, 'low tier never raymarches');
for (const [k, t] of Object.entries(WORLD_TIERS)) ok(t.steps * (1 + t.light) <= 90, `${k}: density samples/pixel ${t.steps * (1 + t.light)} <= 90`);
ok(WORLD_TIERS.high.steps <= 32 && WORLD_TIERS.med.steps <= 16, 'step budgets');
ok(CLOUD_LAYER.base > 0.5 && CLOUD_LAYER.top < 15 && CLOUD_LAYER.top > CLOUD_LAYER.base, 'cloud layer 0.5-15 km');
const d = lonLatToDir(-80.6, 28.6); ok(Math.abs(Math.hypot(...d) - 1) < 1e-9 && Math.abs(Math.asin(d[1]) * 180 / Math.PI - 28.6) < 1e-9, 'lon/lat -> dir');
const src = readFileSync(new URL('../gfx/world/clouds.js', import.meta.url), 'utf8');
ok(!/\bLoop\(/.test(src.replace(/import[^;]+;/, '')), 'clouds: no dynamic TSL Loop (stalls software/mobile GPUs; unrolled instead)');
ok(/\.level\(0\)/.test(src), 'clouds: weather map sampled with explicit LOD inside the march');
const all = ['clouds.js', 'surfaces.js', 'common.js', 'tiers.js'].map(f => readFileSync(new URL('../gfx/world/' + f, import.meta.url), 'utf8')).join('\n');
ok(!/atmoMaterial\s*\(|makePost|bloom/i.test(all.replace(/\/\/.*$/gm, '')), 'world modules do not touch atmosphere/bloom (f4.1 owns it)');
ok(/world-1|gfx\/world/.test(readFileSync(new URL('../CREDITS.md', import.meta.url), 'utf8')), 'CREDITS.md mentions world-1');
console.log(`world_budget: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);

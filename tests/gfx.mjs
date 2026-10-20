// Milestone B (gx1) graphics tests that run without a GPU: presets, Earth map alignment, licensed assets + credits.
// Run: node tests/gfx.mjs
import fs from 'fs';
import { GFX, GFX_ORDER } from '../gfx/presets.js?v=f5a';
import { PAD_LON_DEG, PAD_LAT_DEG, EARTH_TEX_ROT, sampleEarth, latLonToGame, gameToGeo } from '../gfx/earthmap.js?v=f5a';
let pass = 0, fail = 0;
const ok = (c, n, x = '') => { if (c) { pass++; console.log('  ✔', n, x); } else { fail++; console.log('  ✘', n, x); } };
console.log('1. Quality presets');
ok(GFX_ORDER.every(q => GFX[q]) && GFX_ORDER.length === 3, 'low / med / high defined');
ok(!GFX.low.bloom && GFX.low.pixel <= 1 && GFX.low.tex === '_1k', 'Low: no bloom, 1x pixels, 1K textures (phones, software GPU)');
ok(GFX.high.bloom && GFX.high.tex === '', 'High: bloom + 2K textures');
console.log('2. Earth map alignment (synthetic equirect map: red channel = longitude, green = latitude)');
{ const W = 360, H = 180, day = new Uint8ClampedArray(W * H * 4), spec = new Uint8ClampedArray(W * H * 4);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const o = (j * W + i) * 4; day[o] = Math.round(i / W * 255); day[o + 1] = Math.round(j / H * 255); spec[o] = (i - 180 + 0.5) > -79 ? 255 : 0; /* f5: coast just east of LC-39A */ }
  const px = { day, spec, W, H }, out = [0, 0, 0, 0];
  sampleEarth(px, [1, 0, 0], out); const lon = (out[0] ** (1 / 2.2)) * 360 - 180, lat = 90 - (out[1] ** (1 / 2.2)) * 180;
  ok(Math.abs(lon - PAD_LON_DEG) < 1.5 && Math.abs(lat - PAD_LAT_DEG) < 1.5, 'Earth-fixed +x (the pad) samples the texture at LC-39A 28.6° N, 80.6° W', `${lon.toFixed(1)}°, ${lat.toFixed(1)}°`);
  { const p = latLonToGame(PAD_LAT_DEG, PAD_LON_DEG); ok(Math.abs(p[0] - 1) < 1e-9 && Math.abs(p[1]) < 1e-9 && Math.abs(p[2]) < 1e-9, 'LC-39A maps to +x'); const e = latLonToGame(PAD_LAT_DEG, PAD_LON_DEG + 1); ok(e[1] > 0 && Math.abs(e[2]) < 0.01, 'geographic east = game east (+y)'); const g = gameToGeo(latLonToGame(10, 20)); ok(Math.abs(Math.atan2(g[1], g[0]) * 180 / Math.PI - 20) < 1e-6, 'round trip'); }
  sampleEarth(px, [1, 0, 0], out); ok(out[3] < 0.5, 'pad is on land in the mask'); const a = 3 * Math.PI / 180; sampleEarth(px, [Math.cos(a), Math.sin(a), 0], out); ok(out[3] > 0.5, '3° east (downrange) is sea in the mask');
  sampleEarth(px, [0, 0, 1], out); ok(out.every(Number.isFinite), 'poles sample finite values'); }
console.log('3. Licensed assets and credits');
{ const dir = new URL('../assets/tex/', import.meta.url), files = fs.readdirSync(dir), credits = fs.readFileSync(new URL('../CREDITS.md', import.meta.url), 'utf8'), html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  ok(files.length >= 25, 'textures present', files.length + ' files');
  ok(/CC BY 4\.0/.test(credits) && /Solar System Scope/.test(credits), 'CREDITS.md names the source and licence');
  const base = f => f.replace(/(_1k)?\.(jpg|png)$/, '');
  const missing = files.filter(f => !credits.includes(base(f).replace(/_spec$/, '_spec')) && !credits.includes(base(f) + '*'));
  ok(missing.length === 0, 'every texture file is listed in CREDITS.md', missing.join(', '));
  ok(/id="credits"/.test(html) && /CC BY 4\.0/.test(html), 'in-game Credits panel with the licence');
  const big = files.filter(f => fs.statSync(new URL(f, dir)).size > 1.2e6); ok(!big.length, 'no texture over 1.2 MB', big.join(', '));
  const kb = files.filter(f => /_1k|spec|ring/.test(f)).reduce((t, f) => t + fs.statSync(new URL(f, dir)).size, 0) / 1024; ok(kb < 2500, 'Low/Medium texture set under 2.5 MB', kb.toFixed(0) + ' KB'); }
console.log(`gfx: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

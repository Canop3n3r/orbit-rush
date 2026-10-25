// f5.9 terrain: the near-field ground tile must hand off to the globe at every altitude (no round edge, no pop). No GPU needed.
// Run: node tests/tilefade.mjs
import { TILE_FADE, TILE_R, TILE_SLACK, tileAlpha, tileAltAlpha, tileRadAlpha, tileRimAlpha } from '../gfx/tilefade.js';
import fs from 'fs';
let pass = 0, fail = 0; const ok = (c, n, x = '') => { if (c) { pass++; console.log('  ✔', n, x); } else { fail++; console.log('  ✘', n, x); } };
const ALTS = [0, 1, 5, 20, 44, 100, 200, 400].map(k => k * 1000);
ok(ALTS.every(h => tileRimAlpha(h) === 0), 'the tile rim (>= 125 km from the nadir, even when the tile is 25 km off-centre) is fully transparent at 0, 1, 5, 20, 44, 100, 200, 400 km');
ok(TILE_FADE.r1 <= TILE_R - TILE_SLACK, 'the radial fade ends inside the guaranteed rim', `${TILE_FADE.r1} <= ${TILE_R - TILE_SLACK}`);
ok(tileAltAlpha(0) === 1 && tileAltAlpha(TILE_FADE.a0) === 1 && tileAltAlpha(TILE_FADE.a1) === 0 && tileAltAlpha(80000) === 0, 'altitude alpha: 1 on the ground, 0 from 62 km up (the old hard cut at 80 km is gone)');
{ let prev = 1, mono = true, maxStep = 0; for (let h = 0; h <= 90000; h += 250) { const a = tileAltAlpha(h); if (a > prev + 1e-12) mono = false; maxStep = Math.max(maxStep, prev - a); prev = a; }
  ok(mono, 'altitude alpha never rises with height'); ok(maxStep < 0.01, 'no pop: alpha drops < 1% per 250 m of altitude', maxStep.toFixed(4)); }
{ let prev = 1, mono = true, maxStep = 0; for (let d = 0; d <= 160000; d += 500) { const a = tileRadAlpha(d); if (a > prev + 1e-12) mono = false; maxStep = Math.max(maxStep, prev - a); prev = a; }
  ok(mono, 'radial alpha never rises with distance'); ok(maxStep < 0.02, 'no edge: alpha drops < 2% per 500 m of ground range', maxStep.toFixed(4)); }
ok(tileAlpha(0, 1000) === 1 && tileAlpha(3000, 30000) === 1, 'on the ground and in the first 55 km below 14 km the tile is fully opaque (pad scenes unchanged)');
ok(TILE_FADE.swap < TILE_FADE.a0 && Math.sqrt(2 * 6378137 * TILE_FADE.swap) >= TILE_R - TILE_SLACK, 'the opaque variant is only used while its rim is at/beyond the horizon', `horizon ${(Math.sqrt(2 * 6378137 * TILE_FADE.swap) / 1000).toFixed(0)} km`);
{ const m = fs.readFileSync(new URL('../main.js', import.meta.url), 'utf8'), g = fs.readFileSync(new URL('../gfx/gfx.js', import.meta.url), 'utf8');
  ok(/GLOBE_SAG \* smooth01/.test(m) && /R - 600|R - 600,/.test(m), 'the tile settles onto the globe sphere (R - 600) toward its rim: no height step');
  ok(/handoff/.test(g) && /opacityNode/.test(g) && /padLandU/.test(g), 'fade material and the globe launch-site override exist'); }
console.log(`tilefade: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

// sites-on-land-2: every Earth launch site stands on land in the ground the game renders.
// Inside the shaped cape coast zone the pad and its ground ring lie west of the coast (with the wiggle as margin).
// Everywhere else the catalog point is dry on the same 1k specular mask the tile samples (gfx/earthmap.js sampleGray)
// — open ocean is not painted into a land disc (groundBlend). Atoll Range is the exception: no land texel exists,
// so the tile feathers an island shore into the sea.
// Run: node tests/sites_on_land.mjs
import { spawnSync } from 'node:child_process';
import { latLonToGame, coastEastM, siteLand, groundBlend, sampleGray, COAST } from '../gfx/earthmap.js';
import { SITES } from '../sites.js';
let pass = 0, fail = 0; const ok = (c, n) => { if (c) pass++; else fail++; console.log((c ? '  ✔ ' : '  ✘ ') + n); };
const R = 6378137;
const specPath = new URL('../assets/tex/earth_spec_1k.jpg', import.meta.url).pathname;
const dec = spawnSync('ffmpeg', ['-v', 'error', '-i', specPath, '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1'], { maxBuffer: 2 << 20 });
ok(dec.status === 0 && dec.stdout && dec.stdout.length === 1024 * 512, `earth specular mask decoded (${dec.stdout ? dec.stdout.length : 0} bytes)`);
const mask = dec.status === 0 ? { W: 1024, H: 512, data: dec.stdout } : null;
const dry = (lat, lon) => { const c = mask ? sampleGray(mask, lat, lon) : 255; if (c >= 80) return false;
  for (let k = 0; k < 8; k++) { const t = k / 8 * Math.PI * 2, la = lat + Math.sin(t) * 0.06, lo = lon + Math.cos(t) * 0.06 / Math.cos(lat * Math.PI / 180);
    if (sampleGray(mask, la, lo) >= 110) return false; } return true; };
for (const [id, name, lat, lon, art] of SITES.earth) {
  let S = null; try { S = (await import(`../gfx/sites/site_${art}.js`)).SITE; } catch (e) { }
  const pad = S && (S.layout || []).find(o => o.k === 'pad' || o.k === 'catch'), ringR = pad ? (pad.r || 40) * 1.6 : 120;
  const pts = [[0, 0], ...Array.from({ length: 24 }, (_, i) => [Math.cos(i / 24 * 2 * Math.PI) * ringR, Math.sin(i / 24 * 2 * Math.PI) * ringR])];
  const c = latLonToGame(lat, lon), inZone = Math.acos(Math.min(1, c[0])) * R < COAST.zone;
  if (art && art !== 'generic') ok(S && Math.abs(S.lat - lat) < 1e-6 && Math.abs(S.lon - lon) < 1e-6, `${name}: art lat/lon matches the catalog`);
  if (inZone) { const bad = pts.filter(([e, n]) => { const eM = c[1] * R + e, nM = c[2] * R + n; return eM > coastEastM(nM) - COAST.wiggle - 150; });
    ok(!bad.length, `${name}: pad + ${Math.round(ringR)} m ring west of the shaped coast (coast ${Math.round(coastEastM(c[2] * R) - c[1] * R)} m east of the pad)`); }
  else if (id === 'atoll') { const L = siteLand(S), reach = L.r * (1 - L.wob);
    const mid = groundBlend(1, 0, reach, L.edge, true), rim = groundBlend(1, reach, reach, L.edge, true), ring = groundBlend(1, ringR, reach, L.edge, true);
    ok(mid.water < 0.05 && mid.tint > 0.9, `${name}: island centre is dry sand`);
    ok(ring.water < 0.15, `${name}: pad ring stays on the island (${ring.water.toFixed(2)} water)`);
    ok(rim.water > 0.95 && rim.tint < 0.05, `${name}: shore feathers into the sea (no hard disc)`); }
  else if (mask) { const w = sampleGray(mask, lat, lon); ok(dry(lat, lon), `${name}: on dry land in the specular mask (spec ${w.toFixed(0)})`);
    const sea = groundBlend(0.95, 0, 800, 300, false); ok(sea.water > 0.9 && sea.tint === 0, `${name}: open ocean under a pad is not painted into a land disc`); }
}
{ const n = latLonToGame(28.5619, -80.5772); ok(coastEastM(n[2] * R) - n[1] * R > 1000 && coastEastM(n[2] * R) - n[1] * R < 1700, 'North Coast pad sits ~1.3 km inland of the shore'); }
{ const damp = groundBlend(0.5, 0, 800, 300, false), far = groundBlend(0.5, 5000, 800, 300, false), land = groundBlend(0.1, 0, 800, 300, false);
  ok(damp.water < 0.35 && damp.tint === 0, `a damp coast sample under the pad dries without a colour disc (${damp.water.toFixed(2)})`);
  ok(far.water === 0.5, 'past the blend the mask is left alone');
  ok(land.water === 0.1 && land.tint === 0, 'solid land keeps the sampled terrain'); }
console.log(`sites_on_land: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

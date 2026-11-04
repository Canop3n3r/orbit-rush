// sites-on-land-1: every Earth launch site stands on land in the ground the game renders (main.js updateTile):
// inside the shaped cape coast zone the pad and its ground ring lie west of the coast (with the wiggle as margin);
// elsewhere the site's land apron (earthmap.js siteLand) covers the pad and its ground ring even where the 1k mask is all sea.
// Run: node tests/sites_on_land.mjs
import { latLonToGame, coastEastM, siteLand, COAST } from '../gfx/earthmap.js';
import { SITES } from '../sites.js';
let pass = 0, fail = 0; const ok = (c, n) => { if (c) pass++; else fail++; console.log((c ? '  ✔ ' : '  ✘ ') + n); };
const R = 6378137, D = Math.PI / 180;
for (const [id, name, lat, lon, art] of SITES.earth) {
  let S = null; try { S = (await import(`../gfx/sites/site_${art}.js`)).SITE; } catch (e) { }
  const pad = S && (S.layout || []).find(o => o.k === 'pad' || o.k === 'catch'), ringR = pad ? (pad.r || 40) * 1.6 : 120; // the concrete -> gravel -> ground ring around the pad
  const pts = [[0, 0], ...Array.from({ length: 24 }, (_, i) => [Math.cos(i / 24 * 2 * Math.PI) * ringR, Math.sin(i / 24 * 2 * Math.PI) * ringR])]; // [east, north] metres
  const c = latLonToGame(lat, lon), inZone = Math.acos(Math.min(1, c[0])) * R < COAST.zone;
  if (inZone) { const bad = pts.filter(([e, n]) => { const eM = c[1] * R + e, nM = c[2] * R + n; return eM > coastEastM(nM) - COAST.wiggle - 150; });
    ok(!bad.length, `${name}: pad + ${Math.round(ringR)} m ring west of the shaped coast (coast ${Math.round(coastEastM(c[2] * R) - c[1] * R)} m east of the pad)`); }
  else { const L = siteLand(S), sure = L.r * (1 - L.wob) - L.edge; ok(sure >= ringR, `${name}: land apron sure radius ${Math.round(sure)} m covers the ${Math.round(ringR)} m pad ring`); }
}
{ const n = latLonToGame(28.5619, -80.5772); ok(coastEastM(n[2] * R) - n[1] * R > 1000 && coastEastM(n[2] * R) - n[1] * R < 1700, 'North Coast pad sits ~1.3 km inland of the shore'); }
console.log(`sites_on_land: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

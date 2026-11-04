// world-pop-1: pure (node-testable) land and keep-out masks for site dressing, in the site's local frame (+X east, +Z south, metres
// from the pad). Coastal sites use the same shaped coast + margin as tests/sites_on_land.mjs; islands use the site's land apron / sand disc.
import { latLonToGame, coastEastM, COAST } from '../earthmap.js?v=f5.9-23';
const ER = 6378137;
export function landTest(S) { const L = S.land, g = (S.layout || []).find(o => o.k === 'ground');
  if (S.body !== 'earth') return () => true;
  const c = latLonToGame(S.lat, S.lon), inZone = Math.acos(Math.min(1, c[0])) * ER < COAST.zone;
  if (inZone) { const e0 = c[1] * ER, n0 = c[2] * ER; return (x, z, m = 0) => e0 + x < coastEastM(n0 - z) - COAST.wiggle - 150 - m; } // same margin as tests/sites_on_land.mjs
  const r = L ? L.r * (1 - (L.wob ?? 0.18)) - (L.edge || 300) : (g ? g.r : 600); // the in-game tile's sure land radius (tests/sites_on_land.mjs), not the viewer's sand disc
  return (x, z, m = 0) => Math.hypot(x, z) < r - m; }
// world-pop-2: the waterline the game's ground tile actually shades (main.js coastal tile: coastEastM + wiggle * fbm, wC = 0.5), as local x(z);
// null for islands / sites outside the shaped-coast zone. fbm is a copy of main.js's value noise (pure; keep in sync).
const h3 = (x, y, z) => { let h = x * 374761393 + y * 668265263 + z * 2147483647; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
function vn(x, y, z) { const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), s = t => t * t * (3 - 2 * t), u = s(x - xi), v = s(y - yi), w = s(z - zi), L = (a, b, t) => a + (b - a) * t, c = (i, j, k) => h3(xi + i, yi + j, zi + k);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w); }
const fbm = (x, y, z) => { let a = 0, f = 1, amp = 0.5; for (let i = 0; i < 4; i++) { a += amp * vn(x * f, y * f, z * f); f *= 2.1; amp *= 0.5; } return a; };
export function coastLine(S) { if (S.body !== 'earth') return null; const c = latLonToGame(S.lat, S.lon); if (Math.acos(Math.min(1, c[0])) * ER >= COAST.zone) return null;
  const e0 = c[1] * ER, n0 = c[2] * ER; return z => { const n = n0 - z; return coastEastM(n) + COAST.wiggle * (fbm(n * 0.00025, 3.1, 7.7) - 0.5) * 2 - e0; }; }
const segD = (px, pz, [x0, z0], [x1, z1]) => { const dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((px - x0) * dx + (pz - z0) * dz) / L2)); return Math.hypot(px - x0 - t * dx, pz - z0 - t * dz); };
// keep-out discs / road strips from the site's own layout (pad + fence + trench, buildings, tanks, masts, roads, lots)
export function keepOut(S) { const D = [], R = [];
  for (const o of S.layout || []) { const [x, z] = o.at || [0, 0];
    switch (o.k) {
      case 'pad': D.push([x, z, (o.r || 60) * 1.35 + 10]); D.push([x, z + (o.r || 60) * 1.2, (o.trench || 12) * 2 + 10]); break; // pad, fence, flood masts, trench exit
      case 'catch': D.push([x, z, (o.r || 70) * 1.3 + 40]); break;
      case 'lz': D.push([x, z, (o.r || 45) * 1.5]); break;
      case 'vab': D.push([x, z, Math.hypot(o.w, o.d) / 2 + 40]); break;
      case 'hangar': case 'block': case 'lot': case 'bld': D.push([x, z, Math.hypot(o.w || 60, o.d || 90) / 2 + 14]); break;
      case 'tanks': D.push([x, z, (o.n || 3) * (o.r || 8) * 1.3 + (o.r || 8) * 3 + 12]); break;
      case 'water': case 'dish': D.push([x, z, (o.r || 9) * 1.5 + 10]); break;
      case 'stand': D.push([x, z, 24]); break;
      case 'masts': for (const p of o.pts) D.push([p[0], p[1], 8]); break;
      case 'road': for (let i = 1; i < o.pts.length; i++) R.push([o.pts[i - 1], o.pts[i], (o.w || 10) / 2 + 9]); break; } }
  return (x, z, m = 0) => !D.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r + m) && !R.some(([a, b, w]) => segD(x, z, a, b) < w + m); }

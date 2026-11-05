// world-pop-1: pure (node-testable) land and keep-out masks for site dressing, in the site's local frame (+X east, +Z south, metres
// from the pad). Coastal sites use the same shaped coast + margin as tests/sites_on_land.mjs; islands use the site's land apron / sand disc.
import { latLonToGame, coastEastM, COAST } from '../earthmap.js?v=f5.9-27';
const ER = 6378137;
export function landTest(S) { const L = S.land, g = (S.layout || []).find(o => o.k === 'ground');
  if (S.body !== 'earth') return () => true;
  const c = latLonToGame(S.lat, S.lon), inZone = Math.acos(Math.min(1, c[0])) * ER < COAST.zone;
  if (inZone) { const e0 = c[1] * ER, n0 = c[2] * ER; return (x, z, m = 0) => e0 + x < coastEastM(n0 - z) - COAST.wiggle - 150 - m; } // same margin as tests/sites_on_land.mjs
  const r = L ? L.r * (1 - (L.wob ?? 0.18)) - (L.edge || 300) : (g ? g.r : 600); // the in-game tile's sure land radius (tests/sites_on_land.mjs), not the viewer's sand disc
  return (x, z, m = 0) => Math.hypot(x, z) < r - m; }
const segD = (px, pz, [x0, z0], [x1, z1]) => { const dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((px - x0) * dx + (pz - z0) * dz) / L2)); return Math.hypot(px - x0 - t * dx, pz - z0 - t * dz); };
// keep-out discs / road strips from the site's own layout (pad + fence + trench, buildings, tanks, masts, roads, lots)
export function keepOut(S) { const D = [], R = [];
  for (const o of S.layout || []) { const [x, z] = o.at || [0, 0];
    switch (o.k) {
      case 'pad': D.push([x, z, (o.r || 60) * 1.35 + 10]); D.push([x, z + (o.r || 60) * 1.2, (o.trench || 12) * 2 + 10]); break; // pad, fence, flood masts, trench exit
      case 'catch': D.push([x, z, (o.r || 70) * 1.3 + 40]); break;
      case 'lz': D.push([x, z, (o.r || 45) * 1.5]); break;
      case 'vab': D.push([x, z, Math.hypot(o.w, o.d) / 2 + 40]); break;
      case 'hangar': case 'block': case 'lot': D.push([x, z, Math.hypot(o.w || 60, o.d || 90) / 2 + 14]); break;
      case 'tanks': D.push([x, z, (o.n || 3) * (o.r || 8) * 1.3 + (o.r || 8) * 3 + 12]); break;
      case 'water': case 'dish': D.push([x, z, (o.r || 9) * 1.5 + 10]); break;
      case 'stand': D.push([x, z, 24]); break;
      case 'masts': for (const p of o.pts) D.push([p[0], p[1], 8]); break;
      case 'road': for (let i = 1; i < o.pts.length; i++) R.push([o.pts[i - 1], o.pts[i], (o.w || 10) / 2 + 9]); break; } }
  return (x, z, m = 0) => !D.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r + m) && !R.some(([a, b, w]) => segD(x, z, a, b) < w + m); }

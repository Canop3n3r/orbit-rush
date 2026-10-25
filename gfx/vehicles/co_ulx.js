// ULX branch: United Lift Alliance (parody) — Atlantean V (4xx/5xx: fairing size, solid-booster count, upper-stage engines)
// and Deltoid IV (Medium, Medium+ (4,2)/(5,2)/(5,4), Heavy). Original geometry, no logos/names.
// Dimensions: rocketdb atlantean-v / deltoid-4 (GCAT) + design.md; fairing lengths art-fitted to published totals.
import * as THREE from 'three/webgpu';
import { Kit, xf } from './kit.js?v=f5.8v';
import * as PR from './profiles.js?v=f5.8v';
import { lathe, tube, bell, ringPos, ring, decal, strut } from './parts.js?v=f5.8v';
import { group, lmat, plume } from './co_civspace.js?v=f5.8v';
const PI = Math.PI;
function swap(g, map) { for (const m of g.children) { const key = m.name.split(':').slice(1).join(':'); if (map[key]) m.material = lmat(map[key]); else if (key.startsWith('x-')) m.material = lmat(key); } return g; }
// solid booster: radius r, length L; group origin at its axis base (stage group so it detaches)
function solid(d, name, r, L, x, z, cant = 0.05) { const k = new Kit(d), a = Math.atan2(z, x);
  bell(k, r * 0.75, 1.6, 0, 0, 0, { head: 0, rt: r * 0.35 }); tube(k, r * 1.05, r, 1.2, 1.2, 'dark');
  tube(k, r, r, L - 1.2 - 2.6, 2.4, 'paint:0,0'); ring(k, r, L * 0.45, 0.02); lathe(k, PR.ogive(r, 2.6, L - 2.6 + 1.2, k.hi ? 14 : 6, 0.12), 'paint:0,0');
  const g = k.build(name); g.position.set(x, 0.6, z); g.rotation.set(0, -a, 0); return g; }
function solids(d, n, r, L, R0, prefix = 'srb') { const out = []; // positions: up to 5 around the 3 sides away from the umbilical side
  const ang = [PI * 0.5, PI * 1.5, PI * 0.15, PI * 1.85, PI * 1.0].slice(0, n); for (let i = 0; i < n; i++) out.push(solid(d, prefix + i, r, L, Math.cos(ang[i]) * R0, Math.sin(ang[i]) * R0)); return out; }
// ---- Atlantean V ----
const AR = 1.905, CCB = 32.5, CR = 1.525;
function ccb(d) { const k = new Kit(d);
  for (const sx of [-0.55, 0.55]) bell(k, 0.75, 2.8, sx, 0, 0, { head: 0.6, rt: 0.28 }); // twin-chamber kerosene engine
  tube(k, AR * 1.02, AR, 1.4, 2.4, 'dark'); tube(k, AR, AR, CCB - 3.8, 3.8, 'x-salmon', { hs: 1 }); for (const y of [12, 22]) ring(k, AR, y, 0.02, 'x-salmon2');
  k.add(new THREE.BoxGeometry(0.35, CCB - 6, 0.4), 'x-salmon2', xf([AR + 0.15, CCB / 2, 0])); decal(k, 'booster.side', AR, 16, 4, PI, 0.9);
  const g = swap(k.build('ccb'), {}); g.userData.top = CCB; return g; } // upper stage sits right on the core top
function upperStage(d, y0, n, exposed) { const k = new Kit(d), h = 12.7;
  if (exposed) tube(k, AR, CR, 3.2, y0, 'paint:0,0'); // conical interstage adapter (4 m fairing versions)
  for (const [x, z] of n === 2 ? [[-0.6, 0], [0.6, 0]] : [[0, 0]]) bell(k, 0.55, 1.9, x, y0 + 0.3, z, { ext: true, head: 0.4, rt: 0.15 });
  tube(k, CR, CR, h - 3.2, y0 + 3.2, exposed ? 'silver' : 'paint:0,0'); if (exposed) ring(k, CR, y0 + 7, 0.02);
  const g = k.build('upper'); g.userData.top = y0 + h; return g; }
function atl(o, cfg) { const d = o.detail, f = +cfg[0], s = +cfg[1], e = +cfg[2], b = ccb(d), y0 = b.userData.top, kids = [b];
  kids.push(...solids(d, s, 0.79, 20.0, AR + 0.85));
  let top;
  if (f === 4) { const c = upperStage(d, y0, e, true); kids.push(c); const k = new Kit(d), y = c.userData.top, p = PR.fairing(PR.ULX.f4.r, FAIR4[o.fairing || 'm'], PR.ULX.f4.nose, y, CR, k.hi ? 20 : 8, 1.3);
    lathe(k, p, 'paint:0,0'); if (k.hi) for (const ph of [0, PI]) lathe(k, p.slice(1), 'dark', { s: 1.003, seg: 1, p0: ph - 0.004, pl: 0.008 }); const pay = k.build('payload'); kids.push(pay); top = p.at(-1)[1]; }
  else { const c = upperStage(d, y0, e, false); kids.push(c); const k = new Kit(d), L = FAIR5[o.fairing || 's'], p = PR.fairing(PR.ULX.f5.r, L, PR.ULX.f5.nose, y0, AR, k.hi ? 20 : 8, 0.5); // 5 m fairing encloses the upper stage
    lathe(k, p, 'paint:0,0'); tube(k, PR.ULX.f5.r * 1.005, PR.ULX.f5.r * 1.005, 0.4, y0 + 2.2, 'grey', { open: true }); if (k.hi) for (const ph of [0, PI]) lathe(k, p.slice(1), 'dark', { s: 1.003, seg: 1, p0: ph - 0.004, pl: 0.008 });
    decal(k, 'fairing.side', PR.ULX.f5.r, y0 + 8, 3, PI / 2, 0.9); const pay = k.build('payload'); kids.push(pay); top = p.at(-1)[1]; }
  const g = group('atlantean-v-' + cfg + (o.fairing ? '-' + o.fairing : ''), kids, top);
  if (o.plume) { g.add(plume(0, [[0, 0]], 1.6, 50 * o.plume)); const ang = [PI * 0.5, PI * 1.5, PI * 0.15, PI * 1.85, PI * 1.0]; if (s) g.add(plume(0, ang.slice(0, s).map(a => [Math.cos(a) * (AR + 0.85), Math.sin(a) * (AR + 0.85)]), 1.0, 45 * o.plume)); }
  return g; }
// ---- Deltoid IV ----
const DR = 2.55, CBC = 40.8;
function cbc(d, name, x, nose) { const k = new Kit(d); k.push(xf([x, 0, 0]));
  bell(k, 1.22, 3.6, 0, 0, 0, { head: 0.9, rt: 0.4 }); // single big hydrogen engine (ablative bell)
  tube(k, DR, DR, 1.6, 3.0, 'dark'); tube(k, DR, DR, CBC - 4.6, 4.6, 'x-foam', { hs: 1 }); ring(k, DR, CBC * 0.6, 0.03, 'x-foam2');
  if (nose) lathe(k, PR.ogive(DR, 5.0, CBC, k.hi ? 18 : 7, 0.1), 'x-foam'); else tube(k, DR, DR, 0.4, CBC, 'x-foam2');
  k.add(new THREE.BoxGeometry(0.4, CBC - 7, 0.45), 'x-foam2', xf([0, CBC / 2, DR + 0.18]));
  k.pop(); const g = swap(k.build(name), { bell: 'x-bellchar' }); return g; }
function dcss(d, y0, five) { const k = new Kit(d), r = five ? DR : 2.0, h = five ? 13.7 : 12.2;
  tube(k, DR, five ? DR : 2.0, 3.0, y0, 'x-foam2'); // interstage (4 m: tapers in)
  bell(k, 1.05, 3.4, 0, y0 + 0.2, 0, { ext: true, head: 0.4, rt: 0.15 }); tube(k, r, r, h - 3, y0 + 3, 'paint:0,0');
  const g = swap(k.build('dcss'), {}); g.userData.top = y0 + h; g.userData.r = r; return g; }
function dlt(o, cfg) { const d = o.detail, heavy = cfg === 'heavy', five = heavy || /^5/.test(cfg), ns = cfg === '52' ? 2 : cfg === '54' ? 4 : cfg === '42' ? 2 : 0;
  const kids = [cbc(d, 'cbc', 0, false)]; if (heavy) kids.push(cbc(d, 'side0', -2 * DR - 0.15, true), cbc(d, 'side1', 2 * DR + 0.15, true));
  kids.push(...solids(d, ns, 0.775, 16.2, DR + 0.8, 'srb')); const u = dcss(d, CBC, five); kids.push(u);
  const k = new Kit(d), fr = five ? PR.ULX.d5.r : 2.1, p = five ? PR.fairing(fr, heavy ? 12.5 : 7.7, PR.ULX.d5.nose, u.userData.top, u.userData.r, k.hi ? 20 : 8, 0.1) : PR.fairing(2.1, 5.5, 5.4, u.userData.top, 2.0, k.hi ? 20 : 8, 0.4);
  lathe(k, p, 'paint:0,0'); if (k.hi) for (const ph of [0, PI]) lathe(k, p.slice(1), 'dark', { s: 1.003, seg: 1, p0: ph - 0.004, pl: 0.008 }); decal(k, 'fairing.side', fr, u.userData.top + 3, 3, PI / 2, 0.9);
  kids.push(k.build('payload')); const top = p.at(-1)[1], g = group('deltoid-4-' + cfg, kids, top);
  if (o.plume) g.add(plume(0, heavy ? [[0, 0], [-2 * DR - 0.15, 0], [2 * DR + 0.15, 0]] : [[0, 0]], 2.2, 45 * o.plume)); return g; }
// fairing options (barrel length, m). 4 m class: s/m/l = 12.0 / 12.9 / 13.8 m overall; 5 m class: s/m/l = 20.7 / 23.4 / 26.5 m published lengths
export const FAIR4 = { s: 5.1, m: 6.0, l: 6.9 }, FAIR5 = { s: 19.8, m: 22.5, l: 25.6 };
const ATL = ['401', '411', '421', '431', '501', '511', '521', '531', '541', '551'];
const ATL_H = { 4: 58.6, 5: 62.2 };
const OPT = [['401', 'l'], ['501', 'm'], ['551', 'l'], ['541', 'm']]; // flown long/medium-fairing examples (default: 4 m 'm', 5 m 's')
export const CO_ULX = {
  ...Object.fromEntries(OPT.map(([c, f]) => [`atlantean-v-${c}-${f}`, { height: (c[0] === '4' ? 58.6 + FAIR4[f] - FAIR4.m : 62.2 + FAIR5[f] - FAIR5.s), build: o => atl({ ...o, fairing: f }, c), src: `config ${c}, fairing option ${f}`, est: ['fairing length'] }])),
  ...Object.fromEntries(ATL.map(c => ['atlantean-v-' + c, { height: ATL_H[c[0]], build: o => atl(o, c), src: `rocketdb atlantean-v (GCAT) config ${c}: fairing ${c[0]} m class, ${c[1]} solids, ${c[2]} upper engine(s)`, est: ['fairing length'] }])),
  'deltoid-4-m': { height: 63, build: o => dlt(o, 'm'), src: 'rocketdb deltoid-4 Medium (GCAT): 4 m upper + fairing', est: ['fairing length'] },
  'deltoid-4-m42': { height: 63, build: o => dlt(o, '42'), src: 'rocketdb deltoid-4 Medium+ (4,2)', est: ['fairing length'] },
  'deltoid-4-m52': { height: 67, build: o => dlt(o, '52'), src: 'rocketdb deltoid-4 Medium+ (5,2)', est: ['fairing length'] },
  'deltoid-4-m54': { height: 67, build: o => dlt(o, '54'), src: 'rocketdb deltoid-4 Medium+ (5,4)', est: ['fairing length'] },
  'deltoid-4-heavy': { height: 72, build: o => dlt(o, 'heavy'), src: 'rocketdb deltoid-4 Heavy (GCAT): 3 x 5.1 m cores, 72 m', est: ['fairing length'] },
};
export const ULX_IDS = Object.keys(CO_ULX);

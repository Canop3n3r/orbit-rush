// co-bluehz-1: Blue Horizon (parody private launch company) — New Glen-Dale: tall 7 m stack, reusable first stage with 7 engines
// (6 ring + centre), two lifting strakes, 4 aft fins and 6 landing legs; 2-engine hydrogen upper; 7 m clamshell fairing.
// White with a pale-blue wave band. Dimensions: rocketdb new-glendale (GCAT) + design.md; splits art-fitted. No logos/names.
import * as THREE from 'three/webgpu';
import { Kit, xf, weakDisposeListeners } from './kit.js?v=f5.8z';
import * as PR from './profiles.js?v=f5.8z';
import { lathe, tube, bell, ringPos, ring, decal, legs, setLegs } from './parts.js?v=f5.8z';
import { group, plume } from './co_civspace.js?v=f5.8z';
const PI = Math.PI, R = 3.5, HI = k => k.detail === 'hi';
const LM = new Map();
function lm(key) { if (LM.has(key)) return LM.get(key); const m = new THREE.MeshStandardMaterial({ color: 0x3c86d8, roughness: 0.35, emissive: 0x0b2440 }); m.name = key; m.userData.cached = true; weakDisposeListeners(m); LM.set(key, m); return m; }
function kb(k, name) { const g = k.build(name); for (const m of g.children) if (m.name.endsWith(':x-wave')) m.material = lm('x-wave'); return g; }
function s1(d, o) { const k = new Kit(d), y0 = 2.6, h = 57.5 - 2.6;
  for (const [x, z] of ringPos([[6, 2.3, 0], [1, 0]])) bell(k, 0.72, 2.4, x, 0.1, z, { head: 0.5, rt: 0.26 });
  lathe(k, [[0, y0], [R * 0.85, y0], [R, y0 + 0.8]], 'dark'); tube(k, R, R, h - 0.8, y0 + 0.8, 'paint:0,0', { hs: 1 });
  for (const [y, hh] of [[y0 + 4.5, 6.0], [y0 + 11.5, 1.2]]) tube(k, R * 1.004, R * 1.004, hh, y, 'x-wave', { open: true, seg: k.hi ? 40 : 14 }); // wave band + pinstripe, above the fins
  if (k.hi) { ring(k, R, y0 + h * 0.45, 0.02); tube(k, R * 1.004, R * 1.004, 2.6, y0 + h - 2.6, 'dark', { open: true, seg: HI(k) ? 40 : 14 }); } // dark interstage
  for (let i = 0; i < 4; i++) { const a = PI / 4 + i * PI / 2; k.add(new THREE.BoxGeometry(2.2, 3.4, 0.3), 'dark', xf([Math.cos(a) * (R + 1.0), y0 + 2.0, Math.sin(a) * (R + 1.0)], [0, -a, 0])); } // aft fins
  for (const a of [0, PI]) k.add(new THREE.BoxGeometry(0.9, 12, 0.3), 'dark', xf([Math.cos(a) * (R + 0.4), y0 + h - 9, Math.sin(a) * (R + 0.4)], [0, -a, 0])); // strakes
  decal(k, 'booster.side', R, y0 + h * 0.6, 7, PI / 2, 0.5);
  const g = kb(k, 's1'); const L = legs(Kit, d, R * 0.95, 7.5, y0 + 2.2, 6, PI / 6); setLegs(L, o.legs ?? 0); g.add(L); g.userData.legs = L; g.userData.top = y0 + h; return g; }
function s2(d, y0) { const k = new Kit(d), h = 23.4; for (const [x, z] of ringPos([[2, 1.2]])) bell(k, 0.75, 2.2, x, y0 + 0.2, z, { ext: true, head: 0.35, rt: 0.2 });
  tube(k, R, R, h, y0, 'paint:0,0'); if (k.hi) ring(k, R, y0 + h * 0.6, 0.02); const g = kb(k, 's2'); g.userData.top = y0 + h; return g; }
function fairing(d, y0) { const k = new Kit(d), p = PR.fairing(R, 7.0, 10.0, y0, R * 0.999, k.hi ? 20 : 8, 0.05); lathe(k, p, 'paint:0,0');
  if (k.hi) for (const ph of [0, PI]) lathe(k, p.slice(1), 'dark', { s: 1.003, seg: 1, p0: ph - 0.004, pl: 0.008 }); decal(k, 'fairing.side', R, y0 + 3.5, 4, PI / 2, 0.8);
  const g = kb(k, 'payload'); g.userData.top = p.at(-1)[1]; return g; }
function ngd(o) { const d = o.detail, a = s1(d, o), b = s2(d, a.userData.top), f = fairing(d, b.userData.top);
  const g = group('new-glendale', [a, b, f], f.userData.top); g.userData.legs = [a.userData.legs]; if (o.plume) g.add(plume(0, ringPos([[6, 2.3, 0], [1, 0]]), 1.1, 70 * o.plume)); return g; }
export const CO_BLUEHZ = {
  'new-glendale': { height: 98.0, build: ngd, src: 'rocketdb new-glendale (GCAT 7x2): s1 57.5 x 7 m (7 engines), s2 23.4 m (2 engines), 7 m fairing', est: ['fairing length', 'leg/fin geometry'] },
};

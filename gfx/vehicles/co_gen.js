// co_gen.js: compact shared builders for the tier-A company files (each stage = one direct child group, named; top in userData.top)
import * as THREE from 'three/webgpu';
import { Kit, xf, weakDisposeListeners } from './kit.js?v=art1';
import * as PR from './profiles.js?v=art1';
import { lathe, tube, bell, ringPos, ring, decal, strut } from './parts.js?v=art1';
export const PI = Math.PI, isHi = k => k.detail === 'hi';
const LM = new Map(); // livery colours: cached, weak dispose listeners (flat heap)
export function livery(hex) { const key = 'x-c' + hex.toString(16); if (!LM.has(key)) { const m = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.55 }); m.name = key; m.userData.cached = true; weakDisposeListeners(m); LM.set(key, m); } return key; }
export function kb(k, name, top) { const g = k.build(name); for (const m of g.children) { const key = m.name.split(':').slice(1).join(':'); if (LM.has(key)) m.material = LM.get(key); } g.userData.top = top; return g; }
export const band = (k, r, y, h, key = 'dark', o = {}) => (o.lo || k.hi) && tube(k, r * 1.005, r * 1.005, h, y, key, { open: true, seg: isHi(k) ? 40 : 14 });
export const quads = (k, r, y, h) => { for (let i = 0; i < 2; i++) tube(k, r * 1.006, r * 1.006, h, y, 'dark', { open: true, t0: i * PI, tl: PI / 2, seg: k.hi ? 10 : 4 }); };
export function fin(k, a, r, w, h, y, t = 0.08, key = 'dark') { const s = new THREE.Shape([[r, 0], [r + w, 0], [r + w, h * 0.35], [r, h]].map(([x, z]) => new THREE.Vector2(x, z)));
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false }); g.translate(0, 0, -t / 2); k.add(g, key, xf([0, y, 0], [0, a, 0])); }
// generic stage: cylinder r x h from y0, engines [[n, ringR, re, L, a0]] hanging below y0 (+ drop), body key, optional bands [[y, h, key]]
export function stage(d, name, { r, h, y0, eng = [], drop = 0, key = 'paint:0,0', bands = [], r1, skirt, ext, quad, decalY, extra } = {}) { const k = new Kit(d);
  for (const [n, rr, re, L, a0 = 0] of eng) for (const [x, z] of ringPos([[n, rr, a0]])) bell(k, re, L, x, y0 - (drop || L), z, { ext, head: L * 0.25, rt: re * 0.36 }); // drop 0: bells hang below the tank (exit at y0 - L)
  if (skirt) tube(k, skirt, r, Math.min(1.5, h * 0.1), y0, 'dark'); tube(k, r, r1 ?? r, h, y0, key, { hs: 1 });
  for (const [y, bh, bk = 'dark'] of bands) band(k, r, y0 + y, bh, bk); if (quad) quads(k, r, y0 + quad[0], quad[1]); if (decalY) decal(k, 'booster.side', r, y0 + decalY, Math.min(5, h * 0.3), PI / 2, 0.6);
  if (extra) extra(k); return kb(k, name, y0 + h); }
export function fairing(d, name, { r, rb, cyl, nose, y0, key = 'paint:0,0' }) { const k = new Kit(d), p = PR.fairing(r, cyl, nose, y0, rb * 0.999, k.hi ? 18 : 8, r > rb ? 1.0 : 0.05);
  lathe(k, p, key); if (isHi(k)) for (const ph of [0, PI]) lathe(k, p.slice(1), 'dark', { s: 1.003, seg: 1, p0: ph - 0.004, pl: 0.008 }); decal(k, 'fairing.side', r, y0 + cyl * 0.5 + 1, 2.5, PI / 2, 0.8); return kb(k, name, p.at(-1)[1]); }
export function nose(d, name, { r, L, y0, key = 'paint:0,0', tip = 0.06, base = 0 }) { const k = new Kit(d); if (base) tube(k, r, r, base, y0, 'dark'); lathe(k, PR.ogive(r, L, y0 + base, k.hi ? 14 : 6, tip), key); return kb(k, name, y0 + base + L); }
// solid rocket motor strap-on, group origin on its own axis at (x, z)
export function srm(d, name, { r, L, nL, x, z, key = 'paint:0,0', bands = [0.3, 0.6], coreR = 0 }) { const k = new Kit(d), a = Math.atan2(z, x); bell(k, r * 0.6, r * 1.2, 0, 0, 0, { head: 0, rt: r * 0.3 });
  tube(k, r * 1.05, r, r * 0.9, r * 1.0, 'dark'); tube(k, r, r, L - nL - r * 1.9, r * 1.9, key); if (k.hi) for (const f of bands) ring(k, r, r * 1.9 + (L - nL - r * 1.9) * f, 0.02);
  lathe(k, PR.ogive(r, nL, L - nL, k.hi ? 12 : 5, 0.1), key); if (isHi(k) && coreR) for (const y of [r * 3, L - nL - 1]) strut(k, [-r * 0.9, y, 0], [-(Math.hypot(x, z) - coreR) - r + 0.1, y, 0], 0.1, 'dark');
  const g = kb(k, name, L); g.position.set(x, 0.4, z); g.rotation.y = -a; return g; }
// small crew capsule (cone + nose can) and escape tower
export function capsule(d, name, { r, h, y0, key = 'dark', can = 0.4 }) { const k = new Kit(d); tube(k, r, r, 0.15, y0, 'dark'); tube(k, r, r * 0.42, h, y0 + 0.15, key); tube(k, r * 0.4, r * 0.4, can, y0 + 0.15 + h, key); return kb(k, name, y0 + 0.15 + h + can); }
export function tower(d, name, { y0, w = 0.3, h = 3, rocket = 0.14, key = 'x' }) { const k = new Kit(d); for (const [x, z] of ringPos([[3, w, 0]])) tube(k, 0.04, 0.04, h, y0, key === 'x' ? 'dark' : key, { x, z, seg: 4 });
  tube(k, rocket, rocket, rocket * 9, y0 + h, 'paint:0,0', { seg: k.hi ? 12 : 6 }); lathe(k, PR.ogive(rocket, rocket * 3.5, y0 + h + rocket * 9, 6, 0.02), 'dark', { seg: k.hi ? 12 : 6 }); return kb(k, name, y0 + h + rocket * 12.5); }
export { Kit, xf, PR, lathe, tube, bell, ringPos, ring, decal, strut };

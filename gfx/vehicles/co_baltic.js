// co-baltic-1: Baltic Test Range (parody, historic) — Baltic Hammer: 14 m single-stage liquid rocket, fat ogive body with boat tail, four big
// trapezoid fins, single engine, nose payload; classic black/white roll-quadrant test paint (generic, no insignia). Baltic Hammer Tandem:
// shortened nose carrying a slim finned second stage. Dimensions: rocketdb baltic-hammer (GCAT) + design.md; art-fitted. No logos/names.
import * as THREE from 'three/webgpu';
import { Kit, xf } from './kit.js?v=f5.9-11';
import * as PR from './profiles.js?v=f5.9-11';
import { lathe, tube, bell, ringPos, decal } from './parts.js?v=f5.9-11';
import { group, plume } from './co_civspace.js?v=f5.9-11';
const PI = Math.PI, R = 0.825, BODY = [[0, 0.35], [0.56, 0.35], [0.7, 1.2], [0.8, 2.6], [R, 3.6], [R, 6.6], [0.79, 8.0], [0.72, 9.4]];
function quads(k, y, h, r) { for (let i = 0; i < 2; i++) tube(k, r * 1.006, r * 1.006, h, y, 'dark', { open: true, t0: i * PI, tl: PI / 2, seg: k.hi ? 10 : 4 }); }
function fin(k, a) { const s = new THREE.Shape([[0.55, 0], [1.78, -0.05], [1.78, 0.55], [0.78, 3.4]].map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: false }); g.translate(0, 0, -0.035); k.add(g, 'dark', xf([0, 0.3, 0], [0, a, 0])); }
function body(d) { const k = new Kit(d); bell(k, 0.36, 0.9, 0, 0, 0, { head: 0.3, rt: 0.14 });
  lathe(k, BODY, 'paint:0,0', { seg: k.hi ? 32 : 12 }); quads(k, 3.6, 3.0, R); if (k.hi) quads(k, 1.4, 1.0, 0.75);
  for (let i = 0; i < 4; i++) fin(k, i * PI / 2);
  tube(k, 0.72, 0.42, 1.6, 9.4, 'paint:0,0');
  decal(k, 'booster.side', R, 5.0, 1.5, PI / 4, 0.7); const g = k.build('body'); g.userData.top = 11.0; return g; }
function warhead(d) { const k = new Kit(d); lathe(k, PR.ogive(0.72, 2.2, 11.8, k.hi ? 14 : 6, 0.05), 'paint:0,0'); tube(k, 0.72, 0.72, 0.8, 11.0, 'dark');
  const g = k.build('payload'); g.userData.top = 14.0; return g; }
function upper(d, y0) { const k = new Kit(d), r = 0.15; tube(k, 0.42, r, 0.4, y0, 'grey'); bell(k, 0.08, 0.25, 0, y0 + 0.35, 0, { head: 0.05 });
  tube(k, r, r, 4.3, y0 + 0.4, 'paint:0,0', { seg: k.hi ? 12 : 6 }); lathe(k, PR.ogive(r, 0.8, y0 + 4.7, 8, 0.02), 'paint:0,0', { seg: k.hi ? 12 : 6 });
  for (let i = 0; i < 3; i++) { const s = new THREE.Shape([[r, 0], [0.42, 0], [0.42, 0.25], [r, 0.7]].map(([x, y]) => new THREE.Vector2(x, y))), g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false }); k.add(g, 'dark', xf([0, y0 + 0.4, 0], [0, i * 2 * PI / 3, 0])); }
  const g = k.build('upper'); g.userData.top = y0 + 5.5; return g; }
function hammer(o, tandem) { const d = o.detail, b = body(d), top = tandem ? upper(d, b.userData.top) : warhead(d);
  const g = group(tandem ? 'baltic-hammer-tandem' : 'baltic-hammer', [b, top], top.userData.top); if (o.plume) g.add(plume(0, [[0, 0]], 0.35, 9 * o.plume)); return g; }
export const CO_BALTIC = {
  'baltic-hammer': { height: 14.0, build: o => hammer(o, false), src: 'rocketdb baltic-hammer (GCAT): 14 m x 1.65 m, fin span 3.56 m, single engine', est: ['body profile', 'fin planform'] },
  'baltic-hammer-tandem': { height: 16.5, build: o => hammer(o, true), src: 'rocketdb baltic-hammer tandem config: shortened nose + slim 5.5 m finned upper', est: ['upper length'] },
};

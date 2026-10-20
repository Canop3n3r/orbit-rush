// co-nosa-2: NOSA heritage, tier A — Redrock (1.78 m finned single stage; warhead nose, or crew capsule + escape tower), JunoIsh I
// (Redrock body + spinning cluster tub + pencil probe) and Saturnine I / IB (8-tank clustered first stage with 8 engines and fins;
// 6-engine 5.5 m upper (I) or single-engine 6.6 m upper (IB); capsule stack with tower). rocketdb redrock / junoish-1 / saturnine-1.
import * as THREE from 'three/webgpu';
import { Kit, xf, weakDisposeListeners } from './kit.js?v=art1';
import * as PR from './profiles.js?v=art1';
import { lathe, tube, bell, ringPos, ring, decal } from './parts.js?v=art1';
import { group, plume } from './co_nosa.js?v=art1';
const PI = Math.PI, HI = k => k.detail === 'hi';
const quads = (k, r, y, h) => { for (let i = 0; i < 2; i++) tube(k, r * 1.006, r * 1.006, h, y, 'dark', { open: true, t0: i * PI, tl: PI / 2, seg: k.hi ? 10 : 4 }); };
function fin(k, a, r, w, h, y, t = 0.06) { const s = new THREE.Shape([[r, 0], [r + w, 0], [r + w, h * 0.35], [r, h]].map(([x, z]) => new THREE.Vector2(x, z)));
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false }); g.translate(0, 0, -t / 2); k.add(g, 'dark', xf([0, y, 0], [0, a, 0])); }
// ---- Redrock body: 1.78 m, aft unit with 4 small fins + graphite-vane bell, tank section, instrument band
const RR = 0.89;
function redBooster(d) { const k = new Kit(d); bell(k, 0.45, 1.0, 0, 0, 0, { head: 0.3, rt: 0.17 });
  tube(k, RR, RR, 17.0, 0.4, 'paint:0,0'); quads(k, RR, 1.0, 2.4); ring(k, RR, 3.6, 0.02); ring(k, RR, 15.6, 0.02); if (HI(k)) quads(k, RR, 12.0, 1.6);
  for (let i = 0; i < 4; i++) fin(k, PI / 4 + i * PI / 2, RR, 0.75, 1.9, 0.3);
  decal(k, 'booster.side', RR, 8.0, 3, PI / 2, 0.7); const g = k.build('booster'); g.userData.top = 17.4; return g; }
function warhead(d, y0) { const k = new Kit(d); tube(k, RR, RR, 0.8, y0, 'dark'); lathe(k, PR.ogive(RR, 2.9, y0 + 0.8, k.hi ? 14 : 6, 0.06), 'paint:0,0');
  const g = k.build('payload'); g.userData.top = y0 + 3.7; return g; }
function crewStack(d, y0) { const a = new Kit(d); tube(a, RR, 0.95, 1.6, y0, 'paint:0,0'); if (HI(a)) ring(a, 0.95, y0 + 1.5, 0.015); const ad = a.build('adapter'); ad.userData.top = y0 + 1.6;
  const c = new Kit(d), y1 = y0 + 1.6; tube(c, 0.95, 0.95, 0.15, y1, 'dark'); tube(c, 0.95, 0.38, 2.1, y1 + 0.15, 'dark'); tube(c, 0.38, 0.38, 0.65, y1 + 2.25, 'dark'); // shingled cone + recovery can
  const cap = c.build('capsule'); cap.userData.top = y1 + 2.9;
  const l = new Kit(d), y2 = y1 + 2.9; for (const [x, z] of ringPos([[3, 0.32, 0]])) tube(l, 0.04, 0.04, 2.2, y2, 'x-tower', { x, z, seg: 4 });
  tube(l, 0.14, 0.14, 1.2, y2 + 2.2, 'paint:0,0', { seg: l.hi ? 12 : 6 }); lathe(l, PR.ogive(0.14, 0.5, y2 + 3.4, 6, 0.02), 'paint:0,0', { seg: l.hi ? 12 : 6 });
  const les = l.build('les'); les.userData.top = y2 + 3.9; for (const m of les.children) if (m.name.endsWith(':x-tower')) m.material = lmatRed(); return [ad, cap, les]; }
let RED; function lmatRed() { if (!RED) { RED = new THREE.MeshStandardMaterial({ color: 0xb03a2e, roughness: 0.6 }); RED.name = 'x-tower'; RED.userData.cached = true; weakDisposeListeners(RED); } return RED; }
function redrock(o, crew) { const d = o.detail, b = redBooster(d), top = crew ? crewStack(d, b.userData.top) : [warhead(d, b.userData.top)];
  const g = group(crew ? 'redrock-crew' : 'redrock', [b, ...top], top.at(-1).userData.top); if (o.plume) g.add(plume(0, [[0, 0]], 0.42, 14 * o.plume)); return g; }
function spinTub(o) { const d = o.detail, b = redBooster(d), y0 = b.userData.top;
  const t = new Kit(d); tube(t, RR, 0.62, 1.0, y0, 'paint:0,0'); tube(t, 0.6, 0.6, 1.25, y0 + 1.0, 'grey'); // spinning tub of small solids
  if (t.hi) for (const [x, z] of ringPos([[11, 0.47, 0]])) tube(t, 0.07, 0.07, 1.3, y0 + 1.0, 'dark', { x, z, seg: 6 });
  const tub = t.build('tub'); tub.userData.top = y0 + 2.25;
  const p = new Kit(d), y1 = y0 + 2.25; tube(p, 0.08, 0.08, 1.3, y1, 'dark', { seg: p.hi ? 10 : 6 }); tube(p, 0.08, 0.08, 0.2, y1 + 0.5, 'grey', { seg: 10 }); lathe(p, PR.ogive(0.08, 0.25, y1 + 1.3, 6, 0.01), 'dark', { seg: p.hi ? 10 : 6 });
  const pay = p.build('payload'); pay.userData.top = y1 + 1.55; const g = group('junoish-1', [b, tub, pay], pay.userData.top); if (o.plume) g.add(plume(0, [[0, 0]], 0.42, 14 * o.plume)); return g; }
// ---- Saturnine I / IB first stage: 2.67 m centre tank + 8 x 1.78 m outer tanks (alternating livery), 8 engines, 8 fins (IB) / 4 (I)
const SC = 1.335, SO = 0.89, SOFF = 2.22, SR = 3.25;
function sib(d, nf) { const k = new Kit(d), y0 = 2.6, h = 22.6;
  for (const [x, z] of ringPos([[4, 0.75, PI / 4], [4, 2.2, 0]])) bell(k, 0.55, 1.9, x, 0.4, z, { head: 0.4, rt: 0.2 });
  tube(k, SR * 1.04, SR, 1.6, y0 - 0.6, 'dark'); tube(k, SC, SC, h, y0, 'paint:0,0', { seg: k.hi ? 24 : 10 });
  ringPos([[8, SOFF, PI / 8]]).forEach(([x, z], i) => { tube(k, SO, SO, h - 1.0, y0 + 0.5, i % 2 ? 'paint:0,0' : 'dark', { x, z, seg: k.hi ? 18 : 8 }); lathe(k, PR.ogive(SO, 0.7, y0 + h - 0.5, 4, 0.5), 'paint:0,0', { m: xf([x, 0, z]), seg: k.hi ? 18 : 8 }); });
  tube(k, SR, SR, 1.4, y0 + h, 'paint:0,0'); quads(k, SR, y0 + h + 0.2, 1.0); // spider-beam band
  for (let i = 0; i < nf; i++) fin(k, PI / nf + i * 2 * PI / nf, SR - 0.1, 1.4, 3.0, 0.4, 0.12);
  decal(k, 'booster.side', SR, y0 + h + 0.7, 1.2, PI / 2, 0.8); const g = k.build('stage1'); g.userData.top = y0 + h + 1.4; return g; }
function s4(d, y0, ib) { const k = new Kit(d), r = ib ? 3.3 : 2.75, h = ib ? 17.8 : 12.2; tube(k, SR, r, ib ? 5.5 : 2.4, y0, 'paint:0,0');
  if (ib) bell(k, 1.0, 2.6, 0, y0 + 0.4, 0, { ext: true, head: 0.6, rt: 0.3 }); else for (const [x, z] of ringPos([[6, 1.25, 0]])) bell(k, 0.5, 1.4, x, y0 + 0.3, z, { ext: true, head: 0.3 });
  tube(k, r, r, h - (ib ? 5.5 : 2.4), y0 + (ib ? 5.5 : 2.4), 'paint:0,0'); if (ib) quads(k, r, y0 + 6.5, 2.0); ring(k, r, y0 + h - 0.5, 0.02);
  const g = k.build('stage2'); g.userData.top = y0 + h; return g; }
function crew(d, y0, rTop) { const a = new Kit(d); tube(a, rTop, rTop, 0.9, y0, 'dark'); tube(a, rTop, 1.95, 8.5, y0 + 0.9, 'paint:0,0'); const ad = a.build('adapter'); ad.userData.top = y0 + 9.4;
  const s = new Kit(d), y1 = y0 + 9.4; tube(s, 1.95, 1.95, 4.0, y1, 'silver'); if (s.detail === 'hi') bell(s, 0.5, 1.2, 0, y1 - 0.9, 0, { ext: true, head: 0.1 });
  const sm = s.build('service'); sm.userData.top = y1 + 4.0;
  const c = new Kit(d), y2 = y1 + 4.0; lathe(c, [[0, y2], [1.95, y2], [1.95, y2 + 0.2], [0.42, y2 + 3.1], [0, y2 + 3.3]], 'silver'); const cm = c.build('capsule'); cm.userData.top = y2 + 3.3;
  const l = new Kit(d), y3 = y2 + 3.1; for (const [x, z] of ringPos([[4, 0.55, PI / 4]])) tube(l, 0.05, 0.05, 3.0, y3, 'dark', { x, z, seg: 4 });
  tube(l, 0.33, 0.33, 2.6, y3 + 3.0, 'paint:0,0', { seg: l.hi ? 14 : 6 }); lathe(l, PR.escapeNose(0.33, 1.4, y3 + 5.6), 'dark', { seg: l.hi ? 14 : 6 });
  const les = l.build('les'); les.userData.top = y3 + 7.0; return [ad, sm, cm, les]; }
function sat1(o, ib) { const d = o.detail, a = sib(d, ib ? 8 : 4), b = s4(d, a.userData.top, ib), top = crew(d, b.userData.top, ib ? 3.3 : 2.75);
  const g = group(ib ? 'saturnine-1b' : 'saturnine-1', [a, b, ...top], top.at(-1).userData.top); if (o.plume) g.add(plume(0, ringPos([[4, 0.75, PI / 4], [4, 2.2, 0]]), 0.9, 50 * o.plume)); return g; }
export const CO_NOSA2 = {
  'redrock': { height: 21.1, build: o => redrock(o, false), src: 'rocketdb redrock (GCAT): 1.78 m body 17.4 m + nose', est: ['nose length'] },
  'redrock-crew': { height: 25.8, build: o => redrock(o, true), src: 'rocketdb redrock crew config: adapter + 1.9 m capsule + escape tower', est: ['tower geometry'] },
  'junoish-1': { height: 21.2, build: spinTub, src: 'rocketdb junoish-1 (GCAT): body + 11-motor spin tub + pencil probe', est: ['tub size'] },
  'saturnine-1': { height: 62.3, build: o => sat1(o, false), src: 'rocketdb saturnine-1 (I, block II): 8-tank first stage 4 fins, 6-engine 5.5 m upper, boilerplate crew stack', est: ['crew stack'] },
  'saturnine-1b': { height: 67.9, build: o => sat1(o, true), src: 'rocketdb saturnine-1 (IB): 8 fins, single-engine 6.6 m upper, crew stack + tower', est: ['adapter length'] },
};

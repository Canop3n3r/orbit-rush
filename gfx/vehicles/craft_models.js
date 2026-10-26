// Craft models (f6.2): the shapes of the craft a rocket can leave in space, one distinct silhouette per type. Procedural geometry on a few
// shared materials. Each is registered as a payload kind (so it rides under the fairing and is released as the same object) and
// buildCraftStages() gives the per-stage groups the flight uses (origin = bottom of the engine exit plane, +Y up, metres).
import * as THREE from 'three/webgpu';
import { registerPayload } from './payloads.js?v=f5.8y';
import { PLUME_TABLE } from '../../fun/plumetable.js?v=f5.8y';
import { typeOf, houseStyle } from '../../data/craft_types.js?v=f5.8y';
// an ion plume is a faint blue-white thread (added here so the shared plume table stays untouched)
if (!PLUME_TABLE.ion) PLUME_TABLE.ion = { plume: 0x7fd0ff, glow: 0x4aa8ff, core: 0xe4f6ff, bell: 0x6cc0ff, sprite: [1.6, 3.0, 6], k: 0.9, smoke: 0, soot: 0, dia: 0, trail: 'none', label: 'faint blue-white thread' };
if (!PLUME_TABLE.monoprop) PLUME_TABLE.monoprop = { ...PLUME_TABLE.hypergolic, k: 0.35, label: 'thin pale puff' };
export const PLUME_OF = { none: 'hydrolox', coldgas: 'hydrolox', monoprop: 'monoprop', hypergolic: 'hypergolic', hydrolox: 'hydrolox', landing: 'hypergolic', solid: 'solid', ion: 'ion' };
const MATS = new Map();
const mat = (c, o = {}) => { const k = c + ':' + (o.m ?? 0.5) + ':' + (o.r ?? 0.45) + ':' + (o.e || 0); let m = MATS.get(k); if (!m) { m = new THREE.MeshStandardMaterial({ color: c, metalness: o.m ?? 0.5, roughness: o.r ?? 0.45, emissive: o.e || 0x000000, side: o.d ? THREE.DoubleSide : THREE.FrontSide }); m.userData.cached = true; MATS.set(k, m); } return m; };
const C = { gold: 0xc9a043, goldD: 0x9d7b2c, white: 0xe3e5e8, silver: 0x9aa0a8, dark: 0x25272b, black: 0x0c0d0f, grey: 0x6d727a, blue: 0x1b3a86, cell: 0x264a9c, ablate: 0x3a2a22, red: 0xc2452d, glass: 0x10243f };
class B { // tiny group builder
  constructor(seg = 16) { this.g = new THREE.Group(); this.seg = seg; }
  add(geo, c, x = 0, y = 0, z = 0, o = {}) { const m = new THREE.Mesh(geo, mat(c, o)); m.position.set(x, y, z); if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz; this.g.add(m); return m; }
  cyl(rt, rb, h, c, x = 0, y = 0, z = 0, o = {}) { return this.add(new THREE.CylinderGeometry(rt, rb, h, o.seg || this.seg), c, x, y + h / 2, z, o); }  // y = bottom of the cylinder
  box(w, h, d, c, x = 0, y = 0, z = 0, o = {}) { return this.add(new THREE.BoxGeometry(w, h, d), c, x, y + h / 2, z, o); }
  dish(r, c, x, y, z, o = {}) { return this.add(new THREE.SphereGeometry(r, this.seg, 6, 0, Math.PI * 2, 0, 1.0), c, x, y, z, { rx: Math.PI, d: true, ...o }); }
  sph(r, c, x, y, z, o = {}) { return this.add(new THREE.SphereGeometry(r, this.seg, 10), c, x, y, z, o); }
  // a solar wing: n panels along +x (side s = ±1) at height y, each w by l, thin
  wing(s, x0, y, n, w, l, z = 0, c = C.blue) { for (let i = 0; i < n; i++) { const cx = s * (x0 + i * (w + 0.04) + w / 2); this.box(w, 0.03, l, i % 2 ? C.cell : c, cx, y, z); this.box(w * 0.94, 0.036, 0.03, C.dark, cx, y, z); } this.box(Math.abs(x0) + 0.01, 0.06, 0.06, C.silver, s * x0 / 2, y, z); }
  bell(r, h, c = C.dark, x = 0, y = 0, z = 0) { return this.cyl(r * 0.35, r, h, c, x, y, z, { m: 0.7, r: 0.35, d: true }); }
}
const T = { lo: d => (d === 'lo' ? 8 : d === 'mid' ? 12 : 18) };
export const BUILDERS = {
  cubesat(det) { const b = new B(T.lo(det)); b.box(0.1, 0.34, 0.1, C.gold, 0, 0, 0); b.box(0.102, 0.02, 0.102, C.dark, 0, 0.0, 0); for (const s of [-1, 1]) { b.box(0.22, 0.012, 0.09, C.blue, s * 0.17, 0.2, 0); b.box(0.22, 0.012, 0.09, C.cell, 0, 0.2 + s * 0.0, s * 0.17, { ry: Math.PI / 2 }); }
    b.cyl(0.004, 0.004, 0.18, C.silver, 0.04, 0.34, 0.04); b.box(0.03, 0.03, 0.01, C.dark, 0, 0.3, 0.052); return { group: b.g, h: 0.4, r: 0.12 }; },
  geosat(det) { const b = new B(T.lo(det)); b.cyl(0.55, 0.62, 0.3, C.silver, 0, 0, 0); for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) b.cyl(0.06, 0.1, 0.22, C.dark, x, -0.02, z, { m: 0.8 });
    b.box(1.5, 1.8, 1.5, C.white, 0, 0.3, 0); b.box(1.54, 0.14, 1.54, C.gold, 0, 0.3, 0); b.box(1.54, 0.14, 1.54, C.gold, 0, 1.96, 0);
    for (const s of [-1, 1]) { b.wing(s, 0.8, 1.2, 6, 1.1, 2.4, 0); b.box(0.2, 0.3, 0.3, C.dark, s * 0.85, 1.2, 0); }
    b.cyl(0.04, 0.04, 0.6, C.silver, 0, 2.1, 0.55, { seg: 6 }); b.dish(0.75, C.white, 0, 2.8, 0.55); b.cyl(0.03, 0.03, 0.4, C.grey, 0.5, 2.1, -0.4); return { group: b.g, h: 3.4, r: 1.0 }; },
  crew(det) { const p = crewParts(det); const g = new THREE.Group(); g.add(p.svc, p.cap); p.cap.position.y = p.svcH; return { group: g, h: p.svcH + p.capH, r: 1.25 }; },
  station(det) { const b = new B(T.lo(det)); b.cyl(1.4, 1.4, 6.2, C.white, 0, 0.7); b.cyl(1.42, 1.42, 0.3, C.gold, 0, 1.6); b.cyl(1.42, 1.42, 0.3, C.gold, 0, 5.0); b.cyl(0.5, 1.0, 0.7, C.grey, 0, 0); b.cyl(0.3, 0.5, 0.3, C.dark, 0, 6.9); b.cyl(0.6, 0.6, 0.2, C.silver, 0, 7.2);
    b.cyl(0.08, 0.08, 7, C.silver, 0, 0, 1.5, { rz: Math.PI / 2 }); // placeholder rotated below
    b.g.children.pop(); const tr = b.box(7.6, 0.18, 0.18, C.silver, 0, 3.6, 0); b.box(0.5, 0.6, 0.5, C.dark, 0, 3.4, 0);
    for (const s of [-1, 1]) { b.wing(s, 0.35, 3.6, 4, 1.8, 4.8, 0); b.box(0.12, 0.12, 1.4, C.silver, s * 3.8, 3.6, 0); }
    b.box(2.4, 0.08, 1.0, C.white, 0, 6.3, 2.0, { rx: -0.5 }); b.sph(0.55, C.glass, 0.9, 5.5, 0.95, { m: 0.2, r: 0.15 }); for (const a of [0, 1, 2, 3]) b.box(0.3, 0.3, 0.3, C.dark, Math.cos(a * 1.57) * 1.5, 2.5, Math.sin(a * 1.57) * 1.5); return { group: b.g, h: 7.4, r: 1.4 }; },
  lander(det) { const b = new B(T.lo(det)); b.bell(0.55, 0.9, C.dark, 0, 0.5); b.cyl(1.3, 1.5, 1.6, C.gold, 0, 1.0, 0, { seg: 8, m: 0.4 }); b.cyl(1.2, 1.3, 0.9, C.white, 0, 2.5, 0, { seg: 8 }); b.cyl(0.8, 1.2, 0.5, C.silver, 0, 3.3, 0, { seg: 8 });
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, ox = Math.cos(a), oz = Math.sin(a); const leg = b.cyl(0.07, 0.07, 2.6, C.silver, ox * 1.9, 0.9, oz * 1.9, { seg: 6 }); leg.rotation.set(oz * 0.5, 0, -ox * 0.5); leg.position.set(ox * 1.8, 1.4, oz * 1.8);
      b.cyl(0.55, 0.55, 0.08, C.grey, ox * 2.75, 0, oz * 2.75, { seg: 10 }); b.box(0.05, 1.6, 0.05, C.dark, ox * 1.35, 0.9, oz * 1.35).rotation.set(oz * 0.7, 0, -ox * 0.7); }
    b.box(0.5, 0.5, 0.5, C.dark, 0, 3.5, 1.1); b.cyl(0.03, 0.03, 0.9, C.silver, -0.4, 3.8, -0.3); b.dish(0.4, C.white, -0.4, 4.7, -0.3); b.box(0.9, 0.7, 0.2, C.glass, 0, 2.6, 1.28, { m: 0.2 }); return { group: b.g, h: 4.4, r: 1.5 }; },
  tug(det) { const b = new B(T.lo(det)); b.bell(0.75, 1.4, C.dark, 0, 0); b.cyl(1.15, 1.15, 0.4, C.dark, 0, 1.3); b.sph(1.15, C.white, 0, 3.0, 0, { m: 0.3, r: 0.4 }); b.cyl(1.16, 1.16, 1.6, C.white, 0, 1.7, 0, { m: 0.25 }); b.cyl(1.17, 1.17, 0.25, C.red, 0, 2.2); b.sph(1.15, C.white, 0, 3.3, 0); b.cyl(0.9, 1.1, 0.4, C.silver, 0, 4.4); b.cyl(0.9, 0.9, 0.5, C.dark, 0, 4.8);
    for (const s of [-1, 1]) { b.wing(s, 0.9, 4.6, 2, 0.9, 1.1, 0); b.box(0.2, 0.2, 0.2, C.dark, s * 1.15, 4.3, 0); } b.cyl(0.35, 0.5, 0.4, C.gold, 0, 5.3); return { group: b.g, h: 5.8, r: 1.15 }; },
  kick(det) { const b = new B(T.lo(det)); b.bell(0.55, 1.0, C.dark, 0, 0); b.cyl(0.62, 0.62, 1.5, C.grey, 0, 0.7, 0, { m: 0.6, r: 0.35 }); b.sph(0.62, C.grey, 0, 2.2, 0, { m: 0.6 }); b.cyl(0.67, 0.67, 0.12, C.gold, 0, 1.0); b.cyl(0.67, 0.67, 0.08, C.dark, 0, 1.9);
    b.cyl(0.4, 0.5, 0.4, C.silver, 0, 2.6); for (const a of [0, 1, 2, 3]) b.box(0.12, 0.12, 0.12, C.white, Math.cos(a * 1.57) * 0.58, 0.9, Math.sin(a * 1.57) * 0.58); b.box(0.5, 0.5, 0.5, C.goldD, 0, 3.0); return { group: b.g, h: 3.5, r: 0.67 }; },
};
for (const k of Object.keys(BUILDERS)) registerPayload(k, BUILDERS[k]);

// the crew capsule on its service module (two groups so the service module can drop away)
function crewParts(det) {
  const lo = T.lo(det), sb = new B(lo), cb = new B(lo), svc = sb.g, cap = cb.g;
  sb.bell(0.5, 0.9, C.dark, 0, 0); sb.cyl(1.25, 1.25, 1.0, C.white, 0, 0.8, 0, { m: 0.3 }); sb.cyl(1.27, 1.27, 0.1, C.dark, 0, 1.0); sb.cyl(1.27, 1.27, 0.08, C.red, 0, 1.55);
  for (const s of [-1, 1]) sb.box(0.05, 1.2, 0.9, C.silver, s * 1.3, 0.9, 0); for (let i = 0; i < 4; i++) sb.box(0.22, 0.22, 0.22, C.dark, Math.cos(i * 1.57 + 0.7) * 1.28, 1.7, Math.sin(i * 1.57 + 0.7) * 1.28);
  const svcH = 1.8;
  cb.cyl(1.25, 1.25, 0.22, C.ablate, 0, 0, 0, { m: 0.1, r: 0.9 }); cb.cyl(0.55, 1.2, 1.7, C.white, 0, 0.22, 0, { m: 0.25 }); cb.cyl(0.4, 0.55, 0.3, C.silver, 0, 1.92); cb.cyl(0.32, 0.4, 0.35, C.gold, 0, 2.22);
  cb.box(0.5, 0.4, 0.04, C.glass, 0, 1.0, 0.8, { m: 0.2, rx: -0.45 }); for (let i = 0; i < 4; i++) cb.box(0.14, 0.14, 0.14, C.dark, Math.cos(i * 1.57) * 0.62, 1.7, Math.sin(i * 1.57) * 0.62);
  return { svc, cap, svcH, capH: 2.6 };
}
// a spent rocket stage built from its physics parts: white tank barrels, dark interstage, bell at the bottom
export function buildStageModel(veh, from = 0) {
  const b = new B(24); let y = 0, rMax = 0.5; const parts = veh.stages.slice(from).flatMap(s => s.parts).filter(p => p.kind !== 'fins' && p.kind !== 'fairing' && !(p.kind === 'pod' && p.id === 'avionics'));
  for (const p of parts) { const r = Math.max(0.2, p.d / 2); rMax = Math.max(rMax, r);
    if (p.kind === 'engine') { b.bell(r * 1.1, Math.max(0.6, p.h), C.dark, 0, y); }
    else if (p.kind === 'tank') { b.cyl(r, r, p.h, C.white, 0, y, 0, { m: 0.3 }); b.cyl(r * 1.01, r * 1.01, Math.min(0.5, p.h * 0.1), C.dark, 0, y + p.h * 0.45); }
    else if (p.kind === 'decoupler') b.cyl(r, r, p.h, C.dark, 0, y);
    else if (p.kind === 'shield') b.cyl(r, r, p.h, C.ablate, 0, y);
    else b.cyl(r * 0.9, r, Math.max(0.2, p.h), C.silver, 0, y); y += p.h; }
  b.cyl(rMax * 0.25, rMax * 0.9, 0.3, C.silver, 0, y); y += 0.3; return { group: b.g, h: y, r: rMax };
}
// per-stage groups for a craft vehicle: [{ group, h }] in flight order, with a bell and a livery stripe from the launching house
export function buildCraftStages(veh, buildPayload, detail = 'hi') {
  const c = veh.craft, T0 = typeOf(c.type), st = c.house ? houseStyle(c.house) : null;
  if (T0.special || c.type === 'stage') { const m = buildStageModel(veh, 0); return [{ group: m.group, h: m.h }]; }
  if (c.type === 'crew') { const p = crewParts(detail), L0 = veh.stages[0].parts.reduce((t, x) => t + x.h, 0), L1 = veh.stages[1].parts.reduce((t, x) => t + x.h, 0); p.svc.scale.setScalar(L0 / p.svcH); p.cap.scale.setScalar(L1 / p.capH);
    return [{ group: p.svc, h: L0 }, { group: p.cap, h: L1 }]; }
  const L = veh.stages[0].parts.reduce((t, x) => t + x.h, 0), D = Math.max(...veh.stages[0].parts.map(x => x.d)), body = buildPayload(T0.gfx, { detail, r: D / 2 * 1.25, h: L });
  const g = new THREE.Group(); g.add(body); body.position.y = 0;
  const eng = veh.stages[0].parts.find(p => p.kind === 'engine'); if (eng && !['cubesat', 'geosat', 'lander', 'tug', 'kick'].includes(c.type)) { const bell = new THREE.Mesh(new THREE.CylinderGeometry(eng.d * 0.18, eng.d * 0.5, eng.h * 1.1, 14, 1, true), mat(C.dark, { m: 0.8, r: 0.3, d: true })); bell.position.y = eng.h * 0.45; g.add(bell); }
  if (st && T0.gfx !== 'roadster') { const band = new THREE.Mesh(new THREE.CylinderGeometry(D / 2 * 1.02, D / 2 * 1.02, Math.max(0.05, L * 0.05), 14, 1, true), mat(st.livery, { m: 0.3, r: 0.5, d: true })); band.position.y = L * (0.3 + 0.1 * st.family); g.add(band); }
  return [{ group: g, h: L, payload: body }];
}

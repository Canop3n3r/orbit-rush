// Geometry kit: every part is added with a local transform and baked into ONE merged mesh per material
// (a whole vehicle stage = a handful of draw calls). Materials are shared across all vehicles.
import * as THREE from 'three/webgpu';
import * as T from './textures.js?v=f5.8o';
import { decalTexture } from './decals.js?v=f5.8o';
// own merge (all inputs are non-indexed with position/normal/uv), so the module needs no bare 'three' import
export function mergeGeometries(gs) { const out = new THREE.BufferGeometry(); for (const [a, n] of [['position', 3], ['normal', 3], ['uv', 2]]) { let len = 0; for (const g of gs) len += g.attributes[a].array.length; const arr = new Float32Array(len); let o = 0; for (const g of gs) { arr.set(g.attributes[a].array, o); o += g.attributes[a].array.length; } out.setAttribute(a, new THREE.BufferAttribute(arr, n)); } return out; }
const MATS = new Map();
export function mat(key) {
  if (MATS.has(key)) return MATS.get(key);
  let m; const S = THREE.MeshStandardMaterial, P = THREE.MeshPhysicalMaterial;
  const [k, arg] = key.split(':');
  switch (k) {
    case 'paint': { const [soot, top] = (arg || '0,0').split(',').map(Number); m = new P({ map: T.paint({ soot, sootTop: top }), roughness: 0.45, metalness: 0.0, clearcoat: 0.3, clearcoatRoughness: 0.35 }); break; }
    case 'silver': m = new S({ map: T.paint({ base: '#c9ccd0', rings: 8 }), roughness: 0.35, metalness: 0.7 }); break;
    case 'carbon': m = new P({ map: T.carbon(), color: 0x3c3c40, roughness: 0.5, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.3 }); break; // clearcoat: legs catch a highlight against the dark interstage
    case 'ti': m = new S({ color: 0xa8a29a, roughness: 0.5, metalness: 0.65, emissive: 0x2a2620, alphaMap: T.gridFin(), alphaTest: 0.5, side: THREE.DoubleSide }); break;
    case 'tiframe': m = new S({ color: 0xa9a49c, roughness: 0.42, metalness: 0.65, emissive: 0x2a2620 }); break; // rockets-3: lighter bare titanium so grid fins read
    case 'bell': m = new S({ map: T.bell(false), roughness: 0.38, metalness: 0.9, side: THREE.DoubleSide }); break;
    case 'bellx': m = new S({ map: T.bell(true), roughness: 0.32, metalness: 0.95, side: THREE.DoubleSide }); break;
    // brushed stainless: MeshPhysical anisotropy (node material on both WebGPU and WebGL2 backends; tangents are
    // generated in build() around the vehicle axis) plus a bright env so it never reads as black
    case 'steel': m = new P({ map: T.steelSkin(), roughness: 0.36, metalness: 0.72, /* plan #6: less mirror, more sun shading */ anisotropy: 0.65, anisotropyRotation: Math.PI / 2, envMapIntensity: 1.25 }); break;
    case 'frost': m = new S({ color: 0xffffff, emissive: 0x14161a, roughness: 0.9, metalness: 0, alphaMap: T.frost(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }); break;
    case 'soot': m = new S({ color: 0x14120f, roughness: 0.96, metalness: 0, alphaMap: T.soot(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }); break;
    case 'foam': m = new S({ map: T.foam(+arg || 0), roughness: 0.97, metalness: 0 }); break;
    case 'foil': m = new S({ map: T.foil(), roughness: 0.3, metalness: 0.85, side: THREE.DoubleSide }); break;
    case 'skirt': m = new S({ map: T.skirt(), roughness: 0.75, metalness: 0.35 }); break;
    case 'shield': m = new S({ map: T.blanket(), roughness: 0.9, metalness: 0.1 }); break;
    case 'tiles': m = new S({ map: T.hexTiles(), roughness: 0.62, metalness: 0.12, emissive: 0x181b21 }); break; // faint emissive floor: the black windward half of a ship must still read against space
    case 'dark': m = new S({ color: 0x1e1f22, roughness: 0.6, metalness: 0.4 }); break;
    case 'grey': m = new S({ color: 0x8a8f96, roughness: 0.5, metalness: 0.6 }); break;
    case 'gold': m = new S({ color: 0xc9a043, roughness: 0.35, metalness: 1 }); break;
    case 'solar': m = new S({ map: T.solarCells(), roughness: 0.25, metalness: 0.5 }); break;
    case 'tower': m = new S({ color: 0x4a4e55, roughness: 0.6, metalness: 0.7 }); break;
    case 'concrete': m = new S({ color: 0x9c9890, roughness: 0.95 }); break;
    case 'red': m = new P({ color: 0xb0121a, roughness: 0.25, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 }); break;
    case 'rubber': m = new S({ color: 0x111111, roughness: 0.9 }); break;
    case 'suit': m = new S({ color: 0xe8e8e8, roughness: 0.6 }); break;
    case 'glass': m = new P({ color: 0x0c1218, roughness: 0.05, metalness: 0.2, clearcoat: 1 }); break;
    case 'decal': m = new S({ map: decalTexture(arg), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 0.5, metalness: 0.1 }); break;
    default: m = new S({ color: 0xff00ff });
  }
  m.name = key; m.userData.cached = true; weakDisposeListeners(m); for (const v of Object.values(m)) if (v && v.isTexture) v.userData.cached = true; MATS.set(key, m); return m;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
export function xf(p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) { _e.set(r[0], r[1], r[2], 'YXZ'); _q.setFromEuler(_e); return new THREE.Matrix4().compose(_p.set(...p), _q, _s.set(...(typeof s === 'number' ? [s, s, s] : s))); }
export class Kit {
  constructor(detail = 'hi') { this.detail = detail; this.hi = detail !== 'lo'; this.mid = detail === 'mid'; this.b = new Map(); this.stack = [new THREE.Matrix4()]; this.seg = detail === 'hi' ? 40 : detail === 'mid' ? 18 : 14; }
  push(m) { this.stack.push(this.stack[this.stack.length - 1].clone().multiply(m)); return this; }
  pop() { this.stack.pop(); return this; }
  add(geo, key, m) { let g = geo.index ? geo.toNonIndexed() : geo; for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(m ? this.stack[this.stack.length - 1].clone().multiply(m) : this.stack[this.stack.length - 1]);
    if (!this.b.has(key)) this.b.set(key, []); this.b.get(key).push(g); return this; }
  build(name = '') { const grp = new THREE.Group(); grp.name = name; let tris = 0;
    for (const [k, gs] of this.b) { const g = mergeGeometries(gs);
      if (k === 'steel') { const p = g.attributes.position, t = new Float32Array(p.count * 4); for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), l = Math.hypot(x, z) || 1; t[i * 4] = z / l; t[i * 4 + 2] = -x / l; t[i * 4 + 3] = 1; } g.setAttribute('tangent', new THREE.BufferAttribute(t, 4)); } g.computeBoundingSphere(); const mesh = new THREE.Mesh(g, mat(k)); mesh.name = name + ':' + k; if (k.startsWith('decal')) mesh.renderOrder = 2; grp.add(mesh); tris += g.attributes.position.count / 3; }
    grp.userData.tris = tris; if (this.noz) grp.userData.nozzles = this.noz; return grp; }
}

// ---- perf helpers (QA perf report rockets-1) ----
// shared-geometry cache: identical merged geometries (e.g. titan v3/v4 boosters) are stored once, refcounted
const GEO = new Map(); let _gid = 0;
function geoKey(g) { const p = g.attributes.position.array, n = p.length; let h = n; for (let i = 0; i < n; i += Math.max(1, (n / 512) | 0)) h = (h * 31 + Math.round(p[i] * 1000)) | 0; return n + ':' + h + ':' + p[n - 1]; }
export function shareGeometries(group) { group.traverse(m => { if (!m.isMesh || m.geometry.userData.shared || m.geometry.userData.noShare) return; const k = geoKey(m.geometry) + (m.geometry.attributes.tangent ? 't' : ''), e = GEO.get(k);
  if (e) { m.geometry.dispose(); m.geometry = e.g; e.refs++; } else { m.geometry.userData.shared = k; GEO.set(k, { g: m.geometry, refs: 1 }); } }); return group; }
export const geometryCacheSize = () => GEO.size;
// compactStages: compact each stage group (direct child) separately so stages still detach on every LOD
// mid/lo: minor materials fold into a near-identical neighbour (fewer draw calls per stage)
// heron-heavy mid/lo: also fold carbon + every paint variant (soot gradients are invisible at that range); lo folds bells too
export const FOLD_HEAVY = { bellx: 'bell', shield: 'dark', skirt: 'dark', tiframe: 'dark', grey: 'dark', ti: 'dark', carbon: 'dark', 'paint:*': 'paint:0.4,0.2' };
const FOLD = { bellx: 'bell', shield: 'dark', skirt: 'dark', tiframe: 'dark', grey: 'dark', ti: 'dark' };
export function compactStages(group, keep = ['legs'], fold = true) { for (const c of group.children.slice()) if (!c.isMesh) compact(c, keep, fold); return group; }
// compact: merge every mesh with the same material (in group space) into one mesh; subtrees named in keep (animated legs) stay
export function compact(group, keep = ['legs'], fold = false) { const by = new Map(), drop = []; group.updateMatrixWorld(true); const inv = group.matrixWorld.clone().invert();
  group.traverse(o => { if (o === group) return; let p = o; while (p && p !== group) { if (keep.includes(p.name)) return; p = p.parent; }
    if (o.isMesh) { const g = o.geometry.clone(); g.applyMatrix4(inv.clone().multiply(o.matrixWorld)); if (g.attributes.tangent) g.deleteAttribute('tangent'); const F = fold === true ? FOLD : fold || {}, nm = o.material.name, to = F[nm] ?? (nm.startsWith('paint:') ? F['paint:*'] : undefined), M = to ? mat(to) : o.material; (by.get(M) || by.set(M, []).get(M)).push(g); drop.push(o); } });
  for (const o of drop) { o.parent.remove(o); if (!o.geometry.userData.shared) o.geometry.dispose(); }
  for (const g of group.children.slice()) if (!g.isMesh && !keep.includes(g.name) && !g.children.some(c => c.isMesh || c.children.length)) { /* emptied stage group: keep as an (empty) handle for userData.stages */ }
  for (const [m, gs] of by) { const g = mergeGeometries(gs); for (const x of gs) x.dispose();
    if (m.name === 'steel') { const p = g.attributes.position, t = new Float32Array(p.count * 4); for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), l = Math.hypot(x, z) || 1; t[i * 4] = z / l; t[i * 4 + 2] = -x / l; t[i * 4 + 3] = 1; } g.setAttribute('tangent', new THREE.BufferAttribute(t, 4)); }
    g.computeBoundingSphere(); const mesh = new THREE.Mesh(g, m); mesh.name = 'merged:' + m.name; if (m.name.startsWith('decal')) mesh.renderOrder = 2; group.add(mesh); }
  return group; }
// dispose: free a vehicle's GPU/JS memory when it is swapped out. Cached (shared) materials/textures are kept; shared
// geometries are refcounted and freed when the last user goes.
// f5.2.2: `live` = geometries/materials still drawn elsewhere in the scene (pad, other heroes, piece clones); never freed here.
// Cached geometries go through this module's refcount (GEO). f5.2.1 called dispose from a second copy of this module
// (main imported kit.js?v=f5.2.1, the art kit.js?v=art1), whose empty GEO made every cached geometry look owned: freed
// while other heroes/LODs still drew it (black Home on iOS). main now imports dispose/release via vehicles.js.
export function liveSet(scene) { const s = new Set(); if (scene) scene.traverse(o => { if (o.geometry) s.add(o.geometry); for (const m of [].concat(o.material || [])) { s.add(m); for (const v of Object.values(m)) if (v && v.isTexture) s.add(v); } }); return s; }
export function dispose(group, live = new Set()) { const seen = new Set(); group.traverse(o => { if (!o.isMesh && !o.isSprite) return; if (o.isInstancedMesh) o.dispose(); const g = o.geometry;
  const k = g && g.userData.shared; // shared geometries count one ref per mesh (shareGeometries refs++ per mesh), so release one per mesh too
  const e = k && GEO.get(k); if (e && e.g === g) { if (--e.refs <= 0 && !live.has(g)) { GEO.delete(k); g.dispose(); } } // flagged but not cached here (compactStages' merged hero geometry): owned by this hero
  else if (g && !seen.has(g) && !live.has(g)) { seen.add(g); g.dispose(); }
  for (const m of [].concat(o.material || [])) if (!m.userData?.cached && !live.has(m) && !seen.has(m)) { seen.add(m); for (const v of Object.values(m)) if (v && v.isTexture && !v.userData?.cached && !live.has(v)) v.dispose(); m.dispose(); } });
  group.removeFromParent(); }
// release(group, renderer?, scene?, camera?): leak-safe model swap. Detach first, render one frame without it (the renderer
// drops its per-object render state for objects no longer in the scene), then free GPU geometry/material/texture and
// drop CPU arrays so retained wrappers can't pin vertex data.
export async function release(group, renderer, scene, camera) {
  group.removeFromParent();
  if (renderer && scene && camera) { renderer.render(scene, camera); await new Promise(r => requestAnimationFrame(r)); }
  const live = liveSet(scene); dispose(group, live);
  group.traverse(o => { if (o.isMesh) { if (o.geometry && !GEO.has(o.geometry.userData.shared) && !live.has(o.geometry)) { for (const k of Object.keys(o.geometry.attributes)) o.geometry.deleteAttribute(k); o.geometry.setIndex(null); } o.geometry = null; o.material = null; } });
  group.clear(); group.userData = {};
}
// Leak fix (Playtest QA perf_rockets-2: +27.5 MB / ~3.6k buffers per rendered model cycle). three r172 RenderObjects
// subscribe to their material's 'dispose' event; our materials are shared and never disposed, so those listeners pinned
// every mesh ever rendered (plus its vertex arrays) forever. For the shared materials only, 'dispose' listeners are held
// through WeakRefs: the RenderObject owns its listener, and it is itself only weakly keyed by the mesh, so a removed
// mesh (and its render state) can be collected. Dispatching 'dispose' still reaches every live listener.
export function weakDisposeListeners(m) {
  const add = m.addEventListener.bind(m), rm = m.removeEventListener.bind(m), refs = new Set();
  m.addEventListener = (type, fn) => { if (type !== 'dispose') return add(type, fn); for (const r of refs) if (r.deref() === fn) return; refs.add(new WeakRef(fn)); };
  m.removeEventListener = (type, fn) => { if (type !== 'dispose') return rm(type, fn); for (const r of refs) { const f = r.deref(); if (!f || f === fn) refs.delete(r); } };
  const disp = m.dispatchEvent.bind(m);
  m.dispatchEvent = e => { if (e.type === 'dispose') for (const r of [...refs]) { const f = r.deref(); if (f) f.call(m, { ...e, target: m }); else refs.delete(r); } return disp(e); };
  m.hasWeakDispose = () => { let n = 0; for (const r of refs) if (r.deref()) n++; return n; };
  return m;
}

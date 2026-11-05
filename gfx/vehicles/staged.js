// Staged rocket assets (f6.0, Blender pipeline): every stage of a rocket is its OWN .glb (assets/rockets/<id>/<stage>.<tier>.glb), listed in
// assets/rockets/<id>/manifest.json. This module loads the manifest + stage assets (GLTFLoader + meshopt), assembles a model with the SAME shape the
// procedural builders return (a Group whose userData.stages = { key: Group } and userData.legs/height/id/detail), so staging, plumes, fairing and
// payload code keep working: each stage Group stays at the origin (like the procedural ones), the asset hangs under it at the manifest offset.
// Rockets without a manifest (or switched off in assets/rockets/index.json, or ?staged=off) keep the procedural model: the game never breaks mid-migration.
// Tiers: hi (desktop near), mid (phone near), lo (far LOD). Phones only ever fetch mid + lo.
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { surfaceMaterial, bakeSurf } from './surface.js?v=f5.9-27';
import { sootOf } from './surface_math.js?v=f5.9-27';

const BASE = new URL('../../assets/rockets/', import.meta.url).href;
const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const MODE = Q.get('staged'); // 'off' | 'all' (ignore the per-rocket switch) | 'id1,id2' (only these) | null (index.json decides)
let INDEX = null, INDEX_P = null;
const MANIFESTS = new Map(), SCENES = new Map(), LOADING = new Map(), MATS = new Map();
let loader = null;
function gl() { if (!loader) { loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder); } return loader; }

export function loadIndex() {
  if (INDEX_P) return INDEX_P;
  INDEX_P = MODE === 'off' ? Promise.resolve({ rockets: {} }) : fetch(BASE + 'index.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : { rockets: {} }).catch(() => ({ rockets: {} })).then(j => (INDEX = j));
  return INDEX_P;
}
/** is this rocket switched on for the staged path? (index.json `enabled` per rocket; ?staged=all|off|ids override) */
export function stagedEnabled(id) {
  if (MODE === 'off') return false;
  if (MODE === 'all') return true; // any rocket that has a manifest on disk
  if (MODE) return MODE.split(',').includes(id);
  const e = INDEX && INDEX.rockets && INDEX.rockets[id]; return !!(e && e.enabled);
}
const tierKey = (detail) => detail === 'lo' ? 'lo' : detail === 'mid' ? 'mid' : 'hi';
const tiersFor = (phone) => phone ? ['mid', 'lo'] : ['hi', 'lo'];
const keyOf = (id, phone) => id + (phone ? ':p' : '');

async function loadManifest(id) {
  if (MANIFESTS.has(id)) return MANIFESTS.get(id);
  const r = await fetch(BASE + id + '/manifest.json'); if (!r.ok) throw new Error('no manifest ' + id);
  const m = await r.json(); MANIFESTS.set(id, m); return m;
}
// shared PBR materials: vertex colours carry the livery (baked), so ONE material per kind serves the whole fleet
// realism-1: hi/mid get the shared procedural surface detail (surface.js); lo keeps the plain material
function sharedMaterial(src, tier = 'hi') {
  const k = src.name + '|' + tier; let m = MATS.get(k); if (m) return m;
  m = surfaceMaterial(src, tier);
  m.name = src.name; m.userData.cached = true; MATS.set(k, m); return m;
}
const PENDING = new Map(); // url -> Promise<scene>; SCENES holds the parsed scenes once resolved (so stagedReady() is synchronous)
const urlOf = rel => new URL('../../' + rel, import.meta.url).href;
function loadScene(url) {
  if (SCENES.has(url)) return Promise.resolve(SCENES.get(url)); if (PENDING.has(url)) return PENDING.get(url);
  const p = (async () => { const r = await fetch(url); if (!r.ok) throw new Error('asset ' + url + ' ' + r.status); const g = await gl().parseAsync(await r.arrayBuffer(), ''); SCENES.set(url, g.scene); return g.scene; })();
  PENDING.set(url, p); p.catch(() => PENDING.delete(url)); return p;
}
/** preload everything a rocket needs for this device; resolves true when buildStaged(id, ...) can be used. Never rejects. */
export function preloadStaged(id, o = {}) {
  const k = keyOf(id, o.phone); if (LOADING.has(k)) return LOADING.get(k);
  const p = (async () => {
    try { await loadIndex(); if (!stagedEnabled(id)) return false;
      const m = await loadManifest(id), jobs = [];
      for (const st of m.stages) for (const t of tiersFor(o.phone)) if (st.asset[t]) jobs.push(loadScene(urlOf(st.asset[t])));
      await Promise.all(jobs); return true;
    } catch (e) { console.warn('[Orbit Rush] staged assets', id, e && e.message); return false; }
  })();
  LOADING.set(k, p); p.then(ok => { if (!ok) LOADING.delete(k); }); return p;
}
/** sync: are the stage assets of this rocket at this detail tier parsed and the rocket switched on? */
export function stagedReady(id, detail) {
  if (!stagedEnabled(id)) return false; const m = MANIFESTS.get(id); if (!m) return false; const t = tierKey(detail);
  return m.stages.every(st => !st.asset[t] || SCENES.has(urlOf(st.asset[t])));
}

function instantiate(scene, tier = 'hi', soot = 1) {
  const c = scene.clone(true); c.updateMatrixWorld(true); const inv = c.matrixWorld.clone().invert();
  c.traverse(o => { if (o.isMesh) { o.geometry = o.geometry.clone(); o.geometry.userData.own = true; if (tier !== 'lo') bakeSurf(o.geometry, inv.clone().multiply(o.matrixWorld), soot); o.material = sharedMaterial(o.material, tier); o.castShadow = o.receiveShadow = false; o.frustumCulled = true; } });
  return c;
}
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
function legPivots(root) { // setLegs() animates pivots[i].rotation.z; rebuild each pivot's euler from its yaw
  const L = new THREE.Group(); L.name = 'legs'; L.userData.pivots = []; L.userData.arms = [];
  root.traverse(o => { if (/^leg_\d+$/.test(o.name)) { const yaw = 2 * Math.atan2(o.quaternion.y, o.quaternion.w); o.rotation.set(0, yaw, 0); L.userData.pivots.push(o); } });
  return L.userData.pivots.length ? L : null;
}
// legs-fins-1: telescoping leg struts. One mesh per leg set (phone-light: 3 six-sided sleeves per leg, one draw call), spanning the hull anchor
// and the leg's strut lug; its vertices are rewritten while the legs move (writeStruts), so the struts extend as the legs swing down.
const SLEEVE_R = [0.15, 0.115, 0.085], SIDES = 6;
let UNIT = null; // open 6-sided tube, y 0..1, radius 1 (non-indexed)
function unitTube() { if (!UNIT) { UNIT = new THREE.CylinderGeometry(1, 1, 1, SIDES, 1, true).toNonIndexed(); UNIT.translate(0, 0.5, 0); } return UNIT; }
function addStruts(a, L) {
  const legs = L.userData.pivots.filter(p => p.userData && p.userData.strut_lug); if (!legs.length) return null;
  const u = unitTube(), nv = u.attributes.position.count, n = legs.length * SLEEVE_R.length, geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * nv * 3), 3)); geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * nv * 3), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * nv * 2), 2)); geo.userData.own = true; geo.userData.noShare = true;
  const m = new THREE.Mesh(geo, strutMat()); m.name = 'legstruts'; m.frustumCulled = false; a.add(m);
  a.updateMatrixWorld(true); const inv = a.matrixWorld.clone().invert(), V = new THREE.Vector3();
  // hull anchors are fixed on the stage: computed once with the legs stowed (in the asset frame)
  m.userData.legs = legs.map(p => { const z = p.rotation.z; p.rotation.z = 0; p.updateMatrixWorld(true); const A = V.fromArray(p.userData.strut_hull).applyMatrix4(p.matrixWorld).applyMatrix4(inv).toArray(); p.rotation.z = z; p.updateMatrixWorld(true); return { name: p.name, A, lug: p.userData.strut_lug }; });
  writeStruts(m); return m;
}
const PIVC = new WeakMap(); let STRUT_MAT = null; function strutMat() { return STRUT_MAT || (STRUT_MAT = new THREE.MeshStandardMaterial({ color: 0x9a9ea6, roughness: 0.3, metalness: 0.9, name: 'legstruts' })); }
const _A = new THREE.Vector3(), _B = new THREE.Vector3(), _D = new THREE.Vector3(), _Q = new THREE.Quaternion(), _UP = new THREE.Vector3(0, 1, 0), _M4 = new THREE.Matrix4(), _S3 = new THREE.Vector3(), _P3 = new THREE.Vector3(), _N3 = new THREE.Matrix3();
/** rewrite the telescoping struts of one leg set from the current leg pivot angles (call after the pivots move). */
export function writeStruts(m) {
  const a = m.parent; if (!a) return; a.updateMatrixWorld(true); const inv = a.matrixWorld.clone().invert(), u = unitTube(), up = u.attributes.position.array, un = u.attributes.normal.array, nv = u.attributes.position.count;
  const P = m.geometry.attributes.position.array, N = m.geometry.attributes.normal.array; let c = 0;
  let pv = PIVC.get(m); if (!pv) { pv = m.userData.legs.map(l => a.getObjectByName(l.name)); PIVC.set(m, pv); } // refs kept off userData (clone() JSON-copies it)
  for (let li = 0; li < m.userData.legs.length; li++) { const l = m.userData.legs[li], p = pv[li]; if (!p) { c += SLEEVE_R.length; continue; }
    _A.fromArray(l.A); _B.fromArray(l.lug).applyMatrix4(p.matrixWorld).applyMatrix4(inv); _D.subVectors(_B, _A); const d = _D.length(); _D.normalize(); _Q.setFromUnitVectors(_UP, _D);
    const k = SLEEVE_R.length, s = Math.max(d / k + 0.35, d * 0.42); // sleeve length: overlapping when extended, nested when stowed
    for (let i = 0; i < k; i++) { const off = k > 1 ? i * (d - s) / (k - 1) : 0; _P3.copy(_A).addScaledVector(_D, off); _M4.compose(_P3, _Q, _S3.set(SLEEVE_R[i], s, SLEEVE_R[i])); _N3.getNormalMatrix(_M4);
      for (let v = 0; v < nv; v++) { const j = v * 3, o = (c * nv + v) * 3; _P3.fromArray(up, j).applyMatrix4(_M4).toArray(P, o); _S3.fromArray(un, j).applyMatrix3(_N3).normalize().toArray(N, o); } c++; } }
  m.geometry.attributes.position.needsUpdate = m.geometry.attributes.normal.needsUpdate = true;
}
// realism-1: engine soot only on stages that fire near the ground or carry engines: none on fairings/payloads/crew, full on first-stage cores and boosters
/** assemble a staged model (sync; the assets must be preloaded). detail: 'hi' | 'mid' | 'lo'. */
export function buildStaged(id, o = {}) {
  const m = MANIFESTS.get(id), tier = tierKey(o.detail), g = new THREE.Group(), stages = {}, legsAll = [];
  g.name = id; g.userData = { id, detail: o.detail || 'hi', height: m.height_m, stages, legs: [], staged: true, manifest: m };
  for (const st of m.stages) {
    const url = urlOf(st.asset[tier] || st.asset.lo || st.asset.hi), sc = SCENES.get(url); if (!sc) throw new Error('staged asset not loaded ' + url);
    const grp = new THREE.Group(); grp.name = st.key; grp.userData.top = st.offset[1] + st.size_m.h;
    const a = instantiate(sc, st.asset[tier] ? tier : 'lo', st.role === 'fairing' ? -1 : sootOf(st, m.stages, id)); a.position.set(...st.offset); a.rotation.set(0, st.rotY || 0, 0); a.name = st.key + ':asset'; grp.add(a);
    const L = legPivots(a); if (L) { a.add(L); grp.userData.legs = L; legsAll.push(L); if (tier !== 'lo' || !st.asset[tier]) addStruts(a, L); }
    grp.userData.nodes = st; stages[st.key] = grp; g.add(grp);
  }
  g.userData.legs = legsAll; return g;
}

// Staged rocket assets (f6.0, Blender pipeline): every stage of a rocket is its OWN .glb (assets/rockets/<id>/<stage>.<tier>.glb), listed in
// assets/rockets/<id>/manifest.json. This module loads the manifest + stage assets (GLTFLoader + meshopt), assembles a model with the SAME shape the
// procedural builders return (a Group whose userData.stages = { key: Group } and userData.legs/height/id/detail), so staging, plumes, fairing and
// payload code keep working: each stage Group stays at the origin (like the procedural ones), the asset hangs under it at the manifest offset.
// Rockets without a manifest (or switched off in assets/rockets/index.json, or ?staged=off) keep the procedural model: the game never breaks mid-migration.
// Tiers: hi (desktop near), mid (phone near), lo (far LOD). Phones only ever fetch mid + lo.
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

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
function sharedMaterial(src) {
  const k = src.name; let m = MATS.get(k); if (m) return m;
  m = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: src.roughness, metalness: src.metalness, side: src.side });
  m.name = k; m.userData.cached = true; MATS.set(k, m); return m;
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

function instantiate(scene) {
  const c = scene.clone(true);
  c.traverse(o => { if (o.isMesh) { o.geometry = o.geometry.clone(); o.geometry.userData.own = true; o.material = sharedMaterial(o.material); o.castShadow = o.receiveShadow = false; o.frustumCulled = true; } });
  return c;
}
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
function legPivots(root) { // setLegs() animates pivots[i].rotation.z; rebuild each pivot's euler from its yaw
  const L = new THREE.Group(); L.name = 'legs'; L.userData.pivots = []; L.userData.arms = [];
  root.traverse(o => { if (/^leg_\d+$/.test(o.name)) { const yaw = 2 * Math.atan2(o.quaternion.y, o.quaternion.w); o.rotation.set(0, yaw, 0); L.userData.pivots.push(o); } });
  return L.userData.pivots.length ? L : null;
}
/** assemble a staged model (sync; the assets must be preloaded). detail: 'hi' | 'mid' | 'lo'. */
export function buildStaged(id, o = {}) {
  const m = MANIFESTS.get(id), tier = tierKey(o.detail), g = new THREE.Group(), stages = {}, legsAll = [];
  g.name = id; g.userData = { id, detail: o.detail || 'hi', height: m.height_m, stages, legs: [], staged: true, manifest: m };
  for (const st of m.stages) {
    const url = urlOf(st.asset[tier] || st.asset.lo || st.asset.hi), sc = SCENES.get(url); if (!sc) throw new Error('staged asset not loaded ' + url);
    const grp = new THREE.Group(); grp.name = st.key; grp.userData.top = st.offset[1] + st.size_m.h;
    const a = instantiate(sc); a.position.set(...st.offset); a.rotation.set(0, st.rotY || 0, 0); a.name = st.key + ':asset'; grp.add(a);
    const L = legPivots(a); if (L) { a.add(L); grp.userData.legs = L; legsAll.push(L); }
    grp.userData.nodes = st; stages[st.key] = grp; g.add(grp);
  }
  g.userData.legs = legsAll; return g;
}

// logos-deploy-1: house livery decals (original logos from logos_spec.js) on every rocket's core, upper stage and fairing.
// The Blender stage assets have no UVs, so each decal is its own small conforming strip: the hull radius is found by raycasting the
// stage at each strip row, and the strip carries UVs into one shared atlas (1024 px on hi, 512 px on phones; lo: no decals).
// Decals are children of their stage group, so they separate, fall and burn with that stage. Never InstancedMesh.
import * as THREE from 'three/webgpu';
import { LOGOS, HOUSE_IDS, ATLAS, uvRect } from './logos_spec.js?v=f5.9-21';
const ATL = new Map(), MATS = new Map();
function atlas(det) { const S = det === 'hi' ? ATLAS.size : ATLAS.size / 2; if (ATL.has(S)) return ATL.get(S);
  const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), k = S / ATLAS.size; x.scale(k, k);
  for (const h of HOUSE_IDS) { const L = LOGOS[h], i = HOUSE_IDS.indexOf(h), X = (i % ATLAS.cols) * ATLAS.cw, Y = ((i / ATLAS.cols) | 0) * ATLAS.ch;
    x.save(); x.translate(X, Y); x.save(); x.beginPath(); x.rect(0, 0, 64, 64); x.clip(); for (const [d, ci] of L.layers) { x.fillStyle = L.c[ci]; x.fill(new Path2D(d), 'evenodd'); } x.restore();
    x.font = '900 40px "Arial Black", Helvetica, Arial, sans-serif'; x.textBaseline = 'middle'; const w = x.measureText(L.word).width, sx = Math.min(1, 368 / w); // wordmark fills its 384 px slot
    x.save(); x.translate(72, 34); x.scale(sx, 1); x.lineWidth = 3; x.strokeStyle = L.c[2]; x.lineJoin = 'round'; x.strokeText(L.word, 0, 0); x.fillStyle = L.c[0]; x.fillText(L.word, 0, 0); x.restore();
    const n = L.flag.length; L.flag.forEach((col, j) => { x.fillStyle = col; x.fillRect(452, 6 + j * 52 / n, 56, 52 / n + 0.5); }); x.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.userData.cached = true; ATL.set(S, t); return t; }
export function logoMaterial(det) { if (MATS.has(det)) return MATS.get(det);
  const m = new THREE.MeshStandardMaterial({ map: atlas(det), transparent: true, alphaTest: 0.35, depthWrite: false, roughness: 0.55, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, side: THREE.FrontSide });
  m.name = 'logo'; m.userData.cached = true; MATS.set(det, m); return m; }
const _ray = new THREE.Raycaster(), _o = new THREE.Vector3(), _d = new THREE.Vector3(), _inv = new THREE.Matrix4();
const SKIP = /plume|frost|flame|glow|smoke|logo|sat|soot|leg|fin|strake|strut|rail|tower/i;
// hull radius of stage group sg (in sg's frame) at height y and azimuth a, by a ray toward the axis; null on a miss
function hullR(sg, meshes, cx, cz, R, y, a) { sg.updateMatrixWorld(true); _o.set(cx + Math.sin(a) * R, y, cz + Math.cos(a) * R).applyMatrix4(sg.matrixWorld);
  _d.set(-Math.sin(a), 0, -Math.cos(a)).transformDirection(sg.matrixWorld); _ray.set(_o, _d); _ray.far = R * 1.2; const hit = _ray.intersectObjects(meshes, false)[0];
  if (!hit) return null; _inv.copy(sg.matrixWorld).invert(); const p = hit.point.clone().applyMatrix4(_inv); return Math.hypot(p.x - cx, p.z - cz); }
// a strip conforming to the hull: rows along y (radius per row), cols around the arc centred on azimuth a; uv rect r4; vertical: text runs up the stage
function strip(rows, a, arc, r4, vertical) { const C = 8, pos = [], uv = [], idx = []; const [u0, v0, u1, v1] = r4;
  for (let i = 0; i < rows.length; i++) for (let j = 0; j <= C; j++) { const s = j / C, t = i / (rows.length - 1), az = a + (s - 0.5) * arc, r = rows[i].r;
    pos.push(Math.sin(az) * r + rows[i].cx, rows[i].y, Math.cos(az) * r + rows[i].cz);
    if (vertical) uv.push(u0 + (u1 - u0) * t, v0 + (v1 - v0) * (1 - s)); else uv.push(u0 + (u1 - u0) * s, v0 + (v1 - v0) * t); }
  for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < C; j++) { const p = i * (C + 1) + j, q = p + C + 1; idx.push(p, p + 1, q, p + 1, q + 1, q); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; }
function stageInfo(sg) { const meshes = []; sg.updateMatrixWorld(true); _inv.copy(sg.matrixWorld).invert(); const b = new THREE.Box3(), mb = new THREE.Box3();
  sg.traverse(m => { if (m.isMesh && m.visible !== false && !SKIP.test(m.name) && !(m.material && m.material.transparent)) { meshes.push(m); m.geometry.computeBoundingBox(); mb.copy(m.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(_inv, m.matrixWorld)); b.union(mb); } });
  if (b.isEmpty() || !meshes.length) return null; const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()); return { meshes, cx: c.x, cz: c.z, y0: b.min.y, h: s.y, R: Math.max(s.x, s.z) + 2 }; }
// place one decal on stage sg: band [ya, yb] (sg frame), arc width in metres (w); returns the mesh or null
function place(sg, I, ya, yb, w, part, house, det, vertical, a0) { const N = 5, rows = [];
  // pick the clean side: of 8 azimuths, the one with the smallest hull radius at mid-band (fins, legs and raceways stick out)
  let a = a0, best = 1e9; if (a0 == null) for (let k = 0; k < 8; k++) { const az = k / 8 * Math.PI * 2 + 0.2, r = hullR(sg, I.meshes, I.cx, I.cz, I.R, (ya + yb) / 2, az); if (r != null && r < best) { best = r; a = az; } }
  if (a == null) return null;
  for (let i = 0; i < N; i++) { const y = ya + (yb - ya) * i / (N - 1), r = hullR(sg, I.meshes, I.cx, I.cz, I.R, y, a); if (r == null || r < 0.15) return null; rows.push({ y, r: r * 1.012 + 0.01, cx: I.cx, cz: I.cz }); }
  const rm = rows.reduce((t, q) => t + q.r, 0) / N; if (Math.max(...rows.map(q => q.r)) > rm * 1.25) return null; // band crosses a step in the hull: skip rather than float
  const arc = Math.min(1.6, w / rm), m = new THREE.Mesh(strip(rows, a, arc, uvRect(house, part), vertical), logoMaterial(det)); m.name = 'logo:' + house + ':' + part; m.renderOrder = 3; m.userData.azimuth = a; sg.add(m); return m; }
// stage roles from the vehicle's stage groups
const NOT_HULL = /^(sat|bay|legs|tower|plume|ring)/i, SIDE = /^(srb|strap|side|ssb|booster[LR1-9]|radial)/i;
export function liveryTargets(st) { const shell = st.payload || st.fairing || null, stages = [];
  for (const [k, sg] of Object.entries(st)) { if (!sg || !sg.isObject3D || NOT_HULL.test(k) || sg === shell || SIDE.test(k)) continue; const I = stageInfo(sg); if (I && I.h > 1) stages.push({ k, sg, I }); }
  stages.sort((p, q) => q.I.h - p.I.h); return { core: stages[0] || null, upper: stages.slice(1).find(s => s.I.y0 > -1e9) || null, shell }; }
// applyLivery(g, house, det): adds the house decals; returns the list of decal meshes (also kept on g.userData.logos)
export function applyLivery(g, house, det = 'hi') { const out = []; if (det === 'lo' || !LOGOS[house]) return out; const st = g.userData.stages; if (!st) return out;
  g.updateMatrixWorld(true); const T = liveryTargets(st);
  if (T.core) { const { sg, I } = T.core, r0 = (I.R - 2) / 2, H = I.h, wl = Math.min(H * 0.42, r0 * 2 * 6), y0 = I.y0 + H * 0.3; // vertical wordmark ~42 % of the core, its width ~1/3 of the diameter
    const m = place(sg, I, y0, y0 + wl, Math.min(wl / 6, r0 * 1.0), 'word', house, det, true); if (m) { out.push(m); const opp = place(sg, I, y0, y0 + wl, Math.min(wl / 6, r0 * 1.0), 'word', house, det, true, m.userData.azimuth + Math.PI); if (opp) out.push(opp); }
    const ym = y0 + wl + Math.min(r0 * 0.5, H * 0.04), sm = Math.min(r0 * 0.9, H * 0.08); const mk = place(sg, I, ym, ym + sm, sm, 'mark', house, det, false, m ? m.userData.azimuth : null); if (mk) out.push(mk);
    const fl = place(sg, I, ym + sm * 1.2, ym + sm * 1.8, sm, 'flag', house, det, false, m ? m.userData.azimuth : null); if (fl) out.push(fl); }
  if (T.upper) { const { sg, I } = T.upper, r0 = (I.R - 2) / 2, s = Math.min(r0 * 0.8, I.h * 0.3), y = I.y0 + I.h * 0.5 - s / 2; const mk = place(sg, I, y, y + s, s, 'mark', house, det, false); if (mk) out.push(mk); }
  if (T.shell) { const I = stageInfo(T.shell); if (I) { const r0 = (I.R - 2) / 2, hh = Math.min(r0 * 0.5, I.h * 0.12), y = I.y0 + I.h * 0.22;
    const wm = place(T.shell, I, y, y + hh, hh * 6, 'word', house, det, false); if (wm) out.push(wm); const mk = place(T.shell, I, y + hh * 1.3, y + hh * 2.6, hh * 1.3, 'mark', house, det, false, wm ? wm.userData.azimuth : null); if (mk) out.push(mk); } }
  g.userData.logos = out.map(m => m.name); g.userData.house = house; return out; }

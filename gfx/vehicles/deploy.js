// logos-deploy-1: deployable payload appendages with real pivots: accordion solar wings, roll-out blankets, telescoping booms and
// hinged antennas. Each builder returns { group, set(k) }; set(0) is stowed against the bus, set(1) deployed (timing: deploy_math.js).
// A few small shared materials and one 64 px solar-cell texture; plain meshes (never InstancedMesh).
import * as THREE from 'three/webgpu';
import { wingAngles, rollOut, boomOut, hinge } from './deploy_math.js?v=f5.9-24';
let CELL = null; const MATS = {};
function cellTex() { if (CELL) return CELL; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#16306f'; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#1f3f8c'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) x.fillRect(i * 16 + 1, j * 16 + 1, 14, 14); x.fillStyle = '#9aa0a8'; x.fillRect(0, 0, 64, 1); x.fillRect(0, 0, 1, 64);
  CELL = new THREE.CanvasTexture(c); CELL.wrapS = CELL.wrapT = THREE.RepeatWrapping; CELL.colorSpace = THREE.SRGBColorSpace; CELL.userData.cached = true; return CELL; }
const M = (k, o) => MATS[k] || (MATS[k] = Object.assign(new THREE.MeshStandardMaterial(o), { name: 'deploy-' + k }), MATS[k].userData.cached = true, MATS[k]);
const mats = () => ({ panel: M('panel', { map: cellTex(), roughness: 0.3, metalness: 0.45, side: THREE.DoubleSide }), frame: M('frame', { color: 0x9aa0a8, roughness: 0.35, metalness: 0.8 }),
  dark: M('dark', { color: 0x25272b, roughness: 0.5, metalness: 0.4 }), white: M('white', { color: 0xe3e5e8, roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide }), gold: M('gold', { color: 0xc9a043, roughness: 0.35, metalness: 0.7, side: THREE.DoubleSide }) });
const mesh = (geo, m, name) => { const o = new THREE.Mesh(geo, m); o.name = name; return o; };
// accordion wing on side s (+1 / -1): hinge at (s*x0, y, z); n panels of w (along x) by l (along z), behind a yoke of length yk
export function accordionWing(s, { x0, y, z = 0, n, w, l, yk = 0.25 }) { const T = mats(), root = new THREE.Group(); root.name = 'wing-root'; root.position.set(s * x0, y, z);
  const pg = new THREE.BoxGeometry(w, 0.03, l); const uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(w / 0.5)), uv.getY(i) * Math.max(1, Math.round(l / 0.5)));
  const yoke = mesh(new THREE.BoxGeometry(yk, 0.05, 0.06), T.frame, 'wing-yoke'); yoke.position.x = s * yk / 2; root.add(yoke);
  const hinges = [root]; let parent = root, at = yk;
  for (let i = 0; i < n; i++) { const h = new THREE.Group(); h.name = 'wing-hinge'; h.position.x = s * at; parent.add(h); const p = mesh(pg, T.panel, 'wing-panel'); p.position.x = s * w / 2; h.add(p);
    if (i) hinges.push(h); parent = h; at = w + 0.02; }
  const set = k => { const a = wingAngles(k, n, s); for (let i = 0; i < hinges.length; i++) hinges[i].rotation.z = a[i]; }; set(0); return { group: root, set, pivots: hinges }; }
// roll-out blanket on side s: a mast hinged at the bus swings out, then a drum rolls the blanket out to len
export function rollOutWing(s, { x0, y, z = 0, len, wd }) { const T = mats(), root = new THREE.Group(); root.name = 'roll-root'; root.position.set(s * x0, y, z);
  const bl = new THREE.PlaneGeometry(1, wd); bl.rotateX(-Math.PI / 2); bl.translate(0.5, 0, 0); const uv = bl.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(len / 0.5)), uv.getY(i) * Math.max(1, Math.round(wd / 0.5)));
  const blanket = mesh(bl, T.panel, 'roll-blanket'); blanket.scale.x = s * len; root.add(blanket);
  const drum = mesh(new THREE.CylinderGeometry(0.06, 0.06, wd * 1.04, 8), T.frame, 'roll-drum'); drum.rotation.x = Math.PI / 2; root.add(drum);
  for (const e of [-1, 1]) { const rail = mesh(new THREE.BoxGeometry(1, 0.025, 0.025), T.frame, 'roll-rail'); rail.geometry.translate(0.5, 0, 0); rail.position.z = e * wd / 2; root.add(rail); rail.userData.rail = true; }
  const rails = root.children.filter(c => c.userData.rail);
  const set = k => { const r = rollOut(k); root.rotation.z = s * r.mast; blanket.scale.x = s * len * r.unroll; drum.position.x = s * len * r.unroll; for (const q of rails) q.scale.x = s * len * r.unroll; };
  set(0); return { group: root, set, pivots: [root] }; }
// telescoping boom from p along unit dir d (3 nested sections), tip sensor
export function boom(p, d, len, rad = 0.035) { const T = mats(), root = new THREE.Group(); root.name = 'boom-root'; root.position.set(...p); root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...d).normalize());
  const segs = []; for (let i = 0; i < 3; i++) { const g = new THREE.CylinderGeometry(rad * (1 - i * 0.22), rad * (1 - i * 0.22), len / 3, 6); g.translate(0, len / 6, 0); const m = mesh(g, T.frame, 'boom-seg'); root.add(m); segs.push(m); }
  const tip = mesh(new THREE.BoxGeometry(rad * 4, rad * 4, rad * 4), T.gold, 'boom-tip'); root.add(tip);
  const set = k => { const f = boomOut(k); segs.forEach((m, i) => { m.position.y = len / 3 * i * f; }); tip.position.y = len * f; }; set(0); return { group: root, set, pivots: [root, ...segs] }; }
// hinged dish on an arm: hinge at p, folded by `fold` rad about x (against the bus), opening to the deployed pose
export function hingedDish(p, r, arm, fold = 2.4, ry = 0) { const T = mats(), root = new THREE.Group(); root.name = 'dish-root'; root.position.set(...p); root.rotation.y = ry; const h = new THREE.Group(); h.name = 'dish-hinge'; root.add(h);
  const a = mesh(new THREE.CylinderGeometry(0.03, 0.03, arm, 6), T.frame, 'dish-arm'); a.position.y = arm / 2; h.add(a);
  const d = mesh(new THREE.SphereGeometry(r, 12, 4, 0, Math.PI * 2, 0, 1.0), T.white, 'dish'); d.rotation.x = Math.PI * 0.5; d.position.set(0, arm, r * 0.3); h.add(d);
  const set = k => { h.rotation.x = hinge(k, fold); }; set(0); return { group: root, set, pivots: [h] }; }
// small hinged flat panel (cubesat wings): hinge at p, hanging flush down the body when stowed (rot -s*PI/2 about z), flat when deployed
export function flapPanel(s, p, w, l, ry = 0) { const T = mats(), root = new THREE.Group(); root.name = 'flap-root'; root.position.set(...p); root.rotation.y = ry; const h = new THREE.Group(); h.name = 'flap-hinge'; root.add(h);
  const m = mesh(new THREE.BoxGeometry(w, 0.01, l), T.panel, 'flap-panel'); m.position.x = s * w / 2; h.add(m);
  const set = k => { h.rotation.z = hinge(k, -s * Math.PI / 2, 0.1, 0.6); }; set(0); return { group: root, set, pivots: [h] }; }
// collect appendages into one deploy(k) and a pivot list (tests read userData.pivots)
export function rig(parts) { const pivots = parts.flatMap(p => p.pivots); return { set: k => { for (const p of parts) p.set(k); }, pivots }; }

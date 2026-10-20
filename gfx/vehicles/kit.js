// Geometry kit: every part is added with a local transform and baked into ONE merged mesh per material
// (a whole vehicle stage = a handful of draw calls). Materials are shared across all vehicles.
import * as THREE from 'three/webgpu';
import * as T from './textures.js?v=art1';
import { decalTexture } from './decals.js?v=art1';
// own merge (all inputs are non-indexed with position/normal/uv), so the module needs no bare 'three' import
function mergeGeometries(gs) { const out = new THREE.BufferGeometry(); for (const [a, n] of [['position', 3], ['normal', 3], ['uv', 2]]) { let len = 0; for (const g of gs) len += g.attributes[a].array.length; const arr = new Float32Array(len); let o = 0; for (const g of gs) { arr.set(g.attributes[a].array, o); o += g.attributes[a].array.length; } out.setAttribute(a, new THREE.BufferAttribute(arr, n)); } return out; }
const MATS = new Map();
export function mat(key) {
  if (MATS.has(key)) return MATS.get(key);
  let m; const S = THREE.MeshStandardMaterial, P = THREE.MeshPhysicalMaterial;
  const [k, arg] = key.split(':');
  switch (k) {
    case 'paint': { const [soot, top] = (arg || '0,0').split(',').map(Number); m = new P({ map: T.paint({ soot, sootTop: top }), roughness: 0.42, metalness: 0.05, clearcoat: 0.35, clearcoatRoughness: 0.4 }); break; }
    case 'silver': m = new S({ map: T.paint({ base: '#c9ccd0', rings: 8 }), roughness: 0.35, metalness: 0.7 }); break;
    case 'carbon': m = new S({ map: T.carbon(), roughness: 0.48, metalness: 0.25 }); break;
    case 'ti': m = new S({ color: 0x77726c, roughness: 0.55, metalness: 1, alphaMap: T.gridFin(), alphaTest: 0.5, side: THREE.DoubleSide }); break;
    case 'tiframe': m = new S({ color: 0x5f5b56, roughness: 0.5, metalness: 1 }); break;
    case 'bell': m = new S({ map: T.bell(false), roughness: 0.38, metalness: 0.9, side: THREE.DoubleSide }); break;
    case 'bellx': m = new S({ map: T.bell(true), roughness: 0.32, metalness: 0.95, side: THREE.DoubleSide }); break;
    case 'steel': m = new S({ map: T.steelSkin(), roughness: 0.3, metalness: 0.88 }); break;
    case 'tiles': m = new S({ map: T.hexTiles(), roughness: 0.82, metalness: 0.05 }); break;
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
  m.name = key; MATS.set(key, m); return m;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
export function xf(p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) { _e.set(r[0], r[1], r[2], 'YXZ'); _q.setFromEuler(_e); return new THREE.Matrix4().compose(_p.set(...p), _q, _s.set(...(typeof s === 'number' ? [s, s, s] : s))); }
export class Kit {
  constructor(detail = 'hi') { this.detail = detail; this.hi = detail === 'hi'; this.b = new Map(); this.stack = [new THREE.Matrix4()]; this.seg = this.hi ? 40 : 14; }
  push(m) { this.stack.push(this.stack[this.stack.length - 1].clone().multiply(m)); return this; }
  pop() { this.stack.pop(); return this; }
  add(geo, key, m) { let g = geo.index ? geo.toNonIndexed() : geo; for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(m ? this.stack[this.stack.length - 1].clone().multiply(m) : this.stack[this.stack.length - 1]);
    if (!this.b.has(key)) this.b.set(key, []); this.b.get(key).push(g); return this; }
  build(name = '') { const grp = new THREE.Group(); grp.name = name; let tris = 0;
    for (const [k, gs] of this.b) { const g = mergeGeometries(gs); g.computeBoundingSphere(); const mesh = new THREE.Mesh(g, mat(k)); mesh.name = name + ':' + k; if (k.startsWith('decal')) mesh.renderOrder = 2; grp.add(mesh); tris += g.attributes.position.count / 3; }
    grp.userData.tris = tris; return grp; }
}

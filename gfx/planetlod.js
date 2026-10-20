// f5 (B): chunked quadtree planet terrain for every body. A cube-sphere (6 faces) is split into chunks near the
// camera and merged far away; each chunk is an N×N grid with skirts (no cracks between levels). Every chunk uses
// the SAME material and texture mapping as the old single sphere (three.js SphereGeometry uv convention), so land,
// water, coast and specular come from the body's maps at every level — only the tessellation changes, and the
// split distance keeps the chord-sag difference at a switch below ~1 px. Far away (and from orbit) a single cheap
// sphere is drawn instead. Per-tier caps bound chunks (= draw calls) and triangles for phone budgets.
import * as THREE from 'three/webgpu';
export const LOD_TIERS = {
  low:  { N: 12, maxDepth: 13, maxChunks: 90,  split: 1.1, sphere: [64, 32] },
  med:  { N: 16, maxDepth: 14, maxChunks: 160, split: 1.3, sphere: [96, 48] },
  high: { N: 16, maxDepth: 15, maxChunks: 240, split: 1.5, sphere: [128, 64] },
};
// cube face bases: normal, u axis, v axis
const FACES = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, -1, 0], [0, 0, 1]], [[0, 1, 0], [-1, 0, 0], [0, 0, 1]],
  [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [0, 1, 0], [-1, 0, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]];
const nrm = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
// face point (s,t in -1..1) -> unit sphere (equal-area-ish cube warp)
function cubeDir(f, s, t) { const [n, u, v] = FACES[f], x = n[0] + u[0] * s + v[0] * t, y = n[1] + u[1] * s + v[1] * t, z = n[2] + u[2] * s + v[2] * t;
  const x2 = x * x, y2 = y * y, z2 = z * z; return nrm(x * Math.sqrt(1 - y2 / 2 - z2 / 2 + y2 * z2 / 3), y * Math.sqrt(1 - z2 / 2 - x2 / 2 + z2 * x2 / 3), z * Math.sqrt(1 - x2 / 2 - y2 / 2 + x2 * y2 / 3)); }
// uvM: Matrix3 taking a planet-local direction to the pre-rotation SphereGeometry frame (Y-up), so uv matches three's sphere
export function createPlanetLOD({ radius, material, tier = 'med', uvM = new THREE.Matrix3(), sphereAbove = 3.0 }) {
  const T = LOD_TIERS[tier] || LOD_TIERS.med, group = new THREE.Group(), cache = new Map(), N = T.N, e = uvM.elements;
  group.name = 'planetLOD';
  const sphGeo = new THREE.SphereGeometry(1, T.sphere[0], T.sphere[1]); { const m4 = new THREE.Matrix4().setFromMatrix3(uvM.clone().invert()); sphGeo.applyMatrix4(m4); }
  const sphere = new THREE.Mesh(sphGeo, material); sphere.scale.setScalar(radius); sphere.frustumCulled = false; group.add(sphere);
  const toUV = (d, uc, out) => { // three SphereGeometry: x=-cos(phi)sin(th), y=cos(th), z=sin(phi)sin(th); u=phi/2pi, v=1-th/pi
    const px = e[0] * d[0] + e[3] * d[1] + e[6] * d[2], py = e[1] * d[0] + e[4] * d[1] + e[7] * d[2], pz = e[2] * d[0] + e[5] * d[1] + e[8] * d[2];
    let u = Math.atan2(pz, -px) / (2 * Math.PI); if (u < 0) u += 1; if (uc !== null) { while (u - uc > 0.5) u -= 1; while (uc - u > 0.5) u += 1; }
    out[0] = u; out[1] = 1 - Math.acos(Math.max(-1, Math.min(1, py))) / Math.PI; return out; };
  function build(f, lv, s0, t0, sz) {
    const key = f + ':' + lv + ':' + s0 + ':' + t0; let c = cache.get(key); if (c) return c;
    const V = N + 1, nv = V * V + 4 * V, pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = [];
    const cd = cubeDir(f, s0 + sz / 2, t0 + sz / 2), C = cd.map(x => x * radius), uvC = [0, 0]; toUV(cd, null, uvC);
    const near = Math.abs(cd[1]) > 0.985 || Math.abs(e[1] * cd[0] + e[4] * cd[1] + e[7] * cd[2]) > 0.985; // pole: keep raw u
    const edge = sz * radius * 0.79, skirt = Math.max(30, edge / N * 0.25), tmp = [0, 0];
    const put = (k, d, drop) => { const r = radius - drop; pos[k * 3] = d[0] * r - C[0]; pos[k * 3 + 1] = d[1] * r - C[1]; pos[k * 3 + 2] = d[2] * r - C[2];
      nor[k * 3] = d[0]; nor[k * 3 + 1] = d[1]; nor[k * 3 + 2] = d[2]; toUV(d, near ? null : uvC[0], tmp); uv[k * 2] = tmp[0]; uv[k * 2 + 1] = tmp[1]; };
    for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) put(j * V + i, cubeDir(f, s0 + sz * i / N, t0 + sz * j / N), 0);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * V + i, b = a + 1, c2 = a + V, d2 = c2 + 1; idx.push(a, b, d2, a, d2, c2); }
    // skirts: each border row duplicated slightly below the surface
    const border = [[...Array(V).keys()].map(i => i), [...Array(V).keys()].map(i => N * V + i), [...Array(V).keys()].map(j => j * V), [...Array(V).keys()].map(j => j * V + N)];
    let k = V * V; for (let b = 0; b < 4; b++) { const row = border[b], base = k;
      for (let q = 0; q < V; q++) { const o = row[q]; const d = [nor[o * 3], nor[o * 3 + 1], nor[o * 3 + 2]]; put(k++, d, skirt); uv[(k - 1) * 2] = uv[o * 2]; uv[(k - 1) * 2 + 1] = uv[o * 2 + 1]; }
      for (let q = 0; q < N; q++) { const a = row[q], b2 = row[q + 1], c3 = base + q, d3 = base + q + 1; idx.push(a, c3, b2, b2, c3, d3, a, b2, c3, b2, d3, c3); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    g.computeBoundingSphere(); const m = new THREE.Mesh(g, material); m.position.set(C[0], C[1], C[2]); m.matrixAutoUpdate = false; m.updateMatrix();
    c = { key, mesh: m, tris: idx.length / 3, used: 0, cd, edge }; cache.set(key, c); return c;
  }
  const stats = { chunks: 0, tris: 0, draws: 0, sphere: false, depth: 0 };
  let frame = 0;
  function update(camLocal) { // camera position in the planet's local frame (metres from the centre)
    frame++; const ch = camLocal, h = Math.hypot(ch.x, ch.y, ch.z) - radius;
    for (const m of group.children) if (m !== sphere) m.visible = false;
    if (h > radius * sphereAbove * 0.1 + 0 && h > 600e3) { sphere.visible = true; Object.assign(stats, { chunks: 0, tris: T.sphere[0] * T.sphere[1] * 2, draws: 1, sphere: true, depth: 0, alt: h }); return stats; }
    sphere.visible = false;
    // breadth-first split, nearest first, until the chunk cap
    let leaves = []; for (let f = 0; f < 6; f++) leaves.push({ f, lv: 0, s0: -1, t0: -1, sz: 2 });
    const dist = n => { const d = cubeDir(n.f, n.s0 + n.sz / 2, n.t0 + n.sz / 2), x = d[0] * radius - ch.x, y = d[1] * radius - ch.y, z = d[2] * radius - ch.z; return Math.hypot(x, y, z) - n.sz * radius * 0.79 * 0.71; };
    const horizon = Math.sqrt(Math.max(0, (radius + h) ** 2 - radius * radius)) + 0.0, camDir = nrm(ch.x, ch.y, ch.z);
    const hAng = Math.acos(Math.min(1, radius / (radius + Math.max(h, 1)))) + 0.05;
    const behind = n => { const d = cubeDir(n.f, n.s0 + n.sz / 2, n.t0 + n.sz / 2), dp = d[0] * camDir[0] + d[1] * camDir[1] + d[2] * camDir[2]; return Math.acos(Math.max(-1, Math.min(1, dp))) - n.sz * 0.79 * 0.75 > hAng; };
    // greedy: always split the leaf whose edge/distance ratio is largest, until none qualifies or the chunk cap is hit
    let depth = 0; leaves = leaves.filter(n => true);
    for (let it = 0; it < 400 && leaves.length + 3 <= T.maxChunks; it++) {
      let bi = -1, bs = 0;
      for (let i = 0; i < leaves.length; i++) { const n = leaves[i]; if (n.lv >= T.maxDepth) continue; if (n.pr === undefined) n.pr = behind(n) ? 0 : (n.sz * radius * 0.79) / Math.max(1, dist(n));
        if (n.pr > 1 / T.split && n.pr > bs) { bs = n.pr; bi = i; } }
      if (bi < 0) break; const n = leaves[bi], hs = n.sz / 2; leaves.splice(bi, 1);
      for (const [ds, dt] of [[0, 0], [hs, 0], [0, hs], [hs, hs]]) leaves.push({ f: n.f, lv: n.lv + 1, s0: n.s0 + ds, t0: n.t0 + dt, sz: hs }); depth = Math.max(depth, n.lv + 1); }
    let tris = 0, draws = 0;
    for (const n of leaves) { const c = build(n.f, n.lv, n.s0, n.t0, n.sz);
      // cull chunks fully behind the horizon (back of the planet)
      const dp = c.cd[0] * camDir[0] + c.cd[1] * camDir[1] + c.cd[2] * camDir[2], ang = c.edge / radius; if (Math.acos(Math.max(-1, Math.min(1, dp))) - ang > Math.acos(Math.min(1, radius / (radius + Math.max(h, 1)))) + 0.05) continue;
      if (!c.mesh.parent) group.add(c.mesh); c.mesh.visible = true; c.used = frame; tris += c.tris; draws++; }
    if (cache.size > T.maxChunks * 3) for (const [k, c] of cache) if (frame - c.used > 120) { if (c.mesh.parent) group.remove(c.mesh); c.mesh.geometry.dispose(); cache.delete(k); }
    Object.assign(stats, { chunks: leaves.length, tris, draws, sphere: false, depth, alt: h }); return stats;
  }
  return { group, update, stats, sphere };
}

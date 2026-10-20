// frameRocket (QA rockets-3b): project tip + base rim with a REAL THREE.PerspectiveCamera across heights/aspects/sheets.
// tip must stay >= safeTop (48 px) below the top, base must stay above the bottom sheet, fill ~70% when the strip allows.
// Needs three r172 (THREE_MODULE env or /tmp/t3); skips with exit 0 if missing.
import { existsSync } from 'node:fs';
const P = process.env.THREE_MODULE || '/tmp/t3/three/build/three.module.js';
if (!existsSync(P)) { console.log('showroom_frame: skipped (no three module)'); process.exit(0); }
const THREE = await import(P); const { frameRocket } = await import('../gfx/showroom_frame.js');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : (fail++, console.log('FAIL', m)); };
for (const [W, H, free] of [[390, 844, { bottom: 0.3 }], [390, 844, { bottom: 0.24 }], [430, 932, { bottom: 0.3 }], [844, 390, { right: 0.38 }], [932, 430, { right: 0.38 }]])
  for (const h of [30, 70, 120]) for (const fov of [40, 50]) {
    const f = frameRocket({ h, fovDeg: fov, aspect: W / H, free, screenH: H, topRadius: 0 }) /* needle nose */, cam = new THREE.PerspectiveCamera(fov, W / H, 0.1, 1e5);
    cam.position.set(...f.cam); cam.lookAt(new THREE.Vector3(...f.aim)); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    const py = v => (1 - v.project(cam).y) / 2 * H; let tip = Infinity, base = -Infinity;
    for (let i = 0; i < 64; i++) { const r = 0.09 * h, a = 2 * Math.PI * i / 64; base = Math.max(base, py(new THREE.Vector3(r * Math.cos(a), 0, r * Math.sin(a)))); } /* base = real round rim, not bbox corners */
    tip = Math.min(py(new THREE.Vector3(0, h, 0)), ...Array.from({ length: 16 }, (_, i) => py(new THREE.Vector3(Math.cos(i) * 0.02 * h, h * 0.98, Math.sin(i) * 0.02 * h))));
    const sheet = H * (1 - (free.bottom || 0)), fill = (base - tip) / H, tag = `${W}x${H} ${JSON.stringify(free)} h${h} fov${fov}`;
    console.log(`${tag}: tip ${tip.toFixed(1)} px, base ${base.toFixed(1)} px (sheet ${sheet.toFixed(0)}), fill ${(fill * 100).toFixed(1)}%`);
    ok(tip >= 48 - 0.5, `${tag}: tip ${tip.toFixed(1)} px below 48 px safe top`); ok(base <= sheet - 1, `${tag}: base ${base.toFixed(1)} clears sheet ${sheet}`);
    const want = Math.min(0.7, (sheet - 6 - 48) / H); ok(Math.abs(fill - want) < 0.01, `${tag}: fill ${fill.toFixed(3)} ~ ${want.toFixed(3)}`);
  }
// Real silhouettes, measured from EVERY projected mesh vertex (QA perf_rockets-3d: bbox corners sit r*sqrt2 outside a round body).
// bounds-only (a Box3 has no silhouette) is checked for safety only: it assumes a flat top/base ellipse, so domes/needles land a little low.
// Portrait 390x844 (sheets 0.3 / 0.24), default (with shape hints) + object modes: top must land at 48 +-0.5 px and base at 6 +-0.5 px above the sheet. Landscape: safe + clears only.
const up = (g, h) => (g.translate(0, h / 2, 0), g);
const shapes = {
  blunt: { mk: h => { const r = 0.09 * h; return new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(r, 0), ...Array.from({ length: 17 }, (_, i) => new THREE.Vector2(r * Math.cos(i / 16 * Math.PI / 2), h - r + r * Math.sin(i / 16 * Math.PI / 2)))], 32); }, opt: h => { const r = 0.09 * h; return { profile: Array.from({ length: 9 }, (_, i) => [h - r + r * Math.sin(i / 8 * Math.PI / 2), r * Math.cos(i / 8 * Math.PI / 2)]) }; } },
  flat: { mk: h => up(new THREE.CylinderGeometry(0.09 * h, 0.09 * h, h, 32), h), opt: () => ({}) },
  cyl: { mk: h => up(new THREE.CylinderGeometry(0.03 * h, 0.03 * h, h, 32), h), opt: h => ({ radius: 0.03 * h }) },
  pointed: { mk: h => { const r = 0.09 * h, g = new THREE.LatheGeometry([[r, 0], [r, 0.8 * h], [0, h]].map(([x, y]) => new THREE.Vector2(x, y)), 32); return g; }, opt: () => ({ topRadius: 0 }) } };
const rows = [];
for (const [W, H, free] of [[390, 844, { bottom: 0.3 }], [390, 844, { bottom: 0.24 }], [844, 390, { right: 0.38 }]]) for (const h of [30, 70, 120]) for (const [sh, { mk, opt }] of Object.entries(shapes)) for (const mode of ['default', 'object', 'bounds']) {
  const mesh = new THREE.Mesh(mk(h)), fov = 40, cam = new THREE.PerspectiveCamera(fov, W / H, 0.1, 1e5);
  const extra = mode === 'object' ? { object: mesh } : mode === 'bounds' ? { bounds: new THREE.Box3().setFromObject(mesh) } : { h, ...opt(h) };
  const f = frameRocket({ fovDeg: fov, aspect: W / H, free, screenH: H, ...extra });
  cam.position.set(...f.cam); cam.lookAt(new THREE.Vector3(...f.aim)); cam.updateMatrixWorld();
  const pa = mesh.geometry.attributes.position, v = new THREE.Vector3(); let tip = Infinity, base = -Infinity;
  for (let i = 0; i < pa.count; i++) { const y = (1 - v.fromBufferAttribute(pa, i).project(cam).y) / 2 * H; tip = Math.min(tip, y); base = Math.max(base, y); }
  const sheet = H * (1 - (free.bottom || 0)), gap = sheet - base, tag = `${sh}/${mode} ${W}x${H} ${JSON.stringify(free)} h${h}`, fill = (base - tip) / H;
  console.log(`${tag}: vertex tip ${tip.toFixed(2)} px, base ${gap.toFixed(2)} px above sheet, fill ${(fill * 100).toFixed(1)}%`);
  if (W === 390) rows.push([sh, mode, free.bottom, h, tip, gap, fill]);
  ok(tip >= 48 - 0.5, `${tag}: tip ${tip.toFixed(2)} >= 47.5`); ok(gap >= 0.5, `${tag}: base clears sheet (${gap.toFixed(2)})`); ok(fill > 0.55, `${tag}: fills > 55%`);
  if (W === 390 && mode !== 'bounds') { ok(Math.abs(tip - 48) <= 0.5, `${tag}: tip ${tip.toFixed(2)} = 48 +-0.5`); ok(Math.abs(gap - 6) <= 0.5, `${tag}: base gap ${gap.toFixed(2)} = 6 +-0.5`); }
}
// QA perf_rockets-3e harness shapes, exact call args (frame.html): Group of 24-seg CylinderGeometry/ConeGeometry meshes, fov 40.
// object / rocket modes and default-with-hints must be exact (48 +-0.5 top, 6 +-0.5 base); QA's h-only call is safe-only (documented fallback).
const qa = { cyl: [1 / 24, null], flat: [0.09, null], blunt: [0.09, 'blunt'], cone: [0.09, 'cone'] };
const qaRows = [];
for (const fb of [0.3, 0.24]) for (const h of [30, 70, 120]) for (const [sh, [rf]] of Object.entries(qa)) for (const mode of ['object', 'rocket', 'hints', 'h-only']) {
  const W = 390, H = 844, free = { bottom: fb }, rad = rf * h, g = new THREE.Group(), add = (geo, y) => { const m = new THREE.Mesh(geo); m.position.y = y; g.add(m); };
  if (sh === 'cyl' || sh === 'flat') add(new THREE.CylinderGeometry(rad, rad, h, 24), h / 2);
  else if (sh === 'blunt') { const bh = h * 0.85; add(new THREE.CylinderGeometry(rad, rad, bh, 24), bh / 2); add(new THREE.CylinderGeometry(rad * 0.6, rad, h - bh, 24), bh + (h - bh) / 2); }
  else { const bh = h * 0.8; add(new THREE.CylinderGeometry(rad, rad, bh, 24), bh / 2); add(new THREE.ConeGeometry(rad, h - bh, 24), bh + (h - bh) / 2); }
  g.updateMatrixWorld(true);
  const o = { fovDeg: 40, aspect: W / H, free, screenH: H };
  if (mode === 'object') o.object = g; else if (mode === 'rocket') o.rocket = { userData: { group: g } }; else { o.h = h; if (mode === 'hints') Object.assign(o, { radius: rad, topRadius: sh === 'blunt' ? 0.6 * rad : sh === 'cone' ? 0 : rad }); }
  const f = frameRocket(o), cam = new THREE.PerspectiveCamera(40, W / H, 0.1, 1e5); cam.position.set(...f.cam); cam.lookAt(...f.aim); cam.updateMatrixWorld();
  let tip = Infinity, base = -Infinity; const v = new THREE.Vector3();
  g.traverse(m => { if (!m.isMesh) return; const pa = m.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { const y = (1 - v.fromBufferAttribute(pa, i).applyMatrix4(m.matrixWorld).project(cam).y) / 2 * H; tip = Math.min(tip, y); base = Math.max(base, y); } });
  const gap = H * (1 - fb) - base, tag = `QA ${sh}/${mode} fb${fb} h${h}`; qaRows.push({ shape: sh, mode, fb, h, tip: +tip.toFixed(2), gap: +gap.toFixed(2), fill: +((base - tip) / H * 100).toFixed(1) });
  ok(tip >= 47.5 && gap >= 0.5, `${tag}: safe (tip ${tip.toFixed(2)}, gap ${gap.toFixed(2)})`);
  if (mode !== 'h-only' || sh === 'flat') { ok(Math.abs(tip - 48) <= 0.5, `${tag}: tip ${tip.toFixed(2)} = 48 +-0.5`); ok(Math.abs(gap - 6) <= 0.5, `${tag}: gap ${gap.toFixed(2)} = 6 +-0.5`); }
}
if (process.env.SHOWROOM_TABLE) console.table(qaRows.filter(r => r.h === 70));
if (process.env.SHOWROOM_TABLE) console.table(rows.map(([s, m, b, h, t, g, f]) => ({ shape: s, mode: m, sheet: b, h, tip: +t.toFixed(2), gap: +g.toFixed(2), fill: +(f * 100).toFixed(1) })));
console.log(`showroom_frame: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

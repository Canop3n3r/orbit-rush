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
    for (let i = 0; i < 4; i++) { const r = 0.09 * h; base = Math.max(base, py(new THREE.Vector3(i & 1 ? r : -r, 0, i & 2 ? r : -r))); } /* base = bbox corners */
    tip = Math.min(py(new THREE.Vector3(0, h, 0)), ...Array.from({ length: 16 }, (_, i) => py(new THREE.Vector3(Math.cos(i) * 0.02 * h, h * 0.98, Math.sin(i) * 0.02 * h))));
    const sheet = H * (1 - (free.bottom || 0)), fill = (base - tip) / H, tag = `${W}x${H} ${JSON.stringify(free)} h${h} fov${fov}`;
    console.log(`${tag}: tip ${tip.toFixed(1)} px, base ${base.toFixed(1)} px (sheet ${sheet.toFixed(0)}), fill ${(fill * 100).toFixed(1)}%`);
    ok(tip >= 48 - 0.5, `${tag}: tip ${tip.toFixed(1)} px below 48 px safe top`); ok(base <= sheet - 1, `${tag}: base ${base.toFixed(1)} clears sheet ${sheet}`);
    const want = Math.min(0.7, (sheet - 6 - 48) / H); ok(Math.abs(fill - want) < 0.01, `${tag}: fill ${fill.toFixed(3)} ~ ${want.toFixed(3)}`);
  }
// blunt (capsule top) and flat-top (cylinder) rockets, measured from FULL MESH BOUNDS (all 8 world-bbox corners projected)
const shapes = { blunt: h => { const r = 0.09 * h, g = new THREE.CapsuleGeometry(r, h - 2 * r, 8, 16); g.translate(0, h / 2, 0); return g; }, flat: h => { const g = new THREE.CylinderGeometry(0.09 * h, 0.09 * h, h, 24); g.translate(0, h / 2, 0); return g; } };
for (const [W, H, free] of [[390, 844, { bottom: 0.3 }], [390, 844, { bottom: 0.24 }], [844, 390, { right: 0.38 }]]) for (const h of [30, 70, 120]) for (const [sh, mk] of Object.entries(shapes)) for (const mode of ['default', 'object']) {
  const mesh = new THREE.Mesh(mk(h)), fov = 40, cam = new THREE.PerspectiveCamera(fov, W / H, 0.1, 1e5);
  const f = frameRocket({ fovDeg: fov, aspect: W / H, free, screenH: H, ...(mode === 'object' ? { object: mesh } : { h }) });
  cam.position.set(...f.cam); cam.lookAt(new THREE.Vector3(...f.aim)); cam.updateMatrixWorld();
  const bb = new THREE.Box3().setFromObject(mesh); let tip = Infinity, base = -Infinity;
  for (let i = 0; i < 8; i++) { const v = new THREE.Vector3(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z), y = (1 - v.project(cam).y) / 2 * H; (i & 2 ? (tip = Math.min(tip, y)) : (base = Math.max(base, y))); }
  const sheet = H * (1 - (free.bottom || 0)), tag = `${sh}/${mode} ${W}x${H} ${JSON.stringify(free)} h${h}`;
  console.log(`${tag}: bbox tip ${tip.toFixed(1)} px, base ${base.toFixed(1)} px (sheet ${sheet.toFixed(0)}), fill ${((base - tip) / H * 100).toFixed(1)}%`);
  ok(tip >= 48 - 0.5, `${tag}: bbox tip ${tip.toFixed(1)} px >= 48`); ok(base <= sheet - 1, `${tag}: bbox base ${base.toFixed(1)} clears sheet`); ok((base - tip) / H > 0.55, `${tag}: still fills > 55%`);
}
console.log(`showroom_frame: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

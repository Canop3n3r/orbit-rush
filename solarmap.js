// Orbit Rush 3D map (Milestone A): the whole solar system at full scale, drawn with a camera-relative floating
// origin (all positions are float64 heliocentric J2000-ecliptic metres; only "position − camera focus" reaches
// the GPU) and a logarithmic depth buffer, so low Earth orbit and Neptune share one view without jitter.
// Orbit camera: quaternion trackball (any angle, pole-down or edge-on, no gimbal lock), smooth zoom, pan,
// focus with smooth transitions. Lines are drawn twice: depth-tested (bright) and through bodies (faint).
// Markers and node handles are HTML (crisp, finger-sized). Mouse and touch.
import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import * as GX from './gfx/gfx.js?v=f5.6o';
import * as P from './physics.js?v=f5.6o';
import * as C from './physics/patched.js?v=f5.6o';
import { fmtDur } from './flight.js?v=f5.6o';
import { layoutHandles } from './maplayout.js?v=f5.6o';
const V = P.V, B = P.BODIES, $ = id => document.getElementById(id);
const IDS = Object.keys(B), PLANETS = IDS.filter(id => B[id].parent === 'sun');
const fmtD = m => { const a = Math.abs(m); return a >= 1.496e10 ? (m / P.AU).toFixed(3) + ' AU' : a >= 1e7 ? (m / 1e3).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' km' : a >= 1e4 ? (m / 1e3).toFixed(1) + ' km' : m.toFixed(0) + ' m'; };
const fmtV = x => (Math.abs(x) >= 1000 ? (x / 1000).toFixed(2) + ' km/s' : x.toFixed(1) + ' m/s');
const mv = (F, x) => [F[0] * x[0] + F[1] * x[1] + F[2] * x[2], F[3] * x[0] + F[4] * x[1] + F[5] * x[2], F[6] * x[0] + F[7] * x[1] + F[8] * x[2]];
const PATCH_COL = [0x7dffa6, 0xffb35c, 0xc89cff, 0x6ad8ff, 0xff7ab0];

export function createSolarMap(opts) {
  const { renderer, getF, toast, touch, earthMap, onChange, dvTable, settings, gfxQ = 'med', getSats = () => [] } = opts;
  const sunPosU = uniform(new THREE.Vector3());
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x01020a);
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 1, 1e15);
  const sunLight = new THREE.PointLight(0xffffff, 3, 0, 0); scene.add(sunLight); scene.add(new THREE.AmbientLight(0x404858, 0.35));
  // ---------- stars (fixed directions, follow the camera) ----------
  { const n = 2400, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const z = Math.random() * 2 - 1, a = Math.random() * 6.283, s = Math.sqrt(1 - z * z); pos.set([s * Math.cos(a), s * Math.sin(a), z], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var mw = new THREE.Mesh(new THREE.SphereGeometry(1e14, 48, 24), new THREE.MeshBasicMaterial({ map: GX.tex('milkyway', gfxQ), color: new THREE.Color(1.1, 1.1, 1.2), side: THREE.BackSide, depthWrite: false })); mw.rotation.set(1.1, 0.4, 0.2); mw.frustumCulled = false; scene.add(mw);
    var stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xaab4d0, size: 1, sizeAttenuation: false, depthWrite: false })); stars.frustumCulled = false; scene.add(stars); }
  // ---------- bodies ----------
  const sphere = new THREE.SphereGeometry(1, 64, 32); sphere.rotateX(Math.PI / 2);
  const earthSphere = new THREE.SphereGeometry(1, 96, 48); earthSphere.rotateX(Math.PI / 2); earthSphere.applyMatrix4(GX.earthTexMatrix()); let earthAtmo = null; // poles on ±z (body frames have z = pole)
  const dotGeo = new THREE.SphereGeometry(1, 12, 8);
  const bodies = {};
  for (const id of IDS) {
    const b = B[id], tn = GX.BODY_TEX[id];
    const mat = id === 'sun' ? new THREE.MeshBasicMaterial({ map: GX.tex('sun', gfxQ), color: new THREE.Color(4, 3.4, 2.6) })
      : id === 'earth' ? GX.earthMaterial(gfxQ, sunPosU)
      : (() => { const tx = tn ? GX.tex(tn, gfxQ) : GX.bodyTexture(b.color, id.length * 7 + id.charCodeAt(0)); return new THREE.MeshStandardMaterial({ map: tx, emissiveMap: tx, emissive: 0x2a2a2a, roughness: 0.95, metalness: 0 }); })(); // f5.4j: a dim night side, so a craft over the dark half is visibly over the world (Aaron's Mars report)
    const m = new THREE.Mesh(id === 'earth' ? earthSphere : sphere, mat);
    if (id === 'earth') { const cl = new THREE.Mesh(earthSphere, GX.cloudMaterial(gfxQ, sunPosU)); cl.scale.setScalar(1.002); m.add(cl);
      const am = GX.atmoMaterial({ R: 1, Ra: 1.02 }); const at = new THREE.Mesh(sphere, am); at.frustumCulled = false; scene.add(at); earthAtmo = { m: at, u: am.userData }; }
    if (id === 'sun') { const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: GX.glowTexture(), color: new THREE.Color(3, 2.6, 2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); gl.scale.setScalar(5); m.add(gl); } m.frustumCulled = false; scene.add(m);
    const dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: b.color })); dot.frustumCulled = false; scene.add(dot);
    const lab = document.createElement('div'); lab.className = 'mlab ' + b.kind; lab.textContent = b.name; lab.dataset.id = id;
    bodies[id] = { m, dot, lab, abs: [0, 0, 0], line: null };
    if (id !== 'sun') bodies[id].line = makeLine(b.kind === 'moon' ? 0x5a6a88 : 0x4a5c7c, 257);
    if (id === 'saturn') { const rg = new THREE.RingGeometry(1.24, 2.27, 128, 2); { const pa = rg.attributes.position, uvA = rg.attributes.uv; for (let i = 0; i < pa.count; i++) { const r = Math.hypot(pa.getX(i), pa.getY(i)); uvA.setXY(i, (r - 1.24) / (2.27 - 1.24), 0.5); } }
      const rt = GX.tex('saturn_ring', gfxQ); const rm = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ map: rt, alphaMap: null, transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 1, metalness: 0 })); m.add(rm); }
  }
  const craftDot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xff9a3c, depthTest: false })); craftDot.renderOrder = 20; craftDot.frustumCulled = false; scene.add(craftDot);
  // a line drawn twice: bright and depth-tested, faint where hidden behind a body
  function makeLine(color, n) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); geo.setDrawRange(0, 0);
    const a = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }));
    const b = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.22, depthTest: false, depthWrite: false }));
    a.frustumCulled = b.frustumCulled = false; b.renderOrder = 5; scene.add(a); scene.add(b);
    return { geo, a, b, n, set(visible) { a.visible = b.visible = visible; }, color(c) { a.material.color.setHex(c); b.material.color.setHex(c); } };
  }
  const traj = PATCH_COL.map(c => makeLine(c, 241)), satLines = [];
  const W_T = (o, mu) => { const r = Math.hypot(...o.r), v2 = o.v[0] ** 2 + o.v[1] ** 2 + o.v[2] ** 2, a = 1 / (2 / r - v2 / mu); return 2 * Math.PI * Math.sqrt(a * a * a / mu); };
  // ---------- DOM ----------
  const ui = document.createElement('div'); ui.id = 'mapUI'; ui.className = 'hidden';
  ui.innerHTML = `<div id="mapLabels"></div>
  <div id="mapBar">
    <button data-a="prev" title="Previous focus ([ or Shift+Tab)">◀</button><span id="mapFocus">Craft</span><button data-a="next" title="Next focus (] or Tab)">▶</button>
    <button data-a="node" title="Add a maneuver node 10 minutes ahead (or tap the trajectory)">◆ Node</button><button data-a="warp" title="Warp to the next event">⏩</button>
    <button data-a="more" title="More: views, planner, alarms, Δv, body info">⋯</button><button data-a="close" title="Back to flight (M)">✕</button>
  </div>
  <div id="mapMore" class="hidden">
    <button data-a="craft">Craft</button><button data-a="pole">Top view</button><button data-a="edge">Edge view</button><button data-a="reset">Reset view</button>
    <button data-a="plan">Planner</button><button data-a="alarms">⏰ Alarms</button><button data-a="dv">Δv map</button><button data-a="info">Body info</button>
    <button data-a="conic" title="Patched conics drawing: each patch relative to its own body, or a moon's patches as seen from its planet">⊙ ${(settings && settings.conic) === 'parent' ? 'Parent' : 'Body'}</button>
  </div>
  <div id="mapPanel" class="hidden"></div>
  <div id="mapInfo"></div><div id="mapTrack" class="hidden"></div>`;
  document.body.appendChild(ui);
  const labels = ui.querySelector('#mapLabels'), panel = ui.querySelector('#mapPanel'), info = ui.querySelector('#mapInfo');
  for (const id of IDS) labels.appendChild(bodies[id].lab);
  const craftLab = document.createElement('div'); craftLab.className = 'mlab craft'; craftLab.textContent = '▲ craft'; craftLab.dataset.id = 'craft'; labels.appendChild(craftLab);
  const markerPool = []; let markerN = 0;
  function marker(text, cls) { let d = markerPool[markerN]; if (!d) { d = document.createElement('div'); labels.appendChild(d); markerPool.push(d); } markerN++; d.className = 'mmark ' + (cls || ''); if (d.textContent !== text) d.textContent = text; d.style.display = ''; return d; }
  const handles = ['pro', 'ret', 'nrm', 'anti', 'rad', 'radin'].map(k => { const d = document.createElement('div'); d.className = 'mhandle h-' + k; d.dataset.h = k; d.textContent = { pro: '⊕', ret: '⊗', nrm: '▲', anti: '▼', rad: '◉', radin: '◎' }[k]; labels.appendChild(d); return d; });
  // ---------- state ----------
  const PITCH0 = 33 * Math.PI / 180; // f3: default view, 33° above the ecliptic, north up
  const S = { yaw: 0, yawT: 0, pitch: PITCH0, pitchT: PITCH0, pitch0: PITCH0, idle: 0, conic: (settings && settings.conic) || 'body', on: false, focus: 'craft', dist: 3e7, distT: 3e7, q: new THREE.Quaternion(), pan: [0, 0, 0], trans: null, sel: null, panelMode: null, plan: null, planTarget: null, pred: null, predT: 0, predKey: '', W: innerWidth, H: innerHeight, lastClick: 0 };
  // the camera is yaw (about ecliptic north, +z) and pitch (elevation above the plane): never rolls, never flips
  const NORTH = new THREE.Vector3(0, 0, 1), _m4 = new THREE.Matrix4(), _o = new THREE.Vector3();
  function applyYP() { S.pitch = Math.max(4 * Math.PI / 180, Math.min(88 * Math.PI / 180, S.pitch)); const cp = Math.cos(S.pitch);
    const back = new THREE.Vector3(cp * Math.cos(S.yaw), cp * Math.sin(S.yaw), Math.sin(S.pitch)); _m4.lookAt(back, _o.set(0, 0, 0), NORTH); S.q.setFromRotationMatrix(_m4); }
  function sunYaw() { // sun lit from the side: look across the sun line
    const f = focusAbs(), d = [-f[0], -f[1]]; return Math.hypot(d[0], d[1]) > 1 ? Math.atan2(d[1], d[0]) + Math.PI / 2 : 0.6; }
  function resetView() { S.yawT = sunYaw(); S.pitchT = PITCH0; S.pan = [0, 0, 0]; S.distT = niceDist(S.focus); S.idle = 99; }
  applyYP();
  const tNow = () => getF().tAbs;
  function craftAbs(t = tNow()) { const F = getF(), v = F.v, b = F.body, s = P.absState(b, t); return V.add(s.r, mv(P.frameOf(b), v.r)); }
  function bodyAbs(id, t = tNow()) { return P.absState(id, t).r; }
  function focusAbs(id = S.focus, t = tNow()) { return id === 'craft' ? craftAbs(t) : bodyAbs(id, t); }
  function focusList() {
    const F = getF(), cur = F.body, l = ['craft', cur]; if (F.target && !l.includes(F.target)) l.push(F.target);
    for (const c of B[cur].children) if (!l.includes(c)) l.push(c);
    if (B[cur].parent && !l.includes(B[cur].parent)) l.push(B[cur].parent);
    for (const id of ['sun', ...PLANETS]) if (!l.includes(id)) l.push(id); return l;
  }
  function niceDist(id) { if (id === 'craft') { const F = getF(); return Math.max(B[F.body].R * 3.2, Math.min(V.len(F.v.r) * 2.6, 3e9)); } return id === 'sun' ? 1.2e12 : B[id].R * 4; }
  function setFocus(id, quiet) {
    if (id === S.focus) { S.distT = niceDist(id); return; }
    const from = V.add(focusAbs(S.focus), S.pan); S.focus = id; S.pan = [0, 0, 0];
    S.trans = { from: V.sub(from, focusAbs(id)), k: 1 }; S.distT = niceDist(id);
    $('mapFocus').textContent = id === 'craft' ? 'Craft' : B[id].name; if (!quiet) onChange && onChange('focus', id);
  }
  function cycle(d) { const l = focusList(), i = l.indexOf(S.focus); setFocus(l[(i + d + l.length) % l.length]); }
  // view presets: 'pole' (down onto the focus body's orbit/equator plane), 'edge' (in that plane), or a quaternion
  function refNormal() { const F = getF(); if (S.focus === 'craft') { const n = V.norm(V.cross(F.v.r, F.v.v)); return mv(P.frameOf(F.body), n); } if (S.focus === 'sun') return [0, 0, 1]; const s = P.relState(S.focus, tNow()), pf = P.frameOf(B[S.focus].parent); return mv(pf, V.norm(V.cross(s.r, s.v))); }
  function setView(kind, tilt = 0) {
    const n = refNormal(), N = new THREE.Vector3(...n);
    if (kind === 'pole') { S.pitchT = 88 * Math.PI / 180; S.idle = -1e9; return; }
    if (kind === 'edge') { S.pitchT = 5 * Math.PI / 180; S.idle = -1e9; return; }
    if (kind === 'pole0') { const back = N.clone(); const up = Math.abs(N.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0); const m = new THREE.Matrix4().lookAt(back, new THREE.Vector3(), up.cross(back).cross(back).negate().normalize()); S.q.setFromRotationMatrix(m); }
    else if (kind === 'edge') { const side = new THREE.Vector3(1, 0, 0).cross(N); if (side.lengthSq() < 1e-6) side.set(0, 1, 0); side.normalize(); const back = side.clone().applyAxisAngle(N, 0.4).multiplyScalar(Math.cos(tilt)).addScaledVector(N, Math.sin(tilt)).normalize(); const m = new THREE.Matrix4().lookAt(back, new THREE.Vector3(), N); S.q.setFromRotationMatrix(m); }
  }
  // ---------- input ----------
  const ptrs = new Map(); let drag = null, moved = 0, downAt = null;
  const el = renderer.domElement;
  function zoomBy(f) { S.distT = Math.min(3e13, Math.max(minDist(), S.distT * f)); }
  function minDist() { return S.focus === 'craft' ? 2000 : B[S.focus].R * 1.15; }
  el.addEventListener('wheel', e => { if (!S.on) return; zoomBy(Math.exp(e.deltaY * 0.0015)); }, { passive: true });
  el.addEventListener('contextmenu', e => { if (S.on) e.preventDefault(); });
  el.addEventListener('pointerdown', e => { if (!S.on) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; downAt = [e.clientX, e.clientY]; drag = e.button === 2 || e.shiftKey ? 'pan' : 'rot'; });
  addEventListener('pointerup', e => {
    if (!S.on || !ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId);
    if (hdrag && hdrag.id === e.pointerId) { hdrag = null; return; }
    if (moved < 6 && downAt && e.target === el && ptrs.size === 0) click(e.clientX, e.clientY);
  });
  addEventListener('pointercancel', e => ptrs.delete(e.pointerId));
  addEventListener('pointermove', e => {
    if (!S.on) return;
    if (hdrag && hdrag.id === e.pointerId) { handleMove(e); return; }
    if (!ptrs.has(e.pointerId)) return; const [px, py] = ptrs.get(e.pointerId), dx = e.clientX - px, dy = e.clientY - py; moved += Math.abs(dx) + Math.abs(dy);
    if (ptrs.size === 1) {
      if (drag === 'rot') { S.yaw -= dx * 0.006; S.pitch += dy * 0.006; S.yawT = S.yaw; S.pitchT = S.pitch; S.idle = 0; applyYP(); } else panBy(dx, dy);
    } else if (ptrs.size === 2) {
      let o; for (const [id, q] of ptrs) if (id !== e.pointerId) o = q;
      const d0 = Math.hypot(px - o[0], py - o[1]), d1 = Math.hypot(e.clientX - o[0], e.clientY - o[1]); zoomBy(d0 / Math.max(d1, 1)); panBy(dx / 2, dy / 2);
    }
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  });
  function panBy(dx, dy) { const k = S.dist * 2 * Math.tan(25 * Math.PI / 180) / S.H, r = new THREE.Vector3(1, 0, 0).applyQuaternion(S.q), u = new THREE.Vector3(0, 1, 0).applyQuaternion(S.q); S.pan = V.add(S.pan, [(-dx * r.x + dy * u.x) * k, (-dx * r.y + dy * u.y) * k, (-dx * r.z + dy * u.z) * k]); }
  labels.addEventListener('pointerdown', e => {
    const t = e.target; if (!S.on) return;
    if (t.dataset.h) { e.preventDefault(); e.stopPropagation(); t.setPointerCapture && t.setPointerCapture(e.pointerId); hdrag = { id: e.pointerId, h: t.dataset.h, x: e.clientX, y: e.clientY, fine: e.shiftKey }; ptrs.set(e.pointerId, [e.clientX, e.clientY]); return; }
  });
  labels.addEventListener('click', e => {
    const t = e.target; if (!S.on) return;
    if (t.dataset.node !== undefined) { selectNode(getF().nodes[+t.dataset.node]); return; }
    const id = t.dataset.id; if (!id) return; const now = performance.now();
    setFocus(id); S.lastClick = now; S.lastId = id;
  });
  el.addEventListener('dblclick', e => { if (S.on) { let hitB = false; for (const id of IDS) { const p = bodies[id].scr; if (p && p.z < 1 && Math.hypot(p.x - e.clientX, p.y - e.clientY) < Math.max(18, p.r + 6)) hitB = true; } if (!hitB) resetView(); } });
  labels.addEventListener('dblclick', e => { const id = e.target.dataset.id; if (id) setFocus(id); });
  // click / tap on the scene: double = focus the nearest body; single on the trajectory = add a node there
  function click(x, y) {
    const now = performance.now(), dbl = now - S.lastClick < 350; S.lastClick = now;
    let best = null; for (const id of IDS) { const p = bodies[id].scr; if (p && p.z < 1) { const d = Math.hypot(p.x - x, p.y - y); if (d < Math.max(18, p.r + 6) && (!best || d < best.d)) best = { id, d }; } }
    if (craftScr && Math.hypot(craftScr.x - x, craftScr.y - y) < 18) best = { id: 'craft', d: 0 };
    if (best) { setFocus(best.id); return; }
    if (dbl) { resetView(); return; }
    const hit = pickTraj(x, y); if (hit) { addNodeAt(hit.t); return; }
  }
  // ---------- nodes ----------
  let hdrag = null;
  function curPatchEnd() { const pr = S.pred; return pr && pr.patches[0] ? pr.patches[0].t1 : Infinity; }
  function addNodeAt(t) {
    const F = getF();
    const n = F.addNode({ t: Math.max(t, F.tAbs + 60) }); selectNode(n); S.predKey = '';
    const pa = patchAt(n.t); toast(pa && pa.body !== F.body ? `Maneuver node added in ${B[pa.body].name}'s SOI — drag the handles or type Δv` : 'Maneuver node added — drag the handles or type Δv', '#9cc3ff');
  }
  function selectNode(n) { S.sel = n; S.panelMode = n ? 'node' : null; renderPanel(); }
  // the predicted patch the craft is on at time t (a node's patch is the one ending at it: the state before its burn)
  function patchAt(t, n) { const pr = S.pred; if (!pr) return null; if (n) { const e = pr.patches.find(p => p.end.node === n); if (e) return e; } return pr.patches.find(p => p.t0 <= t + 1e-6 && t <= p.t1 + 1e-6) || null; }
  function nodeState(n) { const F = getF(), v = F.v, pa = patchAt(n.t, n);
    if (!pa) { const s = P.propagate(v.r, v.v, n.t - F.tAbs, P.muOf(v)); return { ...s, body: F.body, pa: null }; }
    const s = P.propagate(pa.r0, pa.v0, n.t - pa.t0, B[pa.body].mu); return { ...s, body: pa.body, pa }; }
  // where a body-frame position r of patch pa (at game time tm) is drawn, in the current conic mode
  function patchPos(pa, r, tm) { const Fb = P.frameOf(pa.body), b = B[pa.body];
    if (S.conic === 'parent' && b.kind === 'moon' && b.parent && b.parent !== 'sun') { const Fp = P.frameOf(b.parent); return V.add(V.add(bodies[b.parent].rel, mv(Fp, P.relState(pa.body, tm).r)), mv(Fb, r)); }
    return V.add(bodies[pa.body].rel, mv(Fb, r)); }
  function handleMove(e) {
    const n = S.sel; if (!n || !hdrag) return; const hs = hdrag.scr; if (!hs) return;
    const dx = e.clientX - hdrag.x, dy = e.clientY - hdrag.y; hdrag.x = e.clientX; hdrag.y = e.clientY;
    const along = (dx * hs.ux + dy * hs.uy), rate = (hdrag.fine || e.shiftKey ? 0.05 : 0.5) * (1 + Math.min(4, Math.abs(along) / 8));
    const k = { pro: ['pro', 1], ret: ['pro', -1], nrm: ['nrm', 1], anti: ['nrm', -1], rad: ['rad', 1], radin: ['rad', -1] }[hdrag.h];
    n[k[0]] += k[1] * along * rate; n.started = false; S.predKey = ''; renderPanel(true);
  }
  // ---------- planner ----------
  function runPlanner(target) {
    const F = getF(), v = F.v; S.planTarget = target; S.plan = { busy: true }; renderPanel();
    setTimeout(() => {
      const t0 = performance.now(); let pl = null; try { pl = C.planFull(F.body, v.r, v.v, F.tAbs, target, { burn: F.burnModel(), minWait: 600 }); } catch (e) { console.warn(e); }
      S.plan = pl ? { ...pl, ms: performance.now() - t0 } : { none: true }; renderPanel();
    }, 30);
  }
  function plannerTargets() { const F = getF(), b = F.body, l = []; for (const c of B[b].children) l.push(c); if (B[b].parent && B[b].parent !== 'sun') {} if (B[b].parent === 'sun') for (const p of PLANETS) if (p !== b) l.push(p); return l; }
  // ---------- panel ----------
  function showBody(id) { S.panelMode = 'body'; S.bodyId = id; renderPanel(); }
  function renderPanel(soft) {
    const F = getF(); panel.classList.toggle('hidden', !S.panelMode); document.body.classList.toggle('mapPanelOn', !!S.panelMode); panel.dataset.mode = S.panelMode || '';
    if (S.panelMode === 'node' && S.sel && F.nodes.includes(S.sel)) {
      const n = S.sel, dv = C.nodeDv(n), bt = F.nodeBurnTime(n), i = F.nodes.indexOf(n);
      if (soft && panel.querySelector('#nPro')) { for (const k of ['pro', 'nrm', 'rad']) { const inp = panel.querySelector('#n' + k[0].toUpperCase() + k.slice(1)); if (document.activeElement !== inp) inp.value = n[k].toFixed(1); } panel.querySelector('#nSum').innerHTML = nodeSum(n); return; }
      panel.innerHTML = `<h4>◆ Maneuver ${i + 1}/${F.nodes.length}</h4>
        ${['pro', 'nrm', 'rad'].map(k => `<div class="nrow"><span class="nk h-${k}">${{ pro: 'Prograde', nrm: 'Normal', rad: 'Radial' }[k]}</span><button data-d="${k}:-10">−10</button><button data-d="${k}:-1">−1</button><input id="n${k[0].toUpperCase() + k.slice(1)}" data-k="${k}" type="number" step="0.1" value="${n[k].toFixed(1)}"><button data-d="${k}:1">+1</button><button data-d="${k}:10">+10</button></div>`).join('')}
        <div class="nrow"><span class="nk">Time</span><button data-t="-600">−10m</button><button data-t="-60">−1m</button><button data-t="60">+1m</button><button data-t="600">+10m</button><button data-t="orbit">+orbit</button></div>
        <div id="nSum">${nodeSum(n)}</div>
        <div class="nrow"><button data-a2="exec" class="go">▶ Execute (AUTO)</button><button data-a2="sas">SAS MANEUVER</button><button data-a2="warpn">⏩ Warp to burn</button></div>
        <div class="nrow"><button data-a2="del" class="bad">Delete node</button>${F.nodes.length > 1 ? '<button data-a2="nextn">Next node</button>' : ''}<button data-a2="closep">Close</button></div>`;
    } else if (S.panelMode === 'plan') {
      const pl = S.plan, tg = S.planTarget, ts = plannerTargets();
      let h = `<h4>Transfer planner</h4><div class="nrow">${ts.map(id => `<button data-pt="${id}" class="${id === tg ? 'on' : ''}">${B[id].name}</button>`).join('') || '<i>No transfer targets from here</i>'}</div>`;
      if (pl && pl.busy) h += '<p>Planning… (Hohmann window, Lambert solve, tuning the node for this engine)</p>';
      else if (pl && pl.none) h += '<p class="bad">No transfer from this orbit.</p>';
      else if (pl && pl.tuned) {
        const H = pl.hohmann, dl = pl.tuned.t - F.tAbs;
        h += `<div class="pl"><b>${B[tg].name}</b> · Hohmann Δv ${fmtV(Math.abs(pl.kind === 'moon' ? H.dv1 : pl.ejection))} + ${fmtV(Math.abs(H.dv2))} capture · transfer ${fmtDur(H.tt)}<br>
          Phase angle now <b>${(pl.phaseNow * 180 / Math.PI).toFixed(1)}°</b>, needed <b>${(pl.phaseReq * 180 / Math.PI).toFixed(1)}°</b> · window in <b>${fmtDur(pl.wait)}</b>${pl.syn ? ` (every ${fmtDur(pl.syn)})` : ''}<br>
          <span class="good">Tuned burn (default): ${fmtV(pl.tunedDv)}</span> in ${fmtDur(dl)} → ${pl.reaches ? `periapsis ${fmtD(pl.ca.alt)} at ${B[tg].name}` : `closest ${fmtD(pl.ca.d)}`}<br>
          ${pl.exact ? `Exact asymptote (Lambert, v∞ ${fmtV(pl.exactInfo.vinf)}): ${fmtV(pl.exactDv)} from this orbit plane<br>` : ''}
          Best parking-orbit inclination: <b>${pl.incl.toFixed(1)}°</b> (now ${(P.orbitOf(F.v).inc * 180 / Math.PI).toFixed(1)}°) — set it in the hangar (Launch inclination) and AUTO flies the matching azimuth.</div>
          <div class="nrow"><button data-a2="usetuned" class="go">◆ Create tuned node</button>${pl.exact ? '<button data-a2="useexact">◆ Exact (Lambert)</button>' : ''}<button data-a2="alarm">⏰ Alarm at window</button></div>`;
      }
      const tgt = F.target; h += `<div class="nrow"><button data-a2="fix" title="Small correction burn to hit ${tgt ? B[tgt].name : 'the target'} (after the main burn)">Fix encounter</button><button data-a2="closep">Close</button></div>`;
      panel.innerHTML = h;
    } else if (S.panelMode === 'alarms') {
      const al = F.alarms;
      panel.innerHTML = `<h4>⏰ Alarms</h4><div class="pl">${al.length ? al.map((a, i) => `<div class="nrow"><span style="flex:1">${a.label} · in <b>${fmtDur(a.t - F.tAbs)}</b></span><button data-al="${i}" class="bad" title="Delete">✕</button></div>`).join('') : '<i>No alarms. Warp stops at an alarm.</i>'}</div>
        <div class="nrow"><button data-aa="node">Before next node</button><button data-aa="soi">At SOI change</button><button data-aa="ap">At Ap</button><button data-aa="pe">At Pe</button></div>
        <div class="nrow"><button data-aa="600">+10 min</button><button data-aa="3600">+1 h</button><button data-aa="86400">+1 day</button><button data-aa="w">+1 week</button><button data-a2="closep">Close</button></div>`;
    } else if (S.panelMode === 'dv') {
      panel.innerHTML = `<h4>Δv map</h4>${dvTable ? dvTable(F) : ''}<div class="nrow"><button data-a2="closep">Close</button></div>`;
    } else if (S.panelMode === 'body') {
      const id = S.bodyId, b = B[id], F2 = F; const atm = b.atm ? (b.atm === 'ussa76' ? 'air (USSA76)' : `${b.atm.name || 'atmosphere'}, top ${fmtD(P.atmTop(id))}`) : 'none';
      panel.innerHTML = `<h4>${b.name}</h4><div class="pl">Radius ${fmtD(b.R)} · GM ${b.mu.toExponential(3)} m³/s²<br>${b.parent ? `SOI ${fmtD(b.soi)} · orbit ${fmtD(b.a)} · period ${fmtDur(b.period)}<br>` : ''}Day ${fmtDur(Math.abs(2 * Math.PI / b.omega))}${b.omega < 0 ? ' (retrograde)' : ''} · tilt ${b.tilt.toFixed(1)}° · atmosphere ${atm}</div>
        <div class="nrow"><button data-a2="focusb">Focus</button>${id !== F2.body ? `<button data-a2="target" class="${F2.target === id ? 'on' : ''}">${F2.target === id ? '✓ Target' : 'Set target'}</button>` : ''}${plannerTargets().includes(id) ? '<button data-a2="planb">Plan transfer</button>' : ''}<button data-a2="closep">Close</button></div>`;
    } else panel.innerHTML = '';
  }
  function nodeSum(n) { const F = getF(), dv = C.nodeDv(n), bt = F.nodeBurnTime(n), dt = n.t - F.tAbs; return `Δv <b>${fmtV(dv)}</b> · burn ${fmtDur(bt)} · in <b>${fmtDur(dt)}</b> (start ${fmtDur(dt - bt / 2)})${S.res ? `<br>After: ${S.res}` : ''}`; }
  panel.addEventListener('click', e => {
    const t = e.target, F = getF(), n = S.sel;
    if (t.dataset.d && n) { const [k, d] = t.dataset.d.split(':'); n[k] += +d; n.started = false; S.predKey = ''; renderPanel(true); return; }
    if (t.dataset.t && n) { const o = P.orbitOf(F.v); n.t += t.dataset.t === 'orbit' ? (isFinite(o.T) ? o.T : 3600) : +t.dataset.t; n.t = Math.max(n.t, F.tAbs + 30); F.nodes.sort((a, b) => a.t - b.t); S.predKey = ''; renderPanel(true); return; }
    if (t.dataset.pt) { runPlanner(t.dataset.pt); return; }
    if (t.dataset.al !== undefined) { F.removeAlarm(F.alarms[+t.dataset.al]); renderPanel(); return; }
    if (t.dataset.aa) { addAlarmKind(t.dataset.aa); renderPanel(); return; }
    const a = t.dataset.a2; if (!a) return;
    if (a === 'closep') { S.panelMode = null; renderPanel(); }
    if (a === 'del' && n) { F.removeNode(n); S.sel = F.nodes[0] || null; S.panelMode = S.sel ? 'node' : null; S.predKey = ''; renderPanel(); }
    if (a === 'nextn') { const i = F.nodes.indexOf(n); selectNode(F.nodes[(i + 1) % F.nodes.length]); }
    if (a === 'exec') { F.setExec(true); onChange && onChange('exec'); }
    if (a === 'sas') { F.setSAS('node'); }
    if (a === 'warpn') { if (F.nodes[0] !== n) toast('Warping to the first node', '#9cc3ff'); F.warpToNode(); }
    if (a === 'usetuned' || a === 'useexact') { const pl = S.plan; const nn = F.addNode(a === 'usetuned' ? pl.tuned : pl.exact); if (!F.target) F.target = S.planTarget; selectNode(nn); S.predKey = ''; }
    if (a === 'alarm' && S.plan && S.plan.tuned) { F.addAlarm(S.plan.tuned.t - F.nodeBurnTime(S.plan.tuned) / 2 - 600, `${B[S.planTarget].name} window in 10 min`); toast('Alarm set: 10 min before the burn', '#9cc3ff'); }
    if (a === 'fix') { const tg = F.target || S.planTarget; if (!tg) { toast('Set a target first', '#ffb35c'); return; } const v = F.v; const cn = C.correctionNode(F.body, v.r, v.v, F.tAbs, tg, { peAlt: tg === 'moon' ? 100000 : 300000, tol: tg === 'moon' ? 60000 : 3e6 }); if (cn) { const nn = F.addNode(cn.node); selectNode(nn); toast(`Correction ${fmtV(cn.dv)}${cn.good ? '' : ' (best found — not a clean encounter)'}`, cn.good ? '#7dffa6' : '#ffb35c'); S.predKey = ''; } }
    if (a === 'focusb') setFocus(S.bodyId);
    if (a === 'target') { F.target = F.target === S.bodyId ? null : S.bodyId; renderPanel(); S.predKey = ''; }
    if (a === 'planb') { S.panelMode = 'plan'; runPlanner(S.bodyId); }
  });
  panel.addEventListener('change', e => { const t = e.target, n = S.sel; if (t.dataset.k && n) { const x = parseFloat(t.value); if (isFinite(x)) { n[t.dataset.k] = x; n.started = false; S.predKey = ''; renderPanel(true); } } });
  const barClick = e => {
    const a = e.target.dataset.a, F = getF(); if (!a) return; e.target.blur(); const mm = ui.querySelector('#mapMore');
    if (a === 'more') { mm.classList.toggle('hidden'); return; } if (mm.contains(e.target) && a !== 'conic') mm.classList.add('hidden');
    if (a === 'reset') resetView(); if (a === 'info') showBody(S.focus === 'craft' ? F.body : S.focus);
    if (a === 'prev') cycle(-1); if (a === 'next') cycle(1); if (a === 'craft') setFocus('craft');
    if (a === 'pole') setView('pole'); if (a === 'edge') setView('edge');
    if (a === 'zin') zoomBy(0.5); if (a === 'zout') zoomBy(2);
    if (a === 'node') addNodeAt(F.tAbs + 600);
    if (a === 'plan') { S.panelMode = S.panelMode === 'plan' ? null : 'plan'; if (S.panelMode === 'plan' && !S.plan) { const ts = plannerTargets(); if (ts.length) runPlanner(F.target && ts.includes(F.target) ? F.target : ts[0]); } renderPanel(); }
    if (a === 'warp') warpNext();
    if (a === 'alarms' || a === 'dv') { S.panelMode = S.panelMode === a ? null : a; renderPanel(); }
    if (a === 'conic') { S.conic = S.conic === 'body' ? 'parent' : 'body'; e.target.textContent = S.conic === 'body' ? '⊙ Body' : '⊙ Parent'; if (S.pred) for (const p of S.pred.patches) p.ptsP = null; onChange && onChange('conic', S.conic); toast(S.conic === 'body' ? 'Patches drawn relative to their own body' : "A moon's patches drawn as seen from its planet", '#9cc3ff'); }
    if (a === 'close') onChange && onChange('close');
  };
  ui.querySelector('#mapBar').addEventListener('click', barClick); ui.querySelector('#mapMore').addEventListener('click', barClick);
  function addAlarmKind(k) {
    const F = getF(), v = F.v, mu = P.muOf(v); let at = null, label = '';
    if (k === 'node') { const n = F.nodes[0]; if (n) { at = n.t - F.nodeBurnTime(n) / 2 - 300; label = 'maneuver in 5 min'; } }
    else if (k === 'soi') { const ev = C.nextEvent(F.body, v.r, v.v, F.tAbs, 3e9, { stopAlt: 0 }); if (ev && /soi/.test(ev.type)) { at = F.tAbs + ev.dt - 600; label = (ev.type === 'soi-enter' ? B[ev.to].name + ' encounter' : 'SOI exit') + ' in 10 min'; } }
    else if (k === 'ap' || k === 'pe') { const dt = k === 'ap' ? P.timeToAp(v.r, v.v, mu) : C.timeToPe(v.r, v.v, mu); if (isFinite(dt)) { at = F.tAbs + dt - 60; label = (k === 'ap' ? 'apoapsis' : 'periapsis') + ' in 1 min'; } }
    else { const d = k === 'w' ? 7 * 86400 : +k; at = F.tAbs + d; label = fmtDur(d) + ' alarm'; }
    if (at === null || !(at > F.tAbs)) { toast('Nothing to set an alarm on', '#ffb35c'); return; }
    F.addAlarm(at, label); toast('⏰ Alarm set: ' + label, '#9cc3ff');
  }
  function warpNext() { const F = getF(); if (F.nodes.length) return F.warpToNode(); const v = F.v, ev = C.nextEvent(F.body, v.r, v.v, F.tAbs, 3e9, { stopAlt: 0 }); if (ev && (ev.type === 'soi-exit' || ev.type === 'soi-enter') && ev.dt < 4e8) return F.warpToSOI(); return F.warpToApsis(P.orbitOf(v).e < 1 ? 'ap' : 'pe'); }
  // ---------- per-frame ----------
  const tmpV = new THREE.Vector3(); let craftScr = null, trajPick = [];
  function project(rel) { tmpV.set(rel[0], rel[1], rel[2]).applyMatrix4(camera.matrixWorldInverse); const behind = tmpV.z > 0; tmpV.applyMatrix4(camera.projectionMatrix); return { x: (tmpV.x + 1) / 2 * S.W, y: (1 - tmpV.y) / 2 * S.H, z: behind ? 2 : tmpV.z, depth: -0 }; }
  function place(d, rel, dx = 0, dy = 0) { const p = project(rel); if (p.z > 1 || p.x < -50 || p.y < -50 || p.x > S.W + 50 || p.y > S.H + 50) { d.style.display = 'none'; return null; } d.style.display = ''; d.style.transform = `translate(${(p.x + dx).toFixed(1)}px,${(p.y + dy).toFixed(1)}px)`; return p; }
  // hidden behind a body (ray from the camera to the point crosses a body sphere)?
  function occluded(rel) { const cam = camRel; const d = V.sub(rel, cam), L = V.len(d), u = V.scale(d, 1 / L);
    for (const id of IDS) { const c = V.sub(bodies[id].rel, cam), tc = V.dot(c, u); if (tc <= 0 || tc >= L) continue; const R = B[id].R; if (V.dot(c, c) - tc * tc < R * R * 0.98) return true; } return false; }
  let camRel = [0, 0, 0];
  function update(rdt) {
    if (!S.on) return; const F = getF(), t = F.tAbs, v = F.v;
    S.W = innerWidth; S.H = innerHeight; camera.aspect = S.W / S.H;
    S.dist += (S.distT - S.dist) * Math.min(1, rdt * 8); S.dist = Math.max(minDist(), S.dist);
    if (S.trans) { S.trans.k = Math.max(0, S.trans.k - rdt * 3.3); if (S.trans.k <= 0) S.trans = null; }
    const ease = S.trans ? S.trans.k * S.trans.k * (3 - 2 * S.trans.k) : 0;
    const origin = V.add(V.add(focusAbs(), S.pan), S.trans ? V.scale(S.trans.from, ease) : [0, 0, 0]);
    // camera at the origin of the scene looking at -z of S.q; focus point at (0,0,0)
    { const nw = performance.now(); S.idle += Math.min(0.5, (nw - (S._lt || nw)) / 1000); S._lt = nw; } S.pitchT = Math.max(4 * Math.PI / 180, Math.min(88 * Math.PI / 180, S.pitchT)); if (S.idle > 1.5) S.pitchT = S.idle > 1e6 ? S.pitchT : PITCH0; // after a drag, ease back to the upright default (yaw kept)
    { const k = Math.min(1, Math.max(rdt, 0.05) * (S.idle > 50 ? 14 : 3)); let dy = S.yawT - S.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); S.yaw += dy * k; S.pitch += (S.pitchT - S.pitch) * k; if (S.idle > 50 && Math.abs(dy) + Math.abs(S.pitchT - S.pitch) < 1e-3) S.idle = 3; applyYP(); }
    const back = new THREE.Vector3(0, 0, 1).applyQuaternion(S.q).multiplyScalar(S.dist);
    camera.position.copy(back); camera.quaternion.copy(S.q); camera.near = Math.max(0.5, S.dist * 1e-4); camera.far = Math.max(1e13, S.dist * 1e3);
    { // keep the focus in the free part of the screen (not under the toolbar or the side panel)
      const pe = document.getElementById('mapPanel'), be = document.getElementById('mapBar'), pr = pe && !pe.classList.contains('hidden') ? pe.getBoundingClientRect() : null, br = be ? be.getBoundingClientRect() : null;
      const tx = pr && pr.left > S.W * 0.35 ? (S.W - pr.left) / 2 : 0, ty = pr && pr.left <= S.W * 0.35 && pr.top > S.H * 0.25 ? Math.min(S.H * 0.35, (S.H - pr.top) / 2) : br && br.height ? Math.min(S.H * 0.2, (S.H - br.top) / 2) : 0; // full-width panel (phone portrait): shift up
      S.vo = S.vo || [0, 0]; const k = Math.min(1, rdt * 6); S.vo[0] += (tx - S.vo[0]) * k; S.vo[1] += (ty - S.vo[1]) * k;
      if (Math.abs(S.vo[0]) + Math.abs(S.vo[1]) > 0.5) camera.setViewOffset(S.W, S.H, S.vo[0], S.vo[1], S.W, S.H); else camera.clearViewOffset();
    }
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    camRel = [back.x, back.y, back.z]; stars.position.copy(camera.position); stars.scale.setScalar(camera.far * 0.5);
    const pxK = 2 * Math.tan(25 * Math.PI / 180) / S.H;
    const sunRel = V.sub([0, 0, 0], origin); sunLight.position.set(...sunRel); sunPosU.value.set(...sunRel);
    if (mw) mw.position.copy(camera.position);
    for (const id of IDS) { const o = bodies[id]; o.abs = bodyAbs(id, t); o.rel = V.sub(o.abs, origin); }
    for (const id of IDS) {
      const o = bodies[id], b = B[id], abs = o.abs, rel = o.rel;
      o.m.position.set(...rel); o.m.scale.setScalar(b.R);
      if (id === 'earth' && earthAtmo) { earthAtmo.m.position.set(...rel); earthAtmo.m.scale.setScalar(b.R * 1.02); const u = earthAtmo.u; u.center.value.set(...rel); u.Rp.value = b.R; u.Ra.value = b.R * 1.02; const sd = V.norm(V.sub(sunRel, rel)); u.sunDir.value.set(...sd); }
      const Fm = P.frameOf(id), spin = id === 'earth' ? P.omegaOf(v) * (v.clock || 0) : P.spinAngle(id, t);
      const m4 = new THREE.Matrix4().set(Fm[0], Fm[1], Fm[2], 0, Fm[3], Fm[4], Fm[5], 0, Fm[6], Fm[7], Fm[8], 0, 0, 0, 0, 1).multiply(new THREE.Matrix4().makeRotationZ(spin));
      o.m.quaternion.setFromRotationMatrix(m4);
      const dc = V.len(V.sub(rel, camRel)), px = b.R / (dc * pxK);
      o.dot.visible = px < 2.5; o.dot.position.set(...rel); o.dot.scale.setScalar(dc * pxK * (b.kind === 'moon' ? 2 : 3));
      const showLab = b.kind !== 'moon' || [S.focus, F.body, F.target].includes(id) || [S.focus, F.body].includes(b.parent);
      const p = showLab ? place(o.lab, rel, 8, -8) : (o.lab.style.display = 'none', null);
      o.scr = p ? { x: p.x - 8, y: p.y + 8, z: p.z, r: px } : (() => { const q = project(rel); return q.z < 1 ? { x: q.x, y: q.y, z: q.z, r: px } : null; })();
      if (p) o.lab.classList.toggle('dim', occluded(rel) && id !== S.focus);
      o.lab.classList.toggle('tgt', F.target === id);
      // orbit line, centred on the body itself (precision where it matters), fading when zoomed far inside it
      if (o.line) {
        const show = b.a > S.dist * 0.004 && b.a < S.dist * 400 && (b.kind !== 'moon' || S.dist < b.a * 60);
        o.line.set(show); if (show) {
          const Fp = P.frameOf(b.parent);
          if (!o.pts || Math.abs(t - o.ptsT) > b.period / 500) { const st = P.relState(id, t), mu = B[b.parent].mu + b.mu, pts = []; for (let i = 0; i <= 256; i++) pts.push(mv(Fp, P.propagate(st.r, st.v, b.period * i / 256, mu).r)); o.pts = pts; o.ptsT = t; }
          const cur = mv(Fp, P.relState(id, t).r), arr = o.line.geo.attributes.position.array; // ring relative to the body itself: float32-exact near it
          for (let i = 0; i <= 256; i++) { const q = o.pts[i]; arr[i * 3] = q[0] - cur[0]; arr[i * 3 + 1] = q[1] - cur[1]; arr[i * 3 + 2] = q[2] - cur[2]; }
          o.line.geo.attributes.position.needsUpdate = true; o.line.geo.setDrawRange(0, 257); o.line.a.position.set(...rel); o.line.b.position.copy(o.line.a.position);
        }
      }
    }
    // craft
    const cRel = V.sub(craftAbs(t), origin), dcc = V.len(V.sub(cRel, camRel)); craftDot.position.set(...cRel); craftDot.scale.setScalar(dcc * pxK * 3.5);
    craftScr = place(craftLab, cRel, 8, -8);
    // trajectory prediction (every 0.25 s real, or when nodes changed)
    const key = F.nodes.map(n => [n.t, n.pro, n.nrm, n.rad].map(x => x.toFixed(2)).join(',')).join(';') + '|' + F.body + '|' + (F.target || '');
    S.predT -= rdt; if (!S.pred || S.predT <= 0 || key !== S.predKey) {
      S.predT = 0.25; S.predKey = key;
      try { S.pred = C.predict(F.body, v.r, v.v, t, { nodes: F.nodes, maxPatches: 5, samples: 240, stopAlt: 0 }); } catch (e) { S.pred = null; }
      S.ca = F.target && S.pred ? C.closestApproach(S.pred, F.target) : null;
      if (S.sel && S.pred) { const after = S.pred.patches.find(p => p.t0 >= S.sel.t - 1e-6) || S.pred.patches[S.pred.patches.length - 1]; const o = after.o, rb = B[after.body].R; S.res = `${B[after.body].name}: ${isFinite(o.ra) ? `Ap ${fmtD(o.ra - rb)} · ` : 'escape · '}Pe ${fmtD(o.rp - rb)} · inc ${(o.inc * 180 / Math.PI).toFixed(1)}°`; if (S.panelMode === 'node') renderPanel(true); }
    }
    markerN = 0; trajPick = [];
    const pr = S.pred;
    traj.forEach((L, i) => {
      const pa = pr && pr.patches[i]; L.set(!!pa); if (!pa) return;
      const babs = bodies[pa.body].abs, Fb = P.frameOf(pa.body), arr = L.geo.attributes.position.array, n = Math.min(pa.pts.length, L.n), rel0 = V.sub(babs, origin);
      const tD = pa.o.e < 1 ? Math.min(pa.t1 - pa.t0, pa.o.T) : pa.t1 - pa.t0, par = B[pa.body].parent, asParent = S.conic === 'parent' && par && par !== 'sun' && B[pa.body].kind === 'moon';
      // patched-conics convention: the path is drawn relative to the body's CURRENT position ('body'), or for a
      // moon's patch as it moves with the moon around its planet ('parent' mode)
      if (asParent) { if (!pa.ptsP) { const Fp = P.frameOf(par); pa.ptsP = pa.pts.map((q, k) => V.add(mv(Fp, P.relState(pa.body, pa.t0 + tD * k / (pa.pts.length - 1)).r), mv(Fb, q))); }
        const o2 = bodies[par].rel; for (let k = 0; k < n; k++) { const q = pa.ptsP[k]; arr[k * 3] = q[0]; arr[k * 3 + 1] = q[1]; arr[k * 3 + 2] = q[2]; } L.a.position.set(...o2); }
      else { for (let k = 0; k < n; k++) { const q = mv(Fb, pa.pts[k]); arr[k * 3] = q[0]; arr[k * 3 + 1] = q[1]; arr[k * 3 + 2] = q[2]; } L.a.position.set(...rel0); }
      L.geo.attributes.position.needsUpdate = true; L.geo.setDrawRange(0, n); L.b.position.copy(L.a.position);
      const pp = (r, dtm) => patchPos(pa, r, pa.t0 + dtm);
      L.color(pa.t0 > t + 1 && F.nodes.some(nd => Math.abs(nd.t - pa.t0) < 1) ? 0xffd23a : PATCH_COL[i % PATCH_COL.length]);
      const tDraw = pa.o.e < 1 ? Math.min(pa.t1 - pa.t0, pa.o.T) : pa.t1 - pa.t0;
      for (let k = 0; k < n; k += 3) { const p = project(asParent ? V.add(bodies[par].rel, pa.ptsP[k]) : V.add(rel0, mv(Fb, pa.pts[k]))); if (p.z < 1) trajPick.push({ x: p.x, y: p.y, t: pa.t0 + tDraw * k / (n - 1) }); }
      // apsides
      const o = pa.o, mu = B[pa.body].mu, rb = B[pa.body].R;
      const tp = C.timeToPe(pa.r0, pa.v0, mu); if (isFinite(tp) && tp < pa.t1 - pa.t0) { const s = P.propagate(pa.r0, pa.v0, tp, mu); const d = marker(`Pe ${fmtD(o.rp - rb)}`, 'pe'); place(d, pp(s.r, tp)); }
      if (o.e < 1) { const ta = P.timeToAp(pa.r0, pa.v0, mu); if (isFinite(ta) && ta < pa.t1 - pa.t0) { const s = P.propagate(pa.r0, pa.v0, ta, mu); const d = marker(`Ap ${fmtD(o.ra - rb)}`, 'ap'); place(d, pp(s.r, ta)); } }
      if (pa.end.type === 'soi-enter' || pa.end.type === 'soi-exit') { const s = P.propagate(pa.r0, pa.v0, pa.t1 - pa.t0, mu); const d = marker(pa.end.type === 'soi-enter' ? `⊙ ${B[pa.end.to].name} encounter · ${fmtDur(pa.t1 - t)}` : `SOI exit · ${fmtDur(pa.t1 - t)}`, 'enc'); place(d, pp(s.r, pa.t1 - pa.t0)); }
      if (pa.end.type === 'surface' || pa.end.type === 'atmosphere') { const s = P.propagate(pa.r0, pa.v0, pa.t1 - pa.t0, mu); const d = marker(pa.end.type === 'surface' ? '✖ impact' : '≋ atmosphere', 'imp'); place(d, pp(s.r, pa.t1 - pa.t0)); }
      // AN / DN relative to the target's orbit plane (target orbiting this patch's body or the same parent)
      const tg = F.target; if (tg && B[tg].parent === pa.body && pa.body === F.body && i === 0) {
        const ts = P.relState(tg, t), nT = V.norm(V.cross(ts.r, ts.v));
        const nC = V.norm(o.h), rel = Math.acos(Math.max(-1, Math.min(1, V.dot(nC, nT)))) * 180 / Math.PI, line = V.cross(nT, nC);
        if (V.len(line) > 1e-6) for (const [sg, lab] of [[1, 'AN'], [-1, 'DN']]) { const dir = V.scale(V.norm(line), sg), nu = Math.atan2(V.dot(V.cross(o.ev, dir), nC), V.dot(o.ev, dir)), r = o.p / (1 + o.e * Math.cos(nu)); if (r > 0 && isFinite(r)) { const d = marker(`${lab} ${rel.toFixed(1)}°`, 'node-an'); place(d, V.add(rel0, mv(Fb, V.scale(dir, r)))); } }
        S.relInc = rel;
      }
    });
    // closest approach to the target: craft and target positions at that time
    if (S.ca && S.ca.t && !S.ca.inside && F.target) { const tg = F.target, pa = pr.patches.find(p => p.t0 <= S.ca.t && p.t1 >= S.ca.t) || pr.patches[0], s = P.propagate(pa.r0, pa.v0, S.ca.t - pa.t0, B[pa.body].mu);
      const cr = V.add(V.sub(bodies[pa.body].abs, origin), mv(P.frameOf(pa.body), s.r)); place(marker(`CA ${fmtD(S.ca.d)} · ${fmtDur(S.ca.t - t)}`, 'ca'), cr);
      const tr = V.sub(P.absState(tg, S.ca.t).r, origin); place(marker(`${B[tg].name} at CA`, 'ca2'), V.add(tr, V.sub(bodies[pa.body].abs, P.absState(pa.body, S.ca.t).r))); }
    // ballistic impact with drag (from flight; refreshed about once a second)
    const im = F._imp; if (im && im.body === F.body && im.t > t) place(marker(`✖ impact (drag) ${fmtDur(im.t - t)} · ${fmtV(im.speed)}`, 'imp'), V.add(bodies[F.body].rel, mv(P.frameOf(F.body), im.r)));
    // nodes and handles (a node can sit on a later patch: drawn in that patch's body frame)
    F.nodes.forEach((n, i) => { if (n.t < t) return; const s = nodeState(n), nr = s.pa ? patchPos(s.pa, s.r, n.t) : V.add(V.sub(craftAbs(t), origin), V.sub(mv(P.frameOf(F.body), s.r), mv(P.frameOf(F.body), v.r))); n._body = s.body;
      const d = marker(`◆ ${fmtV(C.nodeDv(n))} · ${fmtDur(n.t - t)}`, 'nodem' + (n === S.sel ? ' sel' : '')); d.dataset.node = i; const p = place(d, nr); n._rel = nr; n._scr = p; });
    { // f5.2.3 deployed payloads on rails: orbit ring + marker each, and the tracking list
      const sats = getSats().filter(o => (o.body || 'earth') === 'earth'), eRel = bodies.earth.rel, Fe = P.frameOf('earth'), mu = B.earth.mu;
      sats.forEach((o, i) => { let L = satLines[i]; if (!L) { L = satLines[i] = makeLine(0x3fae78, 129); }
        if (!o._pts) { const T = W_T(o, mu), pts = []; for (let k = 0; k <= 128; k++) pts.push(mv(Fe, P.propagate(o.r, o.v, T * k / 128, mu).r)); o._pts = pts; }
        const arr = L.geo.attributes.position.array; for (let k = 0; k <= 128; k++) { const q = o._pts[k]; arr[k * 3] = q[0]; arr[k * 3 + 1] = q[1]; arr[k * 3 + 2] = q[2]; }
        L.geo.attributes.position.needsUpdate = true; L.geo.setDrawRange(0, 129); L.a.position.set(...eRel); L.b.position.copy(L.a.position); L.set(true);
        const st = P.propagate(o.r, o.v, t - o.t, mu); place(marker('🛰 ' + o.name, 'sat'), V.add(eRel, mv(Fe, st.r))); });
      for (let k = sats.length; k < satLines.length; k++) satLines[k].set(false);
      const tr = ui.querySelector('#mapTrack'); tr.classList.toggle('hidden', !sats.length);
      if (sats.length && (S._trT = (S._trT || 0) - rdt) <= 0) { S._trT = 1; const Rb = B.earth.R;
        tr.innerHTML = `<h4>🛰 Tracking · ${sats.length} in orbit</h4>` + sats.slice(-12).map(o => { const st = P.propagate(o.r, o.v, t - o.t, mu); return `<div>${o.name} · ${((Math.hypot(...st.r) - Rb) / 1000).toFixed(0)} km</div>`; }).join(''); } }
    for (let k = markerN; k < markerPool.length; k++) markerPool[k].style.display = 'none';
    const n = S.sel && F.nodes.includes(S.sel) ? S.sel : null;
    handles.forEach(hd => { hd.style.display = 'none'; });
    if (n && n._scr) {
      const s = nodeState(n), f = C.nodeFrame(s.r, s.v), Fb = P.frameOf(s.body), L = S.dist * 0.09;
      const dirs = { pro: f.pro, ret: V.scale(f.pro, -1), nrm: f.nrm, anti: V.scale(f.nrm, -1), rad: f.rad, radin: V.scale(f.rad, -1) };
      const lay = layoutHandles(n._scr, k => project(V.add(n._rel, V.scale(mv(Fb, dirs[k]), L))), touch ? 30 : 22, touch ? 58 : 44);
      handles.forEach(hd => { const k = hd.dataset.h, h = lay[k]; if (!h) { hd.style.display = 'none'; return; } hd.style.display = ''; hd.style.transform = `translate(${(h.x - 14).toFixed(1)}px,${(h.y - 14).toFixed(1)}px)`; hd._u = { ux: h.ux, uy: h.uy }; if (hdrag && hdrag.h === k) hdrag.scr = hd._u; });
      if (hdrag && !hdrag.scr) { const hd = handles.find(h => h.dataset.h === hdrag.h); hdrag.scr = hd._u; }
    }
    // info strip
    const o = P.orbitOf(v), rb = B[F.body].R, ca = S.ca;
    { const ap = isFinite(o.ra) ? 'Ap ' + fmtD(o.ra - rb) : 'escape', pe = o.rp - rb > 0 ? 'Pe ' + fmtD(o.rp - rb) : 'Pe —';
      const imp = F._imp && F._imp.t > t ? ', impact ' + fmtDur(F._imp.t - t) : '', tg = F.target && ca ? (ca.inside ? ` · ${B[F.target].name} Pe ${fmtD(ca.alt)}` : ` · ${B[F.target].name} ${fmtD(ca.d)}`) : '';
      const txt = ap + ' · ' + pe + imp + tg; if (info.textContent !== txt) info.textContent = txt; }
    S.relInc = undefined;
    declutter();
  }
  // f3 label declutter: priority order, hide anything that collides with a label already placed or that sits
  // behind / on the disc of a nearer body (distant planets used to print across the Earth)
  function declutter() {
    const F = getF(), items = [], rect = d => { const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(d.style.transform); if (!m) return null; const w = d._w || (d._w = d.offsetWidth || 60), h = d._h || (d._h = d.offsetHeight || 16); const x = +m[1], y = +m[2]; return d.classList.contains('mmark') ? { l: x - 6, t: y - 9, r: x - 6 + w, b: y - 9 + h } : { l: x, t: y, r: x + w, b: y + h }; };
    const pri = d => d.classList.contains('nodem') ? 0 : d === craftLab ? 1 : d.classList.contains('mmark') ? (d.classList.contains('imp') ? 2 : d.classList.contains('ap') ? 3 : 4) : d.dataset.id === S.focus || d.dataset.id === F.body ? 5 : d.dataset.id === F.target ? 6 : 7;
    for (const d of labels.children) { if (d.style.display === 'none' || d.classList.contains('mhandle')) continue; d.style.visibility = ''; const r = rect(d); if (r) items.push({ d, r, p: pri(d) }); }
    items.sort((a, b) => a.p - b.p); const placed = [];
    // discs of bodies big on screen
    const discs = IDS.map(id => bodies[id]).filter(o => o.scr && o.scr.z < 1 && o.scr.r > 6).map(o => ({ id: o.lab.dataset.id, x: o.scr.x + 8, y: o.scr.y - 8, r: o.scr.r, d: V.len(V.sub(o.rel, camRel)) }));
    for (const it of items) { const r = it.r, d = it.d; let hide = placed.some(q => r.l < q.r && q.l < r.r && r.t < q.b && q.t < r.b);
      if (!hide && d.classList.contains('mlab') && d !== craftLab) { const id = d.dataset.id, o = bodies[id]; if (o) { const myD = V.len(V.sub(o.rel, camRel)); hide = discs.some(c => c.id !== id && c.d < myD && Math.hypot((r.l + r.r) / 2 - c.x, (r.t + r.b) / 2 - c.y) < c.r + 10) || (d.classList.contains('dim') && id !== S.focus); } }
      if (hide) d.style.visibility = 'hidden'; else placed.push(r); }
  }
  function pickTraj(x, y) { let best = null; for (const p of trajPick) { const d = Math.hypot(p.x - x, p.y - y); if (d < 14 && (!best || d < best.d)) best = { d, t: p.t }; } return best; }
  function key(code, e) {
    if (!S.on) return false;
    if (code === 'Tab') { e && e.preventDefault(); cycle(e && e.shiftKey ? -1 : 1); return true; }
    if (code === 'BracketLeft') { cycle(-1); return true; } if (code === 'BracketRight') { cycle(1); return true; }
    if (code === 'Equal' || code === 'NumpadAdd') { zoomBy(0.6); return true; } if (code === 'Minus' || code === 'NumpadSubtract') { zoomBy(1.7); return true; }
    if (code === 'Backspace' || code === 'Home') { setFocus('craft'); return true; }
    if (code === 'Delete' && S.sel) { getF().removeNode(S.sel); S.sel = null; S.panelMode = null; renderPanel(); return true; }
    return false;
  }
  function show(on) { if (on && !S.on) { S.inited = true; { const F = getF(), o = P.orbitOf(F.v), Rb = B[F.body].R, far = isFinite(o.ra) && o.ra < B[F.body].soi ? Math.max(o.ra, V.len(F.v.r)) : 0; // f3: frame the whole orbit around the body
      if (far) { S.focus = F.body; S.pan = [0, 0, 0]; S.trans = null; S.dist = S.distT = Math.max(Rb * 3.2, far * 2.7); } else { S.focus = 'craft'; S.dist = S.distT = niceDist('craft'); } } S.yaw = S.yawT = sunYaw(); S.pitch = S.pitchT = PITCH0; S.idle = 3; ui.querySelector('#mapMore').classList.add('hidden'); } S.on = on; ui.classList.toggle('hidden', !on); document.body.classList.toggle('mapOn', on); if (on) { S.predKey = ''; S.distT = S.dist = Math.max(S.dist, minDist());  $('mapFocus').textContent = S.focus === 'craft' ? 'Craft' : B[S.focus].name; renderPanel(); } }
  function reset() { S.focus = 'craft'; S.pan = [0, 0, 0]; S.trans = null; S.sel = null; S.panelMode = null; S.plan = null; S.pred = null; S.inited = false; renderPanel(); }
  // f5.4j: test probe: where the map draws the craft vs a body (map metres) and the end of the drawn trajectory
  const probe = id => { const o = bodies[id || getF().body]; return o && o.m ? { craftToBody: craftDot.position.distanceTo(o.m.position), R: B[id || getF().body].R, drawnR: o.m.scale.x } : null; };
  return { scene, camera, update, show, reset, key, probe, patchAt, get conic() { return S.conic; }, setConic: c => { S.conic = c; const b = document.querySelector('#mapMore [data-a=conic]'); if (b) b.textContent = c === 'body' ? '⊙ Body' : '⊙ Parent'; if (S.pred) for (const p of S.pred.patches) p.ptsP = null; }, setFocus, setView, resetView, cycle, zoomBy, runPlanner, selectNode, addNodeAt, warpNext, state: S,
    setCam: (q, dist) => { if (q) { const b = new THREE.Vector3(0, 0, 1).applyQuaternion(new THREE.Quaternion(q[0], q[1], q[2], q[3]).normalize()); S.yaw = S.yawT = Math.atan2(b.y, b.x); S.pitch = S.pitchT = Math.asin(Math.max(-1, Math.min(1, b.z))); S.idle = -1e9; applyYP(); } if (dist) { S.dist = S.distT = dist; } },
    openPlanner: tg => { S.panelMode = 'plan'; runPlanner(tg); }, get panelMode() { return S.panelMode; }, get plan() { return S.plan; } };
}

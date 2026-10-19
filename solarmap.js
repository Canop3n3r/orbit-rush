// Orbit Rush 3D map (Milestone A): the whole solar system at full scale, drawn with a camera-relative floating
// origin (all positions are float64 heliocentric J2000-ecliptic metres; only "position − camera focus" reaches
// the GPU) and a logarithmic depth buffer, so low Earth orbit and Neptune share one view without jitter.
// Orbit camera: quaternion trackball (any angle, pole-down or edge-on, no gimbal lock), smooth zoom, pan,
// focus with smooth transitions. Lines are drawn twice: depth-tested (bright) and through bodies (faint).
// Markers and node handles are HTML (crisp, finger-sized). Mouse and touch.
import * as THREE from 'three/webgpu';
import * as P from './physics.js?v=ss1';
import * as C from './physics/patched.js?v=ss1';
import { fmtDur } from './flight.js?v=ss1';
const V = P.V, B = P.BODIES, $ = id => document.getElementById(id);
const IDS = Object.keys(B), PLANETS = IDS.filter(id => B[id].parent === 'sun');
const fmtD = m => { const a = Math.abs(m); return a >= 1.496e10 ? (m / P.AU).toFixed(3) + ' AU' : a >= 1e7 ? (m / 1e3).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' km' : a >= 1e4 ? (m / 1e3).toFixed(1) + ' km' : m.toFixed(0) + ' m'; };
const fmtV = x => (Math.abs(x) >= 1000 ? (x / 1000).toFixed(2) + ' km/s' : x.toFixed(1) + ' m/s');
const mv = (F, x) => [F[0] * x[0] + F[1] * x[1] + F[2] * x[2], F[3] * x[0] + F[4] * x[1] + F[5] * x[2], F[6] * x[0] + F[7] * x[1] + F[8] * x[2]];
const PATCH_COL = [0x7dffa6, 0xffb35c, 0xc89cff, 0x6ad8ff, 0xff7ab0];

export function createSolarMap(opts) {
  const { renderer, getF, toast, touch, earthMap, onChange } = opts;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x01020a);
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 1, 1e15);
  const sunLight = new THREE.PointLight(0xffffff, 3, 0, 0); scene.add(sunLight); scene.add(new THREE.AmbientLight(0x404858, 0.35));
  // ---------- stars (fixed directions, follow the camera) ----------
  { const n = 2400, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const z = Math.random() * 2 - 1, a = Math.random() * 6.283, s = Math.sqrt(1 - z * z); pos.set([s * Math.cos(a), s * Math.sin(a), z], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xaab4d0, size: 1, sizeAttenuation: false, depthWrite: false })); stars.frustumCulled = false; scene.add(stars); }
  // ---------- bodies ----------
  const sphere = new THREE.SphereGeometry(1, 64, 32); sphere.rotateX(Math.PI / 2); // poles on ±z (body frames have z = pole)
  const dotGeo = new THREE.SphereGeometry(1, 12, 8);
  const bodies = {};
  for (const id of IDS) {
    const b = B[id], mat = id === 'sun' ? new THREE.MeshBasicMaterial({ color: 0xfff1c0 }) : new THREE.MeshStandardMaterial({ color: id === 'earth' && earthMap ? 0xffffff : b.color, map: id === 'earth' ? earthMap || null : null, roughness: 0.95 });
    const m = new THREE.Mesh(sphere, mat); m.frustumCulled = false; scene.add(m);
    const dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: b.color })); dot.frustumCulled = false; scene.add(dot);
    const lab = document.createElement('div'); lab.className = 'mlab ' + b.kind; lab.textContent = b.name; lab.dataset.id = id;
    bodies[id] = { m, dot, lab, abs: [0, 0, 0], line: null };
    if (id !== 'sun') bodies[id].line = makeLine(b.kind === 'moon' ? 0x5a6a88 : 0x4a5c7c, 257);
    if (id === 'saturn') { const rg = new THREE.RingGeometry(1.24, 2.27, 96); const rm = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xcdbb94, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); m.add(rm); }
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
  const traj = PATCH_COL.map(c => makeLine(c, 241));
  // ---------- DOM ----------
  const ui = document.createElement('div'); ui.id = 'mapUI'; ui.className = 'hidden';
  ui.innerHTML = `<div id="mapLabels"></div>
  <div id="mapBar">
    <button data-a="prev" title="Previous focus ([ or Shift+Tab)">◀</button><span id="mapFocus">Craft</span><button data-a="next" title="Next focus (] or Tab)">▶</button>
    <button data-a="craft" title="Focus the craft">Craft</button><button data-a="pole" title="Look down on the orbit plane">Top</button><button data-a="edge" title="Edge-on view">Edge</button>
    <button data-a="zin" title="Zoom in (+)">＋</button><button data-a="zout" title="Zoom out (−)">－</button>
    <button data-a="node" title="Add a maneuver node 10 minutes ahead (or click / tap the trajectory)">◆ Node</button>
    <button data-a="plan" title="Transfer planner">Planner</button><button data-a="warp" title="Warp to the next event">⏩ Next</button>
    <button data-a="close" title="Back to flight (M)">✕ Map</button>
  </div>
  <div id="mapPanel" class="hidden"></div>
  <div id="mapInfo"></div>`;
  document.body.appendChild(ui);
  const labels = ui.querySelector('#mapLabels'), panel = ui.querySelector('#mapPanel'), info = ui.querySelector('#mapInfo');
  for (const id of IDS) labels.appendChild(bodies[id].lab);
  const craftLab = document.createElement('div'); craftLab.className = 'mlab craft'; craftLab.textContent = '▲ craft'; craftLab.dataset.id = 'craft'; labels.appendChild(craftLab);
  const markerPool = []; let markerN = 0;
  function marker(text, cls) { let d = markerPool[markerN]; if (!d) { d = document.createElement('div'); labels.appendChild(d); markerPool.push(d); } markerN++; d.className = 'mmark ' + (cls || ''); if (d.textContent !== text) d.textContent = text; d.style.display = ''; return d; }
  const handles = ['pro', 'ret', 'nrm', 'anti', 'rad', 'radin'].map(k => { const d = document.createElement('div'); d.className = 'mhandle h-' + k; d.dataset.h = k; d.textContent = { pro: '⊕', ret: '⊗', nrm: '▲', anti: '▼', rad: '◉', radin: '◎' }[k]; labels.appendChild(d); return d; });
  // ---------- state ----------
  const S = { on: false, focus: 'craft', dist: 3e7, distT: 3e7, q: new THREE.Quaternion(), pan: [0, 0, 0], trans: null, sel: null, panelMode: null, plan: null, planTarget: null, pred: null, predT: 0, predKey: '', W: innerWidth, H: innerHeight, lastClick: 0 };
  S.q.setFromEuler(new THREE.Euler(1.0, 0, 0.6, 'ZXY'));
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
    if (kind === 'pole') { const back = N.clone(); const up = Math.abs(N.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0); const m = new THREE.Matrix4().lookAt(back, new THREE.Vector3(), up.cross(back).cross(back).negate().normalize()); S.q.setFromRotationMatrix(m); }
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
      if (drag === 'rot') { // trackball: yaw about the camera's up, pitch about its right axis (quaternions: no gimbal lock)
        const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -dx * 0.006), qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -dy * 0.006);
        S.q.multiply(qy).multiply(qx).normalize();
      } else panBy(dx, dy);
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
    if (now - S.lastClick < 400 && S.lastId === id) setFocus(id); else showBody(id); S.lastClick = now; S.lastId = id;
  });
  labels.addEventListener('dblclick', e => { const id = e.target.dataset.id; if (id) setFocus(id); });
  // click / tap on the scene: double = focus the nearest body; single on the trajectory = add a node there
  function click(x, y) {
    const now = performance.now(), dbl = now - S.lastClick < 350; S.lastClick = now;
    let best = null; for (const id of IDS) { const p = bodies[id].scr; if (p && p.z < 1) { const d = Math.hypot(p.x - x, p.y - y); if (d < Math.max(18, p.r + 6) && (!best || d < best.d)) best = { id, d }; } }
    if (craftScr && Math.hypot(craftScr.x - x, craftScr.y - y) < 18) best = { id: 'craft', d: 0 };
    if (dbl && best) { setFocus(best.id); return; }
    const hit = pickTraj(x, y); if (hit) { addNodeAt(hit.t); return; }
    if (best && best.id !== 'craft') showBody(best.id);
  }
  // ---------- nodes ----------
  let hdrag = null;
  function curPatchEnd() { const pr = S.pred; return pr && pr.patches[0] ? pr.patches[0].t1 : Infinity; }
  function addNodeAt(t) {
    const F = getF();
    if (t > curPatchEnd() + 1) { toast('Nodes go on the current orbit (before the next SOI change) — warp to the SOI change first', '#ffb35c'); return; }
    const n = F.addNode({ t: Math.max(t, F.tAbs + 60) }); selectNode(n); S.predKey = ''; toast('Maneuver node added — drag the handles or type Δv', '#9cc3ff');
  }
  function selectNode(n) { S.sel = n; S.panelMode = n ? 'node' : null; renderPanel(); }
  function nodeState(n) { const F = getF(), v = F.v, s = P.propagate(v.r, v.v, n.t - F.tAbs, P.muOf(v)); return s; }
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
    const F = getF(); panel.classList.toggle('hidden', !S.panelMode);
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
  ui.querySelector('#mapBar').addEventListener('click', e => {
    const a = e.target.dataset.a, F = getF(); if (!a) return; e.target.blur();
    if (a === 'prev') cycle(-1); if (a === 'next') cycle(1); if (a === 'craft') setFocus('craft');
    if (a === 'pole') setView('pole'); if (a === 'edge') setView('edge');
    if (a === 'zin') zoomBy(0.5); if (a === 'zout') zoomBy(2);
    if (a === 'node') addNodeAt(F.tAbs + 600);
    if (a === 'plan') { S.panelMode = S.panelMode === 'plan' ? null : 'plan'; if (S.panelMode === 'plan' && !S.plan) { const ts = plannerTargets(); if (ts.length) runPlanner(F.target && ts.includes(F.target) ? F.target : ts[0]); } renderPanel(); }
    if (a === 'warp') warpNext();
    if (a === 'close') onChange && onChange('close');
  });
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
    if (S.trans) { S.trans.k = Math.max(0, S.trans.k - rdt * 1.6); if (S.trans.k <= 0) S.trans = null; }
    const ease = S.trans ? S.trans.k * S.trans.k * (3 - 2 * S.trans.k) : 0;
    const origin = V.add(V.add(focusAbs(), S.pan), S.trans ? V.scale(S.trans.from, ease) : [0, 0, 0]);
    // camera at the origin of the scene looking at -z of S.q; focus point at (0,0,0)
    const back = new THREE.Vector3(0, 0, 1).applyQuaternion(S.q).multiplyScalar(S.dist);
    camera.position.copy(back); camera.quaternion.copy(S.q); camera.near = Math.max(0.5, S.dist * 1e-4); camera.far = Math.max(1e13, S.dist * 1e3);
    { // keep the focus in the free part of the screen (not under the toolbar or the side panel)
      const pe = document.getElementById('mapPanel'), be = document.getElementById('mapBar'), pr = pe && !pe.classList.contains('hidden') ? pe.getBoundingClientRect() : null, br = be ? be.getBoundingClientRect() : null;
      const tx = pr && pr.left > S.W * 0.35 ? (S.W - pr.left) / 2 : 0, ty = br && br.height ? Math.min(S.H * 0.2, (S.H - br.top) / 2) : 0;
      S.vo = S.vo || [0, 0]; const k = Math.min(1, rdt * 6); S.vo[0] += (tx - S.vo[0]) * k; S.vo[1] += (ty - S.vo[1]) * k;
      if (Math.abs(S.vo[0]) + Math.abs(S.vo[1]) > 0.5) camera.setViewOffset(S.W, S.H, S.vo[0], S.vo[1], S.W, S.H); else camera.clearViewOffset();
    }
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    camRel = [back.x, back.y, back.z]; stars.position.copy(camera.position); stars.scale.setScalar(camera.far * 0.5);
    const pxK = 2 * Math.tan(25 * Math.PI / 180) / S.H;
    const sunRel = V.sub([0, 0, 0], origin); sunLight.position.set(...sunRel);
    for (const id of IDS) { const o = bodies[id]; o.abs = bodyAbs(id, t); o.rel = V.sub(o.abs, origin); }
    for (const id of IDS) {
      const o = bodies[id], b = B[id], abs = o.abs, rel = o.rel;
      o.m.position.set(...rel); o.m.scale.setScalar(b.R);
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
      // the drawn path is relative to the body's CURRENT position (patched-conics convention)
      for (let k = 0; k < n; k++) { const q = mv(Fb, pa.pts[k]); arr[k * 3] = q[0]; arr[k * 3 + 1] = q[1]; arr[k * 3 + 2] = q[2]; }
      L.geo.attributes.position.needsUpdate = true; L.geo.setDrawRange(0, n); L.a.position.set(...rel0); L.b.position.copy(L.a.position);
      L.color(pa.t0 > t + 1 && F.nodes.some(nd => Math.abs(nd.t - pa.t0) < 1) ? 0xffd23a : PATCH_COL[i % PATCH_COL.length]);
      const tDraw = pa.o.e < 1 ? Math.min(pa.t1 - pa.t0, pa.o.T) : pa.t1 - pa.t0;
      for (let k = 0; k < n; k += 3) { const q = mv(Fb, pa.pts[k]), p = project(V.add(rel0, q)); if (p.z < 1) trajPick.push({ x: p.x, y: p.y, t: pa.t0 + tDraw * k / (n - 1) }); }
      // apsides
      const o = pa.o, mu = B[pa.body].mu, rb = B[pa.body].R;
      const tp = C.timeToPe(pa.r0, pa.v0, mu); if (isFinite(tp) && tp < pa.t1 - pa.t0) { const s = P.propagate(pa.r0, pa.v0, tp, mu); const d = marker(`Pe ${fmtD(o.rp - rb)}`, 'pe'); place(d, V.add(rel0, mv(Fb, s.r))); }
      if (o.e < 1) { const ta = P.timeToAp(pa.r0, pa.v0, mu); if (isFinite(ta) && ta < pa.t1 - pa.t0) { const s = P.propagate(pa.r0, pa.v0, ta, mu); const d = marker(`Ap ${fmtD(o.ra - rb)}`, 'ap'); place(d, V.add(rel0, mv(Fb, s.r))); } }
      if (pa.end.type === 'soi-enter' || pa.end.type === 'soi-exit') { const s = P.propagate(pa.r0, pa.v0, pa.t1 - pa.t0, mu); const d = marker(pa.end.type === 'soi-enter' ? `⊙ ${B[pa.end.to].name} encounter · ${fmtDur(pa.t1 - t)}` : `SOI exit · ${fmtDur(pa.t1 - t)}`, 'enc'); place(d, V.add(rel0, mv(Fb, s.r))); }
      if (pa.end.type === 'surface' || pa.end.type === 'atmosphere') { const s = P.propagate(pa.r0, pa.v0, pa.t1 - pa.t0, mu); const d = marker(pa.end.type === 'surface' ? '✖ impact' : '≋ atmosphere', 'imp'); place(d, V.add(rel0, mv(Fb, s.r))); }
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
    // nodes and handles
    F.nodes.forEach((n, i) => { if (n.t < t) return; const s = nodeState(n), nr = V.add(V.sub(craftAbs(t), origin), V.sub(mv(P.frameOf(F.body), s.r), mv(P.frameOf(F.body), v.r)));
      const d = marker(`◆ ${fmtV(C.nodeDv(n))} · ${fmtDur(n.t - t)}`, 'nodem' + (n === S.sel ? ' sel' : '')); d.dataset.node = i; const p = place(d, nr); n._rel = nr; n._scr = p; });
    for (let k = markerN; k < markerPool.length; k++) markerPool[k].style.display = 'none';
    const n = S.sel && F.nodes.includes(S.sel) ? S.sel : null;
    handles.forEach(hd => { hd.style.display = 'none'; });
    if (n && n._scr) {
      const s = nodeState(n), f = C.nodeFrame(s.r, s.v), Fb = P.frameOf(F.body), L = S.dist * 0.09;
      const dirs = { pro: f.pro, ret: V.scale(f.pro, -1), nrm: f.nrm, anti: V.scale(f.nrm, -1), rad: f.rad, radin: V.scale(f.rad, -1) };
      handles.forEach(hd => { const k = hd.dataset.h, w = V.add(n._rel, V.scale(mv(Fb, dirs[k]), L)), p = place(hd, w, -14, -14); if (p) { let ux = p.x - n._scr.x, uy = p.y - n._scr.y; const l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l; if (l < 20) { /* edge-on: push out on screen */ hd.style.transform = `translate(${(n._scr.x + ux * 40 - 14).toFixed(1)}px,${(n._scr.y + uy * 40 - 14).toFixed(1)}px)`; } if (hdrag && hdrag.h === k) hdrag.scr = { ux, uy }; hd._u = { ux, uy }; } });
      if (hdrag && !hdrag.scr) { const hd = handles.find(h => h.dataset.h === hdrag.h); hdrag.scr = hd._u; }
    }
    // info strip
    const o = P.orbitOf(v), rb = B[F.body].R, ca = S.ca;
    info.innerHTML = `<b>${B[F.body].name}</b> SOI · ${new Date(P.dateFromT(t)).toISOString().slice(0, 16).replace('T', ' ')} UTC · warp ×${F.effWarp()}${F.warpTarget ? ` → ${F.warpTarget.label}` : ''}<br>`
      + `${isFinite(o.ra) ? `Ap ${fmtD(o.ra - rb)} · ` : 'escape · '}Pe ${fmtD(o.rp - rb)} · inc ${(o.inc * 180 / Math.PI).toFixed(1)}°${S.relInc !== undefined && F.target ? ` · rel. inc ${S.relInc.toFixed(1)}°` : ''}`
      + (F.target ? `<br>Target <b>${B[F.target].name}</b>${ca ? ca.inside ? ` · encounter, Pe ${fmtD(ca.alt)}` : ` · closest ${fmtD(ca.d)} in ${fmtDur(ca.t - t)} · rel ${fmtV(ca.relV)}` : ''}` : '');
    S.relInc = undefined;
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
  function show(on) { S.on = on; ui.classList.toggle('hidden', !on); document.body.classList.toggle('mapOn', on); if (on) { S.predKey = ''; S.distT = S.dist = Math.max(S.dist, minDist()); if (!S.inited) { S.inited = true; S.dist = S.distT = niceDist('craft'); } $('mapFocus').textContent = S.focus === 'craft' ? 'Craft' : B[S.focus].name; renderPanel(); } }
  function reset() { S.focus = 'craft'; S.pan = [0, 0, 0]; S.trans = null; S.sel = null; S.panelMode = null; S.plan = null; S.pred = null; S.inited = false; renderPanel(); }
  return { scene, camera, update, show, reset, key, setFocus, setView, cycle, zoomBy, runPlanner, selectNode, addNodeAt, warpNext, state: S,
    setCam: (q, dist) => { if (q) S.q.set(q[0], q[1], q[2], q[3]).normalize(); if (dist) { S.dist = S.distT = dist; } },
    openPlanner: tg => { S.panelMode = 'plan'; runPlanner(tg); }, get panelMode() { return S.panelMode; }, get plan() { return S.plan; } };
}

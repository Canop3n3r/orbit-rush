// Phone/tablet layout and touch controls (pointer: coarse, or ?touch to force it on a desktop).
// Compact HUD (6 readouts, tap for the full telemetry sheet), a thumb stick for pitch/yaw, a roll bar,
// a vertical throttle slider, a big STAGE button (the double-press guard lives in flight.js), and an
// overflow menu (☰) for SAS modes, RCS, warp, map, chutes, deorbit, booster, effects, Learn, fullscreen.
// Haptics (navigator.vibrate), Wake Lock while flying, safe areas are in style.css (env(safe-area-inset-*)).
const qs = new URLSearchParams(location.search);
export const isTouch = () => qs.has('touch') || (!qs.has('desktop') && matchMedia('(pointer: coarse)').matches);
const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); Object.assign(e, attrs); if (html) e.innerHTML = html; return e; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const SAS = [['stab', 'STAB'], ['prograde', 'PRO'], ['retrograde', 'RETRO'], ['radial', 'RAD+'], ['antiradial', 'RAD−'], ['normal', 'NRM'], ['antinormal', 'ANRM'], ['off', 'OFF']];
export function createMobile(api) {
  const on = isTouch(), input = { pitch: 0, yaw: 0, roll: 0 };
  const M = { on, input, render() {}, update() {}, vibrate() {}, closeMenu() {}, show() {}, thrDragging: () => false, wakeLock: () => false, sheet: false }; // desktop: inert stubs
  if (!on) return M;
  document.body.classList.add('touch');
  const root = el('div', { id: 'mob', className: 'hidden' });
  root.innerHTML = `
    <div id="mhud"><div data-l="alt"><b>ALT</b><span id="mAlt">—</span></div><div data-l="spd"><b>SPD</b><span id="mSpd">—</span></div><div data-l="ap"><b>Ap</b><span id="mAp">—</span></div>
      <div data-l="pe"><b>Pe</b><span id="mPe">—</span></div><div data-l="q"><b id="mMqL">MACH</b><span id="mMq">—</span></div><div data-l="fuel"><b>FUEL</b><span id="mFuel">—</span></div><em>tap for all ▾</em></div>
    <div id="mtop"><span id="mScore" data-l="score">0</span><button id="mMap">MAP</button><button id="mMenuBtn" data-l="sas" aria-label="More controls">☰</button></div>
    <div id="mleft"><div id="mRoll"><i></i><span>ROLL</span></div><div id="mStick" data-l="pitch"><i></i></div></div>
    <div id="mright"><button id="mAuto">AUTO</button><button id="mChute" class="hidden">CHUTE</button><button id="mStage">STAGE</button>
      <div id="mThr" data-l="thr"><i></i><b>THR</b><u>0%</u></div></div>
    <div id="mMenu" class="hidden"><div class="mh"><span id="mWarp"></span><button id="mClose" aria-label="Close">✕</button></div><div class="mg"><h5>SAS</h5>${SAS.map(([k, t]) => `<button data-sas="${k}">${t}</button>`).join('')}</div>
      <div class="mg"><h5>Flight</h5><button data-p="KeyC" id="mRcs">RCS</button><button data-p="Comma">WARP −</button><button data-p="KeyT">WARP +</button><button data-p="KeyG">⏩ AP</button>
      <button data-p="KeyO" id="mHome">HOME</button><button data-p="KeyP">CHUTE</button><button data-p="KeyY">FLY BOOSTER</button><button data-p="KeyB">BOOSTER CAM</button><button data-p="Backquote">CAM FREE/LOCK</button><button data-p="Backslash">CoM/CoP</button></div>
      <div class="mg"><h5>Game</h5><button data-p="Escape">⏸ PAUSE</button><button data-p="F5">💾 QUICKSAVE</button><button data-p="F9">📂 QUICKLOAD</button></div>
      <div class="mg"><h5>View</h5><button data-p="KeyU" id="mFx">FX</button><button data-p="Slash">LEARN</button><button id="mFull">FULLSCREEN</button><button data-p="KeyR">HANGAR</button></div></div>`;
  document.body.appendChild(root);
  const $ = id => document.getElementById(id);
  const vib = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* not supported (iOS) */ } };
  M.vibrate = vib;
  // generic tap helper: pointerdown so it reacts instantly and never waits for a click delay
  const tap = (b, fn) => b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); api.unlockAudio && api.unlockAudio(); fn(e); });
  tap($('mhud'), () => { M.sheet = !M.sheet; document.body.classList.toggle('sheet', M.sheet); });
  tap($('mMenuBtn'), () => { $('mMenu').classList.toggle('hidden'); });
  M.closeMenu = () => $('mMenu').classList.add('hidden');
  // tap anywhere outside the menu closes it (and that tap does nothing else)
  document.addEventListener('pointerdown', e => { const m = $('mMenu'); if (!m.classList.contains('hidden') && !e.target.closest('#mMenu, #mMenuBtn')) { M.closeMenu(); e.stopPropagation(); e.preventDefault(); } }, true);
  tap($('mClose'), M.closeMenu);
  tap($('mMap'), () => api.press('KeyM'));
  tap($('mAuto'), () => api.press('KeyF'));
  tap($('mChute'), () => { api.press('KeyP'); vib(30); });
  tap($('mStage'), () => { const r = api.press('Space'); vib(r === 'staged' || r === 'ignite' ? [40, 30, 60] : 20); });
  root.querySelectorAll('#mMenu [data-sas]').forEach(b => tap(b, () => { api.setSAS(b.dataset.sas); vib(10); }));
  root.querySelectorAll('#mMenu [data-p]').forEach(b => tap(b, () => { const k = b.dataset.p; api.press(k); vib(10); if (['KeyR', 'KeyO', 'KeyY', 'KeyG', 'Slash', 'Escape', 'F9'].includes(k)) M.closeMenu(); }));
  tap($('mFull'), () => {
    const d = document.documentElement, rq = d.requestFullscreen || d.webkitRequestFullscreen;
    if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else if (rq) rq.call(d).catch?.(() => {});
    else api.toast('On iPhone: Share ▸ Add to Home Screen for full screen', '#9cc3ff');
  });
  // thumb stick (pitch/yaw): drag from the centre; springs back on release
  const drag = (zone, move, end) => {
    let id = null;
    zone.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); id = e.pointerId; zone.setPointerCapture && zone.setPointerCapture(id); api.unlockAudio && api.unlockAudio(); move(e); });
    zone.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
    const up = e => { if (e.pointerId === id) { id = null; end(); } };
    zone.addEventListener('pointerup', up); zone.addEventListener('pointercancel', up); zone.addEventListener('lostpointercapture', up);
  };
  const stick = $('mStick'), knob = stick.querySelector('i');
  drag(stick, e => {
    const r = stick.getBoundingClientRect(), R = r.width / 2, dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R), d = Math.hypot(dx, dy), k = d > R ? R / d : 1;
    const x = dx * k / R, y = dy * k / R, dead = v => (Math.abs(v) < 0.12 ? 0 : (v - Math.sign(v) * 0.12) / 0.88);
    input.pitch = -dead(y); input.yaw = -dead(x); // stick up = pitch toward east (same as W); left = yaw left (A)
    knob.style.transform = `translate(${dx * k}px,${dy * k}px)`;
  }, () => { input.pitch = input.yaw = 0; knob.style.transform = ''; });
  const roll = $('mRoll'), rk = roll.querySelector('i');
  drag(roll, e => { const r = roll.getBoundingClientRect(), x = clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1); input.roll = Math.abs(x) < 0.15 ? 0 : x; rk.style.left = (x + 1) * 50 + '%'; },
    () => { input.roll = 0; rk.style.left = '50%'; });
  // throttle: absolute position on a vertical slider (top = 100%)
  const thr = $('mThr');
  let thrDrag = false;
  drag(thr, e => { thrDrag = true; const r = thr.getBoundingClientRect(); api.setThrottle(clamp(1 - (e.clientY - r.top) / r.height, 0, 1)); }, () => { thrDrag = false; });
  // pinch/drag on the map and the 3D view are handled by main.js on the canvas; nothing here covers the centre
  M.render = d => {
    $('mAlt').textContent = d.alt; $('mSpd').textContent = d.spd; $('mAp').textContent = d.ap; $('mPe').textContent = d.pe;
    $('mMqL').textContent = d.mqL; $('mMq').textContent = d.mq; $('mMq').className = d.mqC || ''; $('mFuel').textContent = d.fuel; $('mScore').textContent = d.score;
    thr.querySelector('i').style.height = d.thr * 100 + '%'; thr.querySelector('u').textContent = Math.round(d.thr * 100) + '%';
    $('mAuto').classList.toggle('on', d.auto); $('mChute').classList.toggle('hidden', !d.chute); $('mHome').textContent = d.home;
    $('mRcs').classList.toggle('on', d.rcs); $('mFx').textContent = 'FX ' + d.fx; $('mWarp').textContent = d.warp;
    root.querySelectorAll('#mMenu [data-sas]').forEach(b => b.classList.toggle('on', b.dataset.sas === d.sas));
    $('mStage').classList.toggle('ready', d.stageReady);
  };
  M.show = vis => { root.classList.toggle('hidden', !vis); document.body.classList.toggle('flying', vis); if (!vis) { M.closeMenu(); M.sheet = false; document.body.classList.remove('sheet'); } wake(vis); };
  // keep the screen awake while flying (Wake Lock API; re-acquired when the page becomes visible again)
  let lock = null, want = false;
  async function wake(w) {
    want = w;
    try { if (w && !lock && navigator.wakeLock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); } else if (!w && lock) { await lock.release(); lock = null; } } catch (e) { lock = null; }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && want) wake(true); });
  M.wakeLock = () => !!lock;
  M.thrDragging = () => thrDrag;
  return M;
}

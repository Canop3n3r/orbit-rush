// Phone/tablet layout and touch controls (pointer: coarse, or ?touch to force it on a desktop).
// Compact HUD (6 readouts, tap for the full telemetry sheet), a thumb stick for pitch/yaw, a roll bar,
// a vertical throttle slider, a big STAGE button (the double-press guard lives in flight.js), and an
// overflow menu (☰) for SAS modes, RCS, warp, map, chutes, deorbit, booster, effects, Learn, fullscreen.
// Haptics (navigator.vibrate), Wake Lock while flying, safe areas are in style.css (env(safe-area-inset-*)).
import { menuHTML, menuUpdate } from './fun/flightmenu.js?v=f5.9-36';
const qs = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
export const isTouch = () => qs.has('touch') || (!qs.has('desktop') && matchMedia('(pointer: coarse)').matches);
const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); Object.assign(e, attrs); if (html) e.innerHTML = html; return e; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const SAS = [['stab', 'STAB'], ['prograde', 'PRO'], ['retrograde', 'RETRO'], ['radial', 'RAD+'], ['antiradial', 'RAD−'], ['normal', 'NRM'], ['antinormal', 'ANRM'], ['off', 'OFF']];
// Full-travel throttle. The thumb is THUMB px tall and its center runs the whole track:
// bottom of the groove is 0, top is 1, and a 0.1% step is kept (the old 8 px pads plus a 1.5% end snap ate the last bit of travel).
export const THUMB = 16;
export function thrFromY(el, y) {
  const r = el.getBoundingClientRect(), travel = Math.max(1, r.height - THUMB);
  if (y >= r.bottom - 2) return 0;
  if (y <= r.top + 2) return 1;
  const u = 1 - (y - r.top - THUMB / 2) / travel;
  return Math.round(Math.min(1, Math.max(0, u)) * 1000) / 1000;
}
// Sideways, off the track, the same vertical pixels cover less throttle (landing burns). The first move that leaves the track does not jump.
export function throttleGesture(el, e, g) {
  const r = el.getBoundingClientRect(), abs = thrFromY(el, e.clientY), dx = Math.abs(e.clientX - (r.left + r.width / 2));
  if (!g) return { fine: false, y: e.clientY, u: abs, out: abs };
  if (!g.fine && dx > r.width / 2 + 20) return { fine: true, y: e.clientY, u: g.out, out: g.out };
  if (g.fine) {
    const gain = 1 + Math.min(6, Math.max(0, dx - r.width / 2) / 28), travel = Math.max(1, r.height - THUMB);
    let u = g.u - (e.clientY - g.y) / (travel * gain);
    if (u < 0.002) u = 0; else if (u > 0.998) u = 1; else u = Math.round(Math.min(1, Math.max(0, u)) * 1000) / 1000;
    return { fine: true, y: g.y, u: g.u, out: u };
  }
  return { fine: false, y: e.clientY, u: abs, out: abs };
}
export function bindThrottleSlider(el, setU) {
  el.setAttribute('role', 'slider'); el.setAttribute('aria-label', 'Throttle'); el.setAttribute('aria-valuemin', '0'); el.setAttribute('aria-valuemax', '100');
  el.style.touchAction = 'none';
  let pid = null, gest = null;
  const down = e => { if (e.button != null && e.button !== 0) return; e.preventDefault(); e.stopPropagation(); try { el.setPointerCapture(e.pointerId); } catch (x) { } pid = e.pointerId; gest = throttleGesture(el, e, null); el._drag = true; el.classList.remove('fine'); setU(gest.out); };
  const move = e => { if (e.pointerId !== pid) return; e.stopPropagation(); gest = throttleGesture(el, e, gest); el.classList.toggle('fine', !!gest.fine); setU(gest.out); };
  const up = e => { if (e.pointerId !== pid && e.type !== 'lostpointercapture') return; pid = null; gest = null; el._drag = false; el.classList.remove('fine'); e.stopPropagation(); };
  el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
  for (const t of ['touchstart', 'touchmove', 'touchend']) el.addEventListener(t, e => { e.stopPropagation(); if (e.cancelable && t !== 'touchend') e.preventDefault(); }, { passive: false });
  return { dragging: () => !!el._drag };
}
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
    <div id="mright"><button id="mAuto">AUTO</button><button id="mChute" class="hidden">CHUTE</button><button id="mStage">STAGE</button><button id="mAbort" data-p="Backspace" aria-label="Abort">⛔<span class="mAbT"> ABORT</span></button>
      <div id="mThr" data-l="thr"><i></i><s></s><b>THR</b><u>0%</u></div></div>
    <div id="mMenu" class="hidden"><div class="mh"><b>Menu</b><span id="mWarp" hidden></span><button id="mClose" aria-label="Close">✕</button></div>
      <div id="mWarpFold" aria-label="Time warp"><button id="mWarpDn" type="button" aria-label="Slower time warp">◀◀</button><button id="mWarpVal" type="button" aria-label="Cancel time warp">×1</button><button id="mWarpUp" type="button" aria-label="Faster time warp">▶▶</button></div>
      <div class="mg mTop">${menuHTML()}</div>
      <div hidden><button id="mRcs"></button><button id="mFx"></button></div></div>`; // f5.6d (owner video + QA #8): one compact side sheet, ~10 big buttons, one Home, one chute, no debug text
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
  root.querySelectorAll('#mMenu [data-p]').forEach(b => tap(b, () => { const k = b.dataset.p; api.press(k); vib(10); if (['KeyR', 'KeyO', 'KeyY', 'KeyG', 'Slash', 'Escape', 'F9', 'Quote'].includes(k)) M.closeMenu(); }));
  // Phone AUTO hides the top-bar ▶▶ (it was the sixth flight button). These three stay inside ☰.
  for (const [id, code] of [['mWarpDn', 'Comma'], ['mWarpVal', 'Slash'], ['mWarpUp', 'Period']]) {
    const el = $(id); let at = 0;
    el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); at = performance.now(); api.unlockAudio && api.unlockAudio(); api.press(code); vib(10); });
    el.addEventListener('click', e => { e.stopPropagation(); if (performance.now() - at < 700) return; api.press(code); });
  }
  tap($('mAbort'), () => { api.press('Backspace'); vib(30); });
  { const fb = root.querySelector('[data-full]'); if (fb) tap(fb, () => { /* f5.9-10: ⛶ moved to the Pause sheet */
    const d = document.documentElement, rq = d.requestFullscreen || d.webkitRequestFullscreen;
    if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else if (rq) rq.call(d).catch?.(() => {});
    else api.toast('On iPhone: Share ▸ Add to Home Screen for full screen', '#9cc3ff');
  }); }
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
  // throttle: full-travel groove (top = 100%). Dragging off to the side stretches the same pixels into a finer range.
  const thr = $('mThr');
  const thrCtl = bindThrottleSlider(thr, u => api.setThrottle(u)); /* f5.9-10: the slider owns its pointer so Chrome does not retarget the touch onto RELEASE */
  // pinch/drag on the map and the 3D view are handled by main.js on the canvas; nothing here covers the centre
  M.render = d => {
    $('mAlt').textContent = d.alt; $('mSpd').textContent = d.spd; $('mAp').textContent = d.ap; $('mPe').textContent = d.pe;
    $('mMqL').textContent = d.mqL; $('mMq').textContent = d.mq; $('mMq').className = d.mqC || ''; $('mFuel').textContent = d.fuel; $('mScore').textContent = d.score;
    thr.style.setProperty('--t', d.thr.toFixed(3)); { const fine = thr.classList.contains('fine'), pct = fine ? (d.thr * 100).toFixed(1) : String(Math.round(d.thr * 100)); const lab = thr.querySelector('u'); const txt = pct === '0' || pct === '0.0' ? '' : pct + '%'; if (lab.textContent !== txt) lab.textContent = txt; thr.setAttribute('aria-valuenow', pct); thr.setAttribute('aria-valuetext', pct + '%'); } /* f5.9-31 (QA orbit_toast): a cutoff track is already empty; "0%" was the sixth word */
    $('mAuto').classList.toggle('on', d.auto); { const t = 'AUTO'; /* f5.6u (QA P1 budgets): the lit button + dot says ON; one word */ if ($('mAuto').textContent !== t) $('mAuto').textContent = t; } $('mChute').classList.toggle('hidden', !d.chute); menuUpdate($('mMenu'), { fleet: !!d.fleet, booster: !!d.booster, ret: /CANCEL/.test(d.home || ''), chute: d.hasChute, canHome: d.canHome });
    $('mRcs').classList.toggle('on', d.rcs); $('mFx').textContent = 'FX ' + d.fx; $('mWarp').textContent = d.warp;
    { const vx = $('mWarpVal'), xn = d.warpX > 1 ? '×' + d.warpX : '×1'; if (vx && vx.textContent !== xn) vx.textContent = xn; const dn = $('mWarpDn'); if (dn) dn.hidden = !(d.warpX > 1); }
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
  M.thrDragging = () => thrCtl.dragging();
  return M;
}

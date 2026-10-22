// Milestone Q UI: pause menu, settings (key remap, sensitivity, units, overlays), the Δv map and rich part
// tooltips. DOM only; the logic it shows lives in settings.js, physics/dvmap.js and parts.js.
import { ACTIONS, keyOf, bindKey, resetKeys, saveSettings, DEFAULT_KEYS } from './settings.js?v=f5.6i';
import { dvMap, ORBIT_DV, LEO } from './physics/dvmap.js?v=f5.6i';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const keyName = c => !c ? '—' : c.startsWith('Key') ? c.slice(3) : c.startsWith('Digit') ? c.slice(5) : ({ Space: 'Space', ShiftLeft: 'Shift', ControlLeft: 'Ctrl', Comma: ',', Period: '.', Slash: '/', Backquote: '`', Backslash: '\\', Escape: 'Esc', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Minus: '−', Equal: '=' })[c] || c;
const fdv = x => x === null || x === undefined ? '—' : (x / 1000).toFixed(2);
const fdays = s => s < 86400 * 2 ? (s / 3600).toFixed(0) + ' h' : s < 86400 * 400 ? (s / 86400).toFixed(0) + ' d' : (s / 86400 / 365.25).toFixed(1) + ' y';
// Δv map table. have: Δv available (m/s) — rows the craft can afford are marked; fromSurface adds the 9.4 km/s to LEO
export function dvTableHTML(have, fromSurface) {
  const rows = dvMap(), base = fromSurface ? ORBIT_DV : 0;
  const ok = r => have !== null && have !== undefined && have >= base + r.eject + r.capture;
  const okL = r => ok(r) && r.land !== null && have >= base + r.total;
  return `<div class="dvmap"><p class="sm">Ideal Δv in km/s (patched conics, Hohmann). Surface → LEO (${LEO / 1000} km) costs <b>${(ORBIT_DV / 1000).toFixed(1)}</b>.
    ${have !== null && have !== undefined ? `Your Δv${fromSurface ? ' (from the pad)' : ' (left now)'}: <b>${(have / 1000).toFixed(2)}</b> — <span class="good">✔ reach</span> / <span class="good">⬇ land</span> marked.` : ''}</p>
    <table><tr><th>Body</th><th title="Burn from low Earth orbit onto the transfer">LEO →</th><th title="Capture into a low orbit on arrival">capture</th><th title="Low orbit → surface (airless: ~ the same back up)">land</th><th>trip</th><th></th></tr>
    ${rows.map(r => `<tr class="${r.parent === 'sun' || r.parent === 'earth' ? '' : 'moonrow'}"><td>${r.parent !== 'sun' ? '↳ ' : ''}${esc(r.name)}</td><td>${fdv(r.eject)}</td><td>${fdv(r.capture)}</td><td title="${esc(r.landNote)}">${r.land === null ? '—' : fdv(r.land)}${r.land !== null && /atmos/.test(r.landNote) ? '*' : ''}</td><td>${fdays(r.transfer)}</td><td>${okL(r) ? '<span class="good">⬇</span>' : ok(r) ? '<span class="good">✔</span>' : ''}</td></tr>`).join('')}</table>
    <p class="sm">* has an atmosphere: aerobraking and parachutes can replace most of the landing burn.</p></div>`;
}
export function createQoL(api) {
  const $ = id => document.getElementById(id);
  const root = document.createElement('div'); root.id = 'qol';
  root.innerHTML = `<div id="pause" class="modal hidden"><div class="mbox"><h2>⏸ Paused</h2>
      <div class="col"><button data-q="resume" class="big">▶ Resume<kbd> (Esc)</kbd></button><button data-q="save">💾 Quicksave<kbd> (F5)</kbd></button><button data-q="load">📂 Quickload<kbd> (F9)</kbd></button>
      <button data-q="revertLaunch">↺ Revert to launch</button><button data-q="hangar">🏗 Revert to hangar</button><button data-q="settings">⚙ Settings</button><button data-q="dv">Δv map</button></div>
      <p id="qsInfo" class="sm"></p></div></div>
    <div id="settings" class="modal hidden"><div class="mbox wide"><h2>⚙ Settings</h2><div id="setBody"></div><div class="row"><button data-q="closeSet" class="big">Done</button></div></div></div>
    <div id="dvModal" class="modal hidden"><div class="mbox wide"><h2>Δv map</h2><div id="dvBody"></div><div class="row"><button data-q="closeDv" class="big">Close</button></div></div></div>
    <div id="tip" class="hidden"></div>`;
  document.body.appendChild(root);
  let listening = null;
  const S = () => api.settings();
  function show(id, on) { $(id).classList.toggle('hidden', !on); }
  function renderSettings() {
    const s = S();
    $('setBody').innerHTML = `<div class="setGrid">
      <section><h4>Units</h4><label><input type="radio" name="units" value="metric" ${s.units === 'metric' ? 'checked' : ''}> Metric (km, m/s)</label><label><input type="radio" name="units" value="imperial" ${s.units === 'imperial' ? 'checked' : ''}> Imperial (mi, ft, ft/s)</label>
        <h4>Sensitivity</h4>${[['cam', 'Camera drag'], ['zoom', 'Zoom'], ['stick', 'Touch stick']].map(([k, l]) => `<label>${l} <input type="range" min="0.25" max="3" step="0.05" data-sens="${k}" value="${s.sens[k]}"> <b>${(+s.sens[k]).toFixed(2)}×</b></label>`).join('')}
        <h4>View</h4><label><input type="checkbox" data-set="overlay" ${s.overlay ? 'checked' : ''}> CoM / CoP / CoT markers in flight</label>
        <label>Flight camera <select data-set="camStyle"><option value="free" ${s.camStyle === 'free' ? 'selected' : ''}>Free (horizon up)</option><option value="locked" ${s.camStyle === 'locked' ? 'selected' : ''}>Locked to the craft</option></select></label>
        <label>Map patches <select data-set="conic"><option value="body" ${s.conic === 'body' ? 'selected' : ''}>Relative to their body</option><option value="parent" ${s.conic === 'parent' ? 'selected' : ''}>Moon patches as seen from the planet</option></select></label></section>
      <section class="qKeys"><h4>Keys <button data-q="resetKeys" class="ghost">Reset all</button></h4><div class="keys">${ACTIONS.map(([a, l]) => `<div class="krow"><span>${esc(l)}</span><button data-key="${a}" class="${listening === a ? 'listen' : ''} ${keyOf(s, a) !== DEFAULT_KEYS[a] ? 'changed' : ''}">${listening === a ? 'press a key…' : esc(keyName(keyOf(s, a)))}</button></div>`).join('')}</div>
        <p class="sm">Click an action, then press the new key (Esc cancels). A key used elsewhere is moved here.</p></section></div>`;
  }
  root.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return; const q = t.dataset.q;
    if (t.dataset.key) { listening = listening === t.dataset.key ? null : t.dataset.key; renderSettings(); return; }
    if (q === 'resume') api.resume();
    if (q === 'save') { api.quicksave(); info(); } if (q === 'load') api.quickload();
    if (q === 'revertLaunch') api.revertLaunch(); if (q === 'hangar') api.hangar();
    if (q === 'settings') { renderSettings(); show('settings', true); }
    if (q === 'closeSet') { listening = null; show('settings', false); }
    if (q === 'resetKeys') { resetKeys(S()); commit(); }
    if (q === 'dv') openDv(); if (q === 'closeDv') show('dvModal', false);
  });
  root.addEventListener('input', e => { const t = e.target, s = S();
    if (t.dataset.sens) { s.sens[t.dataset.sens] = +t.value; t.nextElementSibling.textContent = (+t.value).toFixed(2) + '×'; commit(true); }
    if (t.name === 'units') { s.units = t.value; commit(); }
    if (t.dataset.set === 'overlay') { s.overlay = t.checked; commit(); }
    if (t.dataset.set === 'camStyle' || t.dataset.set === 'conic') { s[t.dataset.set] = t.value; commit(); } });
  function commit(soft) { saveSettings(localStorage, S()); api.onSettings(S()); if (!soft) renderSettings(); }
  // capture the next key while remapping (before the game sees it)
  addEventListener('keydown', e => { if (!listening) return; e.preventDefault(); e.stopImmediatePropagation(); if (e.code !== 'Escape') bindKey(S(), listening, e.code); listening = null; commit(); }, true);
  function info() { const q = api.quickInfo(); $('qsInfo').textContent = q ? `Quicksave: ${q}` : 'No quicksave yet'; }
  function openDv() { $('dvBody').innerHTML = api.dvTable(); show('dvModal', true); }
  // ---------- tooltips (hover on desktop; the ⓘ button on touch) ----------
  const tip = $('tip'); let tipFor = null;
  function showTip(el, html, x, y) { tip.innerHTML = html; tip.classList.remove('hidden'); tipFor = el;
    const r = tip.getBoundingClientRect(), W = innerWidth, H = innerHeight; tip.style.left = Math.max(6, Math.min(W - r.width - 6, x + 14)) + 'px'; tip.style.top = Math.max(6, Math.min(H - r.height - 6, y + 14)) + 'px'; }
  function hideTip() { tip.classList.add('hidden'); tipFor = null; }
  function attachTip(el, htmlFn, touch) {
    if (touch) { const b = document.createElement('button'); b.className = 'tipBtn'; b.textContent = 'ⓘ'; b.setAttribute('aria-label', 'Part details');
      b.onclick = ev => { ev.stopPropagation(); if (tipFor === el) hideTip(); else { const r = b.getBoundingClientRect(); showTip(el, htmlFn(), r.left - 200, r.bottom); } }; el.appendChild(b); return; }
    el.addEventListener('pointerenter', ev => { if (ev.pointerType === 'mouse') showTip(el, htmlFn(), ev.clientX, ev.clientY); });
    el.addEventListener('pointermove', ev => { if (tipFor === el && ev.pointerType === 'mouse') { const r = tip.getBoundingClientRect(); tip.style.left = Math.min(innerWidth - r.width - 6, ev.clientX + 14) + 'px'; tip.style.top = Math.min(innerHeight - r.height - 6, ev.clientY + 14) + 'px'; } });
    el.addEventListener('pointerleave', () => { if (tipFor === el) hideTip(); });
  }
  addEventListener('pointerdown', e => { if (tipFor && !e.target.closest('.tipBtn') && !e.target.closest('#tip')) hideTip(); });
  return {
    pause(on) { show('pause', on); if (on) info(); else { show('settings', false); show('dvModal', false); } },
    get paused() { return !$('pause').classList.contains('hidden'); },
    openSettings() { renderSettings(); show('settings', true); }, openDv, attachTip, hideTip,
    get busy() { return !!listening || !$('settings').classList.contains('hidden') || !$('dvModal').classList.contains('hidden'); },
  };
}

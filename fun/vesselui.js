// The craft list (f6.2): every craft left in space, with FLY (take control), VIEW (look at it) and its power switch. One isolated module:
// it builds its own panel from the shared CSS tokens (style.css, "vessels" block) and talks to the game only through the options below.
import { typeOf, PROPULSION } from '../data/craft_types.js?v=f5.8y';
const ICON = { cubesat: '▫️', smallsat: '🛰', leosat: '🛰', navsat: '📡', comsat: '📡', geosat: '📡', probe: '🔭', crew: '🚀', cargo: '📦', station: '🏗', lander: '🌙', tug: '🛠', kick: '🔥', rideshare: '🗃', roadster: '🚗', stage: '🚀' };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// opts: { getF, UN (fun/units.js), onView(id|null), getView(), after() }
export function createVesselUI(opts) {
  const { getF, UN, onView = () => {}, getView = () => null } = opts;
  const root = document.createElement('div'); root.id = 'vsl'; root.className = 'hidden'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Craft in space');
  root.innerHTML = '<div class="vh"><b>Craft in space</b><span class="vn"></span><button class="vx" data-a="close" aria-label="Close craft list">✕</button></div><div class="vl"></div><div class="vf">[ ] switch craft · - power on/off · tap FLY to take control</div>';
  document.body.appendChild(root);
  const list = root.querySelector('.vl'), count = root.querySelector('.vn'); let sig = '', timer = 0;
  const bat = r => r.battery == null ? '' : `<i class="vbat${r.brown ? ' bad' : r.battery < 20 ? ' low' : ''}" title="Battery ${r.battery}%"><u style="width:${Math.max(2, r.battery)}%"></u></i>`;
  const stats = r => { const a = Number.isFinite(r.alt) ? UN.big(r.alt) : '–', o = Number.isFinite(r.pe) && r.pe > -1e9 ? `${UN.big(r.pe)} × ${UN.big(r.ap)}` : '–'; return `Alt ${a} · ${o} · Δv ${UN.dv(Math.max(0, r.dv || 0))}${r.sun === 0 ? ' · in shadow' : ''}`; };
  function draw() {
    const F = getF(); if (!F || !F.vesselList) return; const rows = F.vesselList(), view = getView();
    const s = rows.map(r => [r.id, r.active, r.power, r.brown, view === r.id].join(':')).join('|'); count.textContent = rows.length + (rows.length === 1 ? ' vessel' : ' vessels');
    if (s !== sig) { sig = s;
      list.innerHTML = rows.map(r => { const T = typeOf(r.type), P = PROPULSION[T.prop] || PROPULSION.none;
        return `<div class="vr${r.active ? ' act' : ''}${view === r.id ? ' vw' : ''}" data-id="${esc(r.id)}"><span class="vi" aria-hidden="true">${ICON[r.type] || '🛰'}</span>
          <span class="vm"><b>${esc(r.name)}</b><small>${esc(T.cls)} · ${esc(P.name)}${r.origin ? ' · launch stage' : ''}</small><small class="vs"></small>${bat(r)}</span>
          <span class="vb"><button data-a="fly"${r.active ? ' disabled' : ''}>${r.active ? 'FLYING' : 'FLY'}</button><button data-a="view"${r.active ? ' disabled' : ''} class="${view === r.id ? 'on' : ''}">${view === r.id ? 'VIEWING' : 'VIEW'}</button>${r.hasPower ? `<button data-a="pow" class="${r.power ? 'on' : ''}" aria-pressed="${r.power}" title="Switch this craft ${r.power ? 'off' : 'on'}">⏻ ${r.power ? 'ON' : 'OFF'}</button>` : ''}</span></div>`; }).join(''); }
    list.querySelectorAll('.vr').forEach(el => { const r = rows.find(x => x.id === el.dataset.id); const t = el.querySelector('.vs'); if (r && t) t.textContent = stats(r); });
  }
  const open = () => { root.classList.remove('hidden'); document.body.classList.add('vslOn'); sig = ''; draw(); clearInterval(timer); timer = setInterval(draw, 700); };
  const close = () => { root.classList.add('hidden'); document.body.classList.remove('vslOn'); clearInterval(timer); };
  const toggle = () => (root.classList.contains('hidden') ? open() : close());
  root.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const a = b.dataset.a, F = getF(); if (a === 'close') { close(); return; } b.blur();
    const id = b.closest('.vr') && b.closest('.vr').dataset.id; if (!id || !F) return;
    if (a === 'fly') { if (F.switchTo(id)) { onView(null); close(); } else draw(); }
    else if (a === 'view') onView(getView() === id ? null : id);
    else if (a === 'pow') F.setVesselPower(id, !F.vesselList().find(r => r.id === id).power);
    sig = ''; draw(); });
  addEventListener('keydown', e => { if (e.code === 'Escape' && !root.classList.contains('hidden')) { close(); e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  return { open, close, toggle, draw, isOpen: () => !root.classList.contains('hidden'), el: root };
}

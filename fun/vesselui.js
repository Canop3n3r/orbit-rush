// The craft list (f6.2): every craft left in space, with FLY (take control), VIEW (look at it) and its power switch. One isolated module:
// it builds its own panel from the shared CSS tokens (style.css, "vessels" block) and talks to the game only through the options below.
// OR-003: once there are enough craft to crowd the sheet, the same grouping and filter as the map tracking list (fun/tracksheet.js).
import { typeOf, PROPULSION } from '../data/craft_types.js?v=f5.8y';
import { filterRows, groupRows, chipsFor, COLLAPSE_AT } from './tracksheet.js?v=f5.9-32';
const ICON = { cubesat: '▫️', smallsat: '🛰', leosat: '🛰', navsat: '📡', comsat: '📡', geosat: '📡', probe: '🔭', crew: '🚀', cargo: '📦', station: '🏗', lander: '🌙', tug: '🛠', kick: '🔥', rideshare: '🗃', roadster: '🚗', stage: '🚀' };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const bodyLabel = id => id ? id.charAt(0).toUpperCase() + id.slice(1) : '';
// opts: { getF, UN (fun/units.js), onView(id|null), getView(), after() }
export function createVesselUI(opts) {
  const { getF, UN, onView = () => {}, getView = () => null } = opts;
  const root = document.createElement('div'); root.id = 'vsl'; root.className = 'hidden'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Craft in space');
  root.innerHTML = '<div class="vh"><b>Craft in space</b><span class="vn"></span><button class="vx" data-a="close" aria-label="Close craft list">✕</button></div><div class="vfilt" hidden></div><div class="vl"></div><div class="vf">[ ] switch craft · - power on/off · tap FLY to take control</div>';
  document.body.appendChild(root);
  const list = root.querySelector('.vl'), count = root.querySelector('.vn'), filt = root.querySelector('.vfilt'); let sig = '', timer = 0, q = '', chip = 'all', force = {};
  const bat = r => r.battery == null ? '' : `<i class="vbat${r.brown ? ' bad' : r.battery < 20 ? ' low' : ''}" title="Battery ${r.battery}%"><u style="width:${Math.max(2, r.battery)}%"></u></i>`;
  const stats = r => { const a = Number.isFinite(r.alt) ? UN.big(r.alt) : '–', o = Number.isFinite(r.pe) && r.pe > -1e9 ? `${UN.big(r.pe)} × ${UN.big(r.ap)}` : '–'; return `Alt ${a} · ${o} · Δv ${UN.dv(Math.max(0, r.dv || 0))}${r.sun === 0 ? ' · in shadow' : ''}`; };
  const rowHTML = (r, view) => { const T = typeOf(r.type), P = PROPULSION[T.prop] || PROPULSION.none;
    return `<div class="vr${r.active ? ' act' : ''}${view === r.id ? ' vw' : ''}" data-id="${esc(r.id)}"><span class="vi" aria-hidden="true">${ICON[r.type] || '🛰'}</span>
      <span class="vm"><b>${esc(r.name)}</b><small>${esc(T.cls)} · ${esc(P.name)}${r.origin ? ' · launch stage' : ''}</small><small class="vs"></small>${bat(r)}</span>
      <span class="vb"><button data-a="fly"${r.active ? ' disabled' : ''}>${r.active ? 'FLYING' : 'FLY'}</button><button data-a="view"${r.active ? ' disabled' : ''} class="${view === r.id ? 'on' : ''}">${view === r.id ? 'VIEWING' : 'VIEW'}</button>${r.hasPower ? `<button data-a="pow" class="${r.power ? 'on' : ''}" aria-pressed="${r.power}" title="Switch this craft ${r.power ? 'off' : 'on'}">⏻ ${r.power ? 'ON' : 'OFF'}</button>` : ''}</span></div>`; };
  function listHTML(rows, view, here) {
    if (rows.length < COLLAPSE_AT) return rows.map(r => rowHTML(r, view)).join('');
    const filtered = filterRows(rows, { q, chip, here });
    if (!filtered.length) return '<div class="vempty">Nothing matches</div>';
    const sections = groupRows(filtered, { force, focusKey: 'craft', here });
    return sections.map(sec => {
      const head = sections.length > 1 ? `<div class="vsec">${esc(bodyLabel(sec.body))}</div>` : '';
      return head + sec.groups.map(g => {
        const showHead = !g.open || g.n >= 3;
        const h = showHead ? `<button type="button" class="vg" data-a="group" data-g="${esc(sec.body + '|' + g.key)}" aria-expanded="${g.open ? 'true' : 'false'}">${g.open ? '▾' : '▸'} ${esc(g.label)} · ${g.n}</button>` : '';
        return h + (g.open ? g.rows.map(r => rowHTML(r, view)).join('') : '');
      }).join('');
    }).join('');
  }
  function filtHTML(rows, here) {
    if (rows.length < COLLAPSE_AT) return '';
    const chips = chipsFor(rows, here);
    return `<div class="vchips">${chips.map(c => `<button type="button" data-a="chip" data-chip="${esc(c.id)}" class="${c.id === chip ? 'on' : ''}">${esc(c.label)} ${c.n}</button>`).join('')}</div><input class="vq" type="text" placeholder="Find" value="${esc(q)}" aria-label="Filter craft" autocomplete="off" spellcheck="false">`;
  }
  function draw() {
    const F = getF(); if (!F || !F.vesselList) return; let rows = []; try { rows = F.vesselList() || []; } catch (e) { return; }
    const view = getView(), here = F.body || null, show = rows.length >= COLLAPSE_AT;
    const s = rows.map(r => [r.id, r.active, r.power, r.brown, view === r.id].join(':')).join('|') + '|' + q + '|' + chip + '|' + JSON.stringify(force);
    count.textContent = rows.length + (rows.length === 1 ? ' vessel' : ' vessels'); filt.hidden = !show;
    if (s !== sig) { sig = s;
      const typing = document.activeElement && document.activeElement.classList.contains('vq'), caret = typing ? document.activeElement.selectionStart : 0, top = list.scrollTop;
      filt.innerHTML = filtHTML(rows, here); list.innerHTML = listHTML(rows, view, here);
      const inp = filt.querySelector('.vq'); if (typing && inp) { inp.focus(); try { inp.setSelectionRange(caret, caret); } catch (e) {} }
      list.scrollTop = top; }
    list.querySelectorAll('.vr').forEach(el => { const r = rows.find(x => x.id === el.dataset.id); const t = el.querySelector('.vs'); if (r && t) t.textContent = stats(r); });
  }
  const open = () => { root.classList.remove('hidden'); document.body.classList.add('vslOn'); sig = ''; draw(); clearInterval(timer); timer = setInterval(draw, 700); };
  const close = () => { root.classList.add('hidden'); document.body.classList.remove('vslOn'); clearInterval(timer); };
  const toggle = () => (root.classList.contains('hidden') ? open() : close());
  root.addEventListener('input', e => { if (!e.target.classList.contains('vq')) return; q = e.target.value; sig = ''; draw(); });
  root.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const a = b.dataset.a, F = getF();
    if (a === 'close') { close(); return; }
    if (a === 'chip') { chip = b.dataset.chip || 'all'; sig = ''; draw(); return; }
    if (a === 'group') { const k = b.dataset.g; force[k] = b.getAttribute('aria-expanded') === 'true' ? 'shut' : 'open'; sig = ''; draw(); return; }
    b.blur();
    const id = b.closest('.vr') && b.closest('.vr').dataset.id; if (!id || !F) return;
    if (a === 'fly') { if (F.switchTo(id)) { onView(null); close(); } else draw(); }
    else if (a === 'view') onView(getView() === id ? null : id);
    else if (a === 'pow') { const row = F.vesselList().find(r => r.id === id); if (row) F.setVesselPower(id, !row.power); }
    sig = ''; draw(); });
  addEventListener('keydown', e => { if (e.code === 'Escape' && !root.classList.contains('hidden')) { close(); e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  return { open, close, toggle, draw, isOpen: () => !root.classList.contains('hidden'), el: root };
}

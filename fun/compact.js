// Compact flight HUD (f1u): thin edge strips, one short self-hiding text line, everything secondary in one drawer.
// It re-parents existing controls (warp arrows, MAP, ☰, TAKE OVER, Pilot buttons, desktop #ctl) so their handlers keep working.
import * as UN from './units.js?v=f5.8l';
import { menuHTML, menuUpdate, toggleFull } from './flightmenu.js?v=f5.8l';
const $ = id => document.getElementById(id);
// f2: hints are whole phrases, never cut mid-word with "…". Keep the first clause; if it still runs past
// two lines (~76 chars) drop trailing comma-clauses, then trailing words at a word boundary.
export const HINT_MAX = 76;
export function shortHint(s) {
  if (!s) return '';
  let t = String(s).replace(/\s+/g, ' ').trim().replace(/…$/, '');
  const cut = [' — ', ' (', '. ', '; ', ' – ', ' | ', '…'].map(k => t.indexOf(k)).filter(i => i > 8);
  if (cut.length) t = t.slice(0, Math.min(...cut));
  while (t.length > HINT_MAX && /, (?=[^,]*$)/.test(t)) { const i = t.lastIndexOf(', '); if (i < 8) break; t = t.slice(0, i); }
  while (t.length > HINT_MAX && t.includes(' ')) t = t.slice(0, t.lastIndexOf(' '));
  return t.replace(/[,:;\s]+$/, '');
}
export function createCompact({ touch, onSpeedTap, onMarkers, onEngTap, press, menuState }) {
  document.body.classList.add('cx');
  const strip = document.createElement('div'); strip.id = 'strip';
  strip.innerHTML = `<div id="sL"><div class="c"><b>ALT mi</b><i id="sAlt">—</i></div><button class="c" id="sSpdB" title="Speed reference: surface / orbit / target" aria-label="Speed reference"><b id="sSpdL">SRF mph</b><i id="sSpd">—</i></button><div class="c ev"><b id="sEvL">AP · PE</b><i id="sEv">—</i></div></div><div id="sR"></div>`;
  document.body.appendChild(strip);
  const strip2 = document.createElement('div'); strip2.id = 'strip2'; // f5.4 (QA F1): periapsis, fuel left in this stage, stage n/N
  strip2.innerHTML = '<div class="c"><b>PE mi</b><i id="sPe">—</i></div><div class="c"><b>FUEL</b><i id="sFuel">—</i></div><div class="c"><b>STAGE</b><i id="sStg">—</i></div>'; document.body.appendChild(strip2);
  const hintS = document.createElement('div'); hintS.id = 'hintS'; hintS.setAttribute('role', 'status'); document.body.appendChild(hintS);
  // Engineer view in the compact language: 8 fixed slots under the strip (phones) or down the left edge (wide)
  const ENG = [['eMach', 'MACH'], ['eQ', 'Q kPa'], ['eG', 'G'], ['eVs', 'V/S ft/s'], ['eDv', 'Δv ft/s'], ['eFuel', 'FUEL'], ['eThr', 'THR'], ['eHeat', 'HEAT kW']];
  const eng = document.createElement('button'); eng.id = 'engS'; eng.className = 'hidden'; eng.setAttribute('aria-label', 'Engineer readouts, tap for the full sheet');
  eng.innerHTML = ENG.map(([id, l]) => `<span class="c"><b>${l}</b><i id="${id}">—</i></span>`).join(''); document.body.appendChild(eng);
  eng.onclick = e => { e.currentTarget.blur(); onEngTap && onEngTap(); };
  const R = $('sR');
  $('sSpdB').onclick = e => { e.currentTarget.blur(); onSpeedTap && onSpeedTap(); };
  for (const id of ['wDn', 'wVal', 'wUp']) { const b = $(id); if (b) R.appendChild(b); }
  const take = $('pTake'); if (take) { take.textContent = '✋'; take.title = 'Take over from the mission director'; take.setAttribute('aria-label', 'Take over'); R.prepend(take); }
  // drawer: Pilot group (objective, engineer, photo, sound) + desktop flight buttons
  const group = document.createElement('div'); group.id = 'dPilot'; group.className = 'mg';
  group.innerHTML = '<h5>Pilot</h5>';
  for (const id of ['pObj', 'pEng', 'pPhoto', 'pMute']) { const e = $(id); if (e) group.appendChild(e); }
  const mk = document.createElement('button'); mk.id = 'pMark'; mk.textContent = '◎'; mk.title = 'Flight markers on the rocket (tag, arrows, stage rings)'; mk.setAttribute('aria-label', 'Flight markers'); mk.setAttribute('aria-pressed', 'false');
  mk.onclick = e => { e.currentTarget.blur(); const on = mk.getAttribute('aria-pressed') !== 'true'; onMarkers && onMarkers(on); }; group.appendChild(mk);
  let drawer;
  if (touch) { R.appendChild($('mMap')); R.appendChild($('mMenuBtn')); drawer = $('mMenu'); const stash = document.createElement('div'); stash.hidden = true; stash.id = 'dStash'; document.body.appendChild(stash); stash.appendChild(group); } // f5.6h (QA P1): no icon-only Pilot row in the one menu // f5.1h: the Pilot group lives under More
  else {
    const mb = document.createElement('button'); mb.id = 'dMap'; mb.textContent = 'MAP'; mb.title = 'Map (M)'; R.appendChild(mb);
    const db = document.createElement('button'); db.id = 'dMenuBtn'; db.textContent = '☰'; db.setAttribute('aria-label', 'More'); R.appendChild(db);
    drawer = document.createElement('div'); drawer.id = 'dMenu'; drawer.className = 'hidden'; document.body.appendChild(drawer);
    // f5.6h (QA P1): the desktop ☰ is the SAME menu as the phone's (fun/flightmenu.js); the old Pilot / Flight / Score groups stay off-screen so their handlers keep working
    const stash = document.createElement('div'); stash.hidden = true; stash.id = 'dStash'; document.body.appendChild(stash); stash.appendChild(group); if ($('ctl')) stash.appendChild($('ctl')); { const sc = $('score'); if (sc) stash.appendChild(sc); }
    drawer.innerHTML = `<div class="mh"><b>Menu</b><button id="dClose" aria-label="Close">✕</button></div><div class="mg mTop">${menuHTML()}</div>`;
    drawer.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; b.blur(); if (b.id === 'dClose') { drawer.classList.add('hidden'); return; } if (b.dataset.full) toggleFull(); else if (b.dataset.p && press) press(b.dataset.p); drawer.classList.add('hidden'); });
    db.onclick = e => { e.currentTarget.blur(); if (drawer.classList.contains('hidden')) menuUpdate(drawer, menuState ? menuState() : {}); drawer.classList.toggle('hidden'); };
    document.addEventListener('pointerdown', e => { if (!drawer.classList.contains('hidden') && !e.target.closest('#dMenu,#dMenuBtn')) drawer.classList.add('hidden'); }, true);
  }
  // one text line: callout > newest toast > hint; the hint shows for 5 s after it changes, then hides
  let hintText = '', hintT = 0;
  const last = {};
  const set = (id, txt) => { if (last[id] !== txt) { last[id] = txt; $(id).textContent = txt; } };
  function update(d) { // { alt, spd, spdL, evL, ev, hint, now }
    { const L = UN.bigLab(), D = UN.dvLab(); if (update.u !== L + D) { update.u = L + D; const a0 = strip.querySelector('#sL .c b'), p0 = strip2.querySelector('.c b'); if (a0) a0.textContent = 'ALT ' + L; if (p0) p0.textContent = 'PE ' + L; for (const [id, l] of [['eVs', 'V/S '], ['eDv', 'Δv ']]) { const c = document.getElementById(id); const b = c && c.parentElement && c.parentElement.querySelector('b'); if (b) b.textContent = l + D; } } } // f5.7q: labels follow the Units setting
    set('sAlt', d.alt); set('sPe', d.pe ?? '—'); set('sFuel', d.fuel ?? '—'); set('sStg', d.stg ?? '—'); set('sSpd', d.spd); set('sSpdL', d.spdL); set('sEvL', d.evL); set('sEv', d.ev);
    const now = d.now ?? performance.now(), h = shortHint(d.hint);
    if (h !== hintText) { hintText = h; hintT = now; set('hintS', h); }
    const call = document.querySelector('#callout.show'), toast = $('toasts') && $('toasts').lastElementChild;
    let txt = '', kind = '';
    if (call) { txt = shortHint(call.textContent); kind = 'call'; }
    else if (toast) { txt = shortHint(toast.textContent); kind = 'toast'; }
    else if (hintText && now - hintT < 5000) { txt = hintText; kind = 'hint'; }
    set('hintS', txt); hintS.className = txt ? 'on ' + kind : '';
  }
  function updateEng(d) { const on = !!d; eng.classList.toggle('hidden', !on); if (!on) return; eng.classList.toggle('pB', Math.floor(performance.now() / 4000) % 2 === 1); for (const k in d) set(k, d[k]); }
  return { update, updateEng, strip, drawer, eng };
}

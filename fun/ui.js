// Orbit Rush f1 — the fun layer's DOM: Pilot HUD (gauges, fuel rings, mini-globe, objective, callouts) with an
// Engineer toggle, the Missions & Progress hub, Planetary Atlas, first-visit reveals, photo mode, the
// "Will it fly?" ghost trajectory, the wind tunnel and the disassembly card. Everything reads state through
// the ctx the renderer passes in; nothing here touches the physics directly.
import * as UN from './units.js?v=f5.8l';
import { MISSIONS } from './director.js?v=f5.8l';
import { CONTRACTS, ACHIEVEMENTS, PAINTS, DECALS, dailyChallenge, nextContract, isUnlocked } from './progress.js?v=f5.8l';
import { ATLAS, poisOf } from './lore.js?v=f5.8l';
const $ = id => document.getElementById(id), esc = s => String(s).replace(/[<&]/g, c => c === '<' ? '&lt;' : '&amp;');
const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); Object.assign(e, attrs); if (html) e.innerHTML = html; return e; };
import { createNavball } from './navball.js?v=f5.8l';
export function createFunUI(ctx) {
  const ENG_KEY = 'orbitrush.engineer';
  let engineer = (() => { try { return localStorage.getItem(ENG_KEY) === '1'; } catch (e) { return false; } })();
  // ---------- Pilot HUD ----------
  const hud = el('div', { id: 'pilot', className: 'hidden' }, `
    <div class="pGauge"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" class="trk"/><circle id="pAltArc" cx="60" cy="60" r="52" class="arc"/><circle cx="60" cy="60" r="40" class="trk2"/><circle id="pSpdArc" cx="60" cy="60" r="40" class="arc2"/></svg>
      <div class="pNum"><b id="pAlt">0</b><small id="pAltU">km</small><i id="pSpd">0 m/s</i></div></div>
    <div id="pRings"></div>
    <canvas id="pGlobe" width="160" height="160" title="Your orbit"></canvas>
    <div id="pObj"><span id="pObjT">Ready on the pad</span><i><u id="pObjBar"></u></i></div>
    <button id="pTake" class="hidden">✋ TAKE OVER</button>
    <div class="pBtns"><button id="pEng" title="Engineer view: every number (Tab)" aria-label="Engineer view">📊</button><button id="pPhoto" title="Photo mode (')" aria-label="Photo mode">📸</button><button id="pMute" title="Sound on/off" aria-label="Sound on or off">🔊</button></div>`);
  document.body.appendChild(hud);
  // ---------- Navball (centre of the Pilot HUD) ----------
  const SAS_RING = [['stab', '⊙', 'Stability: hold this attitude', 'HOLD'], ['prograde', '◇', 'Prograde', 'PRO'], ['retrograde', '✕', 'Retrograde', 'RETRO'], ['normal', '△', 'Normal (orbit-plane up)', 'NRM'], ['radial', '⊞', 'Radial out', 'RAD'], ['node', '✛', 'Maneuver node', 'NODE'], ['target', '◎', 'Target', 'TGT'], ['off', '○', 'SAS off', 'OFF']];
  const navEl = el('div', { id: 'nav', className: 'hidden' }, `
    <button id="navMode" class="glass" title="Speed reference: surface / orbit / target">SURFACE <b id="navSpd">0 m/s</b></button>
    <div id="navCue" class="hidden"></div>
    <div id="navRd" aria-label="Attitude readout"><span>HDG <b id="nrH">000</b>°</span><span>PIT <b id="nrP">+00</b>°</span><span>ROLL <b id="nrR">+00</b>°</span><span id="nbInc" title="Orbit inclination (0° = equator, 90° = polar)">INC <b id="nrI">0.0</b>°</span></div>
    <div class="navWrap"><svg class="navArcs" viewBox="0 0 200 200" aria-hidden="true">
      <path class="trk" d="M 38 160 A 85 85 0 0 1 38 40"/><path id="navThr" class="thr" d="M 38 160 A 85 85 0 0 1 38 40"/>
      <path class="trk" d="M 162 40 A 85 85 0 0 1 162 160"/><path id="navFuel" class="fuel" d="M 162 160 A 85 85 0 0 0 162 40"/></svg>
      <canvas id="navBall" width="128" height="128" aria-label="Navball: drag to steer, twist with two fingers to roll"></canvas><i id="nbKnob" aria-hidden="true"></i>
      <span id="navThrT" class="navLab l">0%</span><span id="navFuelT" class="navLab r">S1</span>
      <button id="navSasT" title="SAS modes" aria-label="SAS modes" aria-expanded="false">⊙</button>
      <div id="navSas">${SAS_RING.map(([m, ic, t, sh], i) => `<button data-sas="${m}" title="${t}" aria-label="SAS ${t}" style="--i:${i}">${ic}<small>${sh}</small></button>`).join('')}</div></div>`);
  document.body.appendChild(navEl);
  const navball = createNavball($('navBall')); let navMode = 'auto';
  function cycleSpeed() { const ms = ['surface', 'orbit', 'target'], curM = navMode === 'auto' ? lastAuto : navMode; navMode = ms[(ms.indexOf(curM) + 1) % 3]; ctx.audio.ui('tick'); }
  $('navMode').onclick = e => { e.currentTarget.blur(); const ms = ['surface', 'orbit', 'target'], curM = navMode === 'auto' ? lastAuto : navMode; navMode = ms[(ms.indexOf(curM) + 1) % 3]; ctx.audio.ui('tick'); };
  navEl.querySelectorAll('#navSas button').forEach(b => b.onclick = e => { e.currentTarget.blur(); ctx.setSas(b.dataset.sas); ctx.audio.ui('tick'); setFan(false); });
  const SAS_IC = Object.fromEntries(SAS_RING.map(([m, ic]) => [m, ic])); Object.assign(SAS_IC, { antiradial: '▣', antinormal: '▽', off: '○' });
  function setFan(on) { navEl.classList.toggle('fan', on); $('navSasT').setAttribute('aria-expanded', on ? 'true' : 'false'); if (on) liftFan(); }
  // f5: the SAS grid opens above the ball; lift it clear of any on-screen control it would cover (touch stick / AUTO / ROLL)
  function liftFan() { const g = $('navSas'); if (matchMedia('(orientation:landscape) and (max-height:500px)').matches && document.body.classList.contains('touch')) { g.style.marginBottom = ''; return; } g.style.marginBottom = '0px'; let lift = 0;
    const ctl = [...document.querySelectorAll('#mleft *, #mright *, #mtop *, #pilot button, #navRd')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && getComputedStyle(e).visibility !== 'hidden' && !g.contains(e); });
    for (let k = 0; k < 3; k++) { const gr = g.getBoundingClientRect(); let need = 0;
      for (const e of ctl) { const r = e.getBoundingClientRect(); if (r.left < gr.right - 1 && gr.left < r.right - 1 && r.top < gr.bottom - 1 && gr.top < r.bottom - 1) need = Math.max(need, gr.bottom - r.top + 6); }
      if (!need) break; lift += need; g.style.marginBottom = lift + 'px'; } }
  $('navSasT').onclick = e => { e.currentTarget.blur(); setFan(!navEl.classList.contains('fan')); ctx.audio.ui('tick'); };
  document.addEventListener('pointerdown', e => { if (navEl.classList.contains('fan') && !e.target.closest('#nav')) setFan(false); }, true);
  let navOut = { mode: 'surface', sp: 0 };
  const THR_LEN = Math.PI * 85 * 0.5 * 1.18; $('navThr').style.strokeDasharray = $('navFuel').style.strokeDasharray = THR_LEN;
  let lastAuto = 'surface';
  function renderNav(st) { // { nose, top, r, vSurf, vOrb, vTgt, markers, throttle, fuel, stage, sas, cue, hasTarget, hasNode }
    navEl.classList.remove('hidden');
    if (navMode === 'target' && !st.hasTarget) navMode = 'auto';
    lastAuto = st.alt < 40000 ? 'surface' : 'orbit'; const mode = navMode === 'auto' ? lastAuto : navMode;
    navOut.mode = mode; const vv = mode === 'surface' ? st.vSurf : mode === 'orbit' ? st.vOrb : st.vTgt, sp = Math.hypot(...(vv || [0, 0, 0]));
    $('navMode').firstChild.textContent = mode.toUpperCase() + ' '; $('navSpd').textContent = UN.spd(sp); /* f5.7q: Units setting */
    navOut.sp = sp; { const t = SAS_IC[st.sas] || '⊙'; const bt = $('navSasT'); if (bt.textContent !== t) bt.textContent = t; }
    const pg = sp > 0.5 ? vv.map(x => x / sp) : null, m = { ...st.markers }; if (pg) { m.pro = pg; m.retro = pg.map(x => -x); }
    { const cv = $('navBall'), want = Math.min(256, Math.max(96, Math.round(cv.clientWidth * Math.min(2, devicePixelRatio || 1)))); if (cv.clientWidth && Math.abs(cv.width - want) > 4) { cv.width = cv.height = want; } } // f5: crisp ticks/labels at the shown size
    const att = navball.draw({ nose: st.nose, top: st.top, r: st.r, markers: m, ghost: st.ghost });
    if (att) { const sg = x => (x >= 0 || Math.round(-x) === 0 ? '+' : '−') + String(Math.round(Math.abs(x))).padStart(2, '0'), hT = String(Math.round(att.heading) % 360).padStart(3, '0');
      if ($('nrH').textContent !== hT) $('nrH').textContent = hT; $('nrP').textContent = sg(att.pitch); $('nrR').textContent = sg(att.roll); navOut.att = att; } { const it = isFinite(st.inc) ? st.inc.toFixed(1) : '—'; if ($('nrI').textContent !== it) $('nrI').textContent = it; } // f5.5d
    $('navThr').style.strokeDashoffset = THR_LEN * (1 - st.throttle); $('navThrT').textContent = Math.round(st.throttle * 100) + '%';
    $('navFuel').style.strokeDashoffset = THR_LEN * (1 - st.fuel); $('navFuelT').textContent = 'S' + st.stage; $('navFuel').classList.toggle('low', st.fuel < 0.15);
    navEl.querySelectorAll('#navSas button').forEach(b => { const k = b.dataset.sas; b.classList.toggle('on', st.sas === k || (k === 'radial' && st.sas === 'antiradial') || (k === 'normal' && st.sas === 'antinormal'));
      b.disabled = (k === 'node' && !st.hasNode) || (k === 'target' && !st.hasTarget); });
    const cue = $('navCue'); if (st.cue) { cue.textContent = st.cue; cue.className = st.cueWarn ? 'warn' : ''; } else cue.className = 'hidden';
  }
  function hideNav() { navEl.classList.add('hidden'); }
  const callout = el('div', { id: 'callout' }); document.body.appendChild(callout);
  $('pEng').onclick = e => { e.currentTarget.blur(); toggleEngineer(); };
  $('pPhoto').onclick = e => { e.currentTarget.blur(); photo.toggle(); };
  $('pMute').textContent = ctx.audio.muted ? '🔇' : '🔊'; $('pMute').onclick = e => { e.currentTarget.blur(); const m = ctx.audio.toggleMute(); $('pMute').textContent = m ? '🔇' : '🔊'; const hs = document.getElementById('hSound'); if (hs) hs.textContent = m ? '🔇 Sound off' : '🔊 Sound on'; };
  $('pTake').onclick = e => { e.currentTarget.blur(); ctx.takeOver(); };
  $('pGlobe').onclick = () => ctx.press('KeyM');
  function applyEngineer() { document.body.classList.toggle('eng', engineer); document.body.classList.toggle('pilotMode', !engineer); $('pEng').classList.toggle('on', engineer); }
  function toggleEngineer() { engineer = !engineer; try { localStorage.setItem(ENG_KEY, engineer ? '1' : '0'); } catch (e) { } applyEngineer(); ctx.toast(engineer ? 'Engineer view: all the numbers' : 'Pilot view', '#9cc3ff'); }
  applyEngineer();
  let lastCall = '', callT = 0;
  function call(icon, text, color = '#fff', big = false) {
    if (text === lastCall && performance.now() - callT < 4000) return; lastCall = text; callT = performance.now();
    callout.innerHTML = `<span>${icon}</span><b style="color:${color}">${esc(text)}</b>`; callout.className = big ? 'show big' : 'show';
    clearTimeout(call.t); call.t = setTimeout(() => { callout.className = ''; }, big ? 3200 : 2000); ctx.audio.ui(big ? 'fanfare' : 'tick');
  }
  const ARC = 2 * Math.PI * 52, ARC2 = 2 * Math.PI * 40;
  $('pAltArc').style.strokeDasharray = ARC; $('pSpdArc').style.strokeDasharray = ARC2;
  function renderPilot(s) { // s: { alt, spd, orbitalV, stages:[{f,active}], objective, prog, orbitPts2d, bodyR, director }
    const altK = s.alt / 1000, aF = Math.min(1, Math.log10(1 + Math.max(0, altK)) / Math.log10(1 + 400)), vF = Math.min(1, s.spd / 7800);
    $('pAltArc').style.strokeDashoffset = ARC * (1 - aF); $('pSpdArc').style.strokeDashoffset = ARC2 * (1 - vF);
    $('pAlt').textContent = UN.bigS(s.alt); if ($('pAltU').textContent !== UN.bigLab()) $('pAltU').textContent = UN.bigLab();
    $('pSpd').textContent = UN.spd(s.spd);
    $('pAltArc').classList.toggle('space', s.alt > 100000);
    const rings = $('pRings'); if (rings.children.length !== s.stages.length) rings.innerHTML = s.stages.map((_, i) => `<svg viewBox="0 0 44 44" class="ring"><circle cx="22" cy="22" r="17" class="trk"/><circle cx="22" cy="22" r="17" class="f" style="stroke-dasharray:${2 * Math.PI * 17}"/><text x="22" y="26">${i + 1}</text></svg>`).join('');
    s.stages.forEach((st, i) => { const c = rings.children[i]; c.classList.toggle('act', st.active); c.classList.toggle('gone', st.gone); c.querySelector('.f').style.strokeDashoffset = 2 * Math.PI * 17 * (1 - st.f); c.classList.toggle('low', st.active && st.f < 0.15); });
    $('pObjT').textContent = s.objective; $('pObjBar').style.width = Math.round((s.prog || 0) * 100) + '%';
    $('pTake').classList.toggle('hidden', !s.director);
    drawGlobe(s);
  }
  function drawGlobe(s) {
    const c = $('pGlobe'), g = c.getContext('2d'), W = c.width, H = c.height; g.clearRect(0, 0, W, H);
    const pts = s.orbit2d || [], Rb = s.bodyR; let ext = Rb * 1.25; for (const p of pts) ext = Math.max(ext, Math.abs(p[0]), Math.abs(p[1])); ext = Math.min(ext, Rb * 12);
    const k = (W / 2 - 8) / ext, cx = W / 2, cy = H / 2;
    const gr = g.createRadialGradient(cx - Rb * k * 0.3, cy - Rb * k * 0.3, Rb * k * 0.1, cx, cy, Rb * k); gr.addColorStop(0, s.bodyCol || '#5fa8ff'); gr.addColorStop(1, '#0a1a33');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, Rb * k, 0, 7); g.fill();
    g.strokeStyle = '#7dffa6'; g.lineWidth = 2; g.beginPath(); pts.forEach((p, i) => { const x = cx + p[0] * k, y = cy - p[1] * k; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    if (s.me) { g.fillStyle = '#ff9a3c'; g.beginPath(); g.arc(cx + s.me[0] * k, cy - s.me[1] * k, 4, 0, 7); g.fill(); }
  }
  // ---------- Missions & progress hub (hangar) ----------
  const hub = el('div', { id: 'hub', className: 'modal hidden' }, '<div class="mbox wide"><div id="hubBody"></div><div class="row"><button id="hubClose" class="big">Close</button></div></div>');
  document.body.appendChild(hub); $('hubClose').onclick = () => hub.classList.add('hidden');
  function openHub() {
    const s = ctx.progress(), dc = dailyChallenge(), best = s.daily[dc.day], nx = nextContract(s);
    const ms = Object.entries(MISSIONS).map(([id, m]) => `<button class="mis" data-m="${id}"><span>${m.icon}</span><b>${m.name}</b><small>${m.blurb}</small>${s.medals[id] ? `<em class="medal ${s.medals[id]}">${s.medals[id]}</em>` : ''}</button>`).join('');
    const cs = CONTRACTS.map(c => `<li class="${s.contracts[c.id] ? 'done' : c === nx ? 'next' : ''}">${s.contracts[c.id] ? '✔' : c === nx ? '▶' : '•'} <b>${c.name}</b> — ${c.goal}${c.reward ? ` <small>🎁 ${c.reward.split(':')[1]}</small>` : ''}</li>`).join('');
    const ach = ACHIEVEMENTS.map(a => `<span class="ach ${s.ach[a.id] ? 'got' : ''}" title="${a.desc}">${a.icon}<small>${a.name}</small></span>`).join('');
    // f5b: ONE career (the 🏆 ladder, $M + 🔬). The hub is a compact launcher: the career line, one-tap missions,
    // extra ops (gated by the ladder's vehicle unlocks, no separate currency), and details folded away.
    const K = ctx.career ? ctx.career() : null, OPS = ctx.ops ? ctx.ops() : [];
    const ms2 = Object.entries(MISSIONS).map(([id, m]) => `<button class="mis" data-m="${id}"><span>${m.icon}</span><b>${m.name}</b>${s.medals[id] ? `<em class="medal ${s.medals[id]}">${s.medals[id]}</em>` : ''}</button>`).join('');
    const ex = K ? K.extra.map(e => { const m = OPS.find(x => x.id === (ctx.missionOf ? ctx.missionOf(e.id) : e.id)) || OPS.find(x => x.id === e.id); if (!m) return ''; const why = K.opLock(e.id);
      return `<button class="mis op${why ? ' locked' : ''}" data-op="${e.id}" title="${esc(why || m.blurb || '')}"><b>${esc(ctx.opName ? ctx.opName(m) : m.name)}</b>${why ? '<small>🔒</small>' : ''}</button>`; }).join('') : '';
    $('hubBody').innerHTML = `<h2>🎯 Missions</h2>${K ? `<button id="hubCareer" class="hubCareer">🏆 $${K.cash}M · 🔬${K.sci} · ${K.done}/${K.of}${K.next ? ` <span>▶ ${esc(K.next)}</span>` : ''}</button>` : ''}
      <h3>Missions</h3><div class="mgrid">${ms2}</div>${ex ? `<details class="hubMore"><summary>Extra ops</summary><div class="cgrid">${ex}</div></details>` : ''}
      <details class="hubMore"><summary>Daily · achievements · stats</summary><p class="daily">📅 ${esc(dc.text)} <small>${best != null ? 'best ' + best.toLocaleString() : ''} · 🔥 ${s.streak.n}</small></p>
      <div class="achs">${ach}</div><p class="sm">Flights ${s.stats.flights} · best ${s.stats.best.toLocaleString()} · worlds ${s.visited.length}</p></details>`;
    const hc = $('hubCareer'); if (hc) hc.onclick = () => { hub.classList.add('hidden'); K.open(); };
    hub.querySelectorAll('.mis').forEach(b => b.onclick = () => { hub.classList.add('hidden'); if (b.dataset.op) { if (b.classList.contains('locked')) return; ctx.startOp(b.dataset.op); } else ctx.startMission(b.dataset.m); });
    hub.classList.remove('hidden');
  }
  // ---------- Planetary Atlas ----------
  const atlas = el('div', { id: 'atlas', className: 'modal hidden' }, '<div class="mbox wide"><h2>🪐 Planetary Atlas</h2><div id="atlasBody"></div><div class="row"><button id="atlasClose" class="big">Close</button></div></div>');
  document.body.appendChild(atlas); $('atlasClose').onclick = () => atlas.classList.add('hidden');
  function openAtlas() {
    const s = ctx.progress(), B = ctx.bodies();
    $('atlasBody').innerHTML = Object.entries(ATLAS).filter(([id]) => B[id]).map(([id, a]) => { const b = B[id], seen = s.visited.includes(id), g = b.mu / (b.R * b.R);
      return `<div class="atl ${seen ? 'seen' : 'unseen'}"><div class="orb" style="background:${ctx.bodyColor(id)}"></div><div><b>${b.name}</b> <small>${a.tag}${seen ? ' · ✔ visited' : ' · not visited yet'}</small>
        <p>${seen ? a.blurb : '???  Fly there to unlock the survey notes.'}</p><p class="sm">radius ${UN.big(b.R)} · gravity ${(g / 9.80665).toFixed(2)} g${b.atm ? ' · has air' : ' · no air'}${a.tip && seen ? ' · tip: ' + a.tip : ''}</p>
        ${seen ? poisOf(id).map(p => `<p class="poi">📍 <b>${p.name}</b> — ${p.lore}</p>`).join('') : ''}</div></div>`; }).join('');
    atlas.classList.remove('hidden');
  }
  let revealQ = [], revealBusy = false; // f3: one NEW WORLD card at a time (Sun + Moon used to stack on top of each other)
  function reveal(id) { if (revealBusy) { if (!revealQ.includes(id)) revealQ.push(id); return; } revealBusy = true; setTimeout(() => { revealBusy = false; const n = revealQ.shift(); if (n) reveal(n); }, 5300); revealNow(id); }
  function revealNow(id) { // first visit to a world
    const a = ATLAS[id] || {}, b = ctx.bodies()[id]; if (!b) return;
    const d = el('div', { className: 'reveal' }, `<small>NEW WORLD</small><b>${b.name}</b><i>${a.tag || ''}</i><p>${a.blurb || ''}</p>`); document.body.appendChild(d);
    ctx.audio.ui('fanfare'); setTimeout(() => d.classList.add('out'), 4200); setTimeout(() => d.remove(), 5200);
  }
  // ---------- photo mode ----------
  const FILTERS = { none: '', vivid: 'saturate(1.5) contrast(1.1)', warm: 'sepia(0.35) saturate(1.3)', noir: 'grayscale(1) contrast(1.25)', retro: 'sepia(0.6) hue-rotate(-15deg) contrast(1.1)', cold: 'hue-rotate(20deg) saturate(1.2) brightness(1.05)' };
  const pbar = el('div', { id: 'photobar', className: 'hidden' }, `<button id="phFx" aria-label="Filter" title="Filter (tap to change)">🎨</button><button id="phSnap" class="big" aria-label="Snap a photo" title="Snap">⦿</button><button id="phExit" aria-label="Exit photo mode" title="Exit photo mode">✕</button>`); // f5.8f (QA P2): 3 icon buttons, no text, never over the rocket
  document.body.appendChild(pbar);
  const photo = { on: false, filter: 'none',
    toggle() { this.on = !this.on; { const mm = document.getElementById('mMenu'); if (mm) mm.classList.add('hidden'); } // f5.1h (QA): photo mode closes the ☰ menu
      document.body.classList.toggle('photo', this.on); pbar.classList.toggle('hidden', !this.on); ctx.setPhoto(this.on); if (!this.on) this.set('none'); },
    set(f) { this.filter = f; ctx.canvas.style.filter = FILTERS[f]; pbar.querySelectorAll('[data-f]').forEach(b => b.classList.toggle('on', b.dataset.f === f)); } };
  $('phFx').onclick = () => { const ks = Object.keys(FILTERS), k = ks[(ks.indexOf(photo.filter) + 1) % ks.length]; photo.set(k); $('phFx').title = 'Filter: ' + k; };
  $('phExit').onclick = () => photo.toggle();
  $('phSnap').onclick = () => ctx.snap(FILTERS[photo.filter]);
  // ---------- "Will it fly?" ghost trajectory (hangar) ----------
  function drawGhost(canvas, track, verdict) {
    const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height; g.clearRect(0, 0, W, H);
    g.fillStyle = '#071226'; g.fillRect(0, 0, W, H);
    const sky = g.createLinearGradient(0, H, 0, 0); sky.addColorStop(0, '#2a5fae'); sky.addColorStop(0.35, '#0b1d3d'); sky.addColorStop(1, '#030712'); g.fillStyle = sky; g.fillRect(0, 0, W, H - 14);
    g.fillStyle = '#2f6d3a'; g.fillRect(0, H - 14, W, 14);
    if (!track || track.length < 2) { g.fillStyle = '#9cc3ff'; g.font = '12px monospace'; g.fillText('simulating…', 10, 20); return; }
    const maxX = Math.max(50, ...track.map(p => p[0])), maxY = Math.max(120, ...track.map(p => p[1])), X = x => 8 + x / maxX * (W - 30), Y = y => H - 14 - y / maxY * (H - 30);
    g.strokeStyle = '#ffffff22'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(0, Y(100)); g.lineTo(W, Y(100)); g.stroke(); g.setLineDash([]); g.fillStyle = '#ffffff66'; g.font = '10px monospace'; g.fillText(UN.big(100000) + ' · space', 6, Y(100) - 3);
    const n = Math.max(2, Math.floor(track.length * Math.min(1, (performance.now() - (drawGhost.t0 || 0)) / 1400)));
    g.strokeStyle = verdict === 'good' ? '#7dffa6' : verdict === 'warn' ? '#ffd23a' : '#ff6262'; g.lineWidth = 2.5; g.shadowColor = g.strokeStyle; g.shadowBlur = 8;
    g.beginPath(); track.slice(0, n).forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))); g.stroke(); g.shadowBlur = 0;
    for (const p of track.slice(0, n)) if (p[3] === 'stage') { g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(X(p[0]), Y(p[1]), 4, 0, 7); g.fill(); }
    const L = track[n - 1]; g.font = '16px sans-serif'; g.fillText(n < track.length ? '🚀' : L[3] === 'boom' ? '💥' : L[3] === 'orbit' ? '🛰️' : '🪂', X(L[0]) - 8, Y(L[1]) - 4);
    g.fillStyle = '#dfe9ff'; g.font = '11px monospace'; g.fillText(`${UN.big(L[1] * 1000)} up · ${UN.big(L[0] * 1000)} downrange`, 8, 14);
    if (n < track.length) requestAnimationFrame(() => drawGhost(canvas, track, verdict));
  }
  // ---------- wind tunnel ----------
  const wt = el('div', { id: 'tunnel', className: 'modal hidden' }, `<div class="mbox wide"><h2>🌬️ Wind tunnel</h2><canvas id="wtC" width="900" height="300"></canvas>
    <div class="row"><label>Angle of attack <input type="range" id="wtA" min="0" max="20" value="6"> <b id="wtAv">6°</b></label><label>Mach <input type="range" id="wtM" min="2" max="40" value="8"> <b id="wtMv">0.8</b></label></div><p id="wtV" class="sm"></p>
    <div class="row"><button id="wtClose" class="big">Close</button></div></div>`);
  document.body.appendChild(wt); $('wtClose').onclick = () => { wt.classList.add('hidden'); cancelAnimationFrame(wt.raf); };
  function openTunnel() { wt.classList.remove('hidden'); const t0 = performance.now(); const loop = () => { drawTunnel((performance.now() - t0) / 1000); wt.raf = requestAnimationFrame(loop); }; loop(); }
  const wtLines = Array.from({ length: 46 }, (_, i) => ({ y: (i + 0.5) / 46, ph: Math.random() }));
  function drawTunnel(t) {
    const c = $('wtC'), g = c.getContext('2d'), W = c.width, H = c.height, aoa = +$('wtA').value, M = +$('wtM').value / 10; $('wtAv').textContent = aoa + '°'; $('wtMv').textContent = M.toFixed(1);
    const geo = ctx.tunnelGeom(M); if (!geo) return; const { parts, L, ycom, ycp, stable, margin } = geo;
    g.fillStyle = '#06101f'; g.fillRect(0, 0, W, H);
    const sc = (W * 0.62) / L, cx = W * 0.5, cy = H * 0.5, a = -aoa * Math.PI / 180 * (stable ? 1 : 1) - (stable ? 0 : Math.sin(t * 1.3) * 0.25);
    const toS = (x, y) => [cx + (x - L / 2) * sc * Math.cos(a) - y * sc * Math.sin(a), cy + (x - L / 2) * sc * Math.sin(a) + y * sc * Math.cos(a)];
    // flow lines: deflected around the body silhouette, faster (brighter) with Mach, shock kinks above Mach 1
    for (const ln of wtLines) { const y0 = (ln.y - 0.5) * H; g.strokeStyle = `rgba(120,200,255,${0.18 + 0.25 * Math.min(1, M)})`; g.lineWidth = 1.2; g.beginPath();
      for (let x = 0; x <= W; x += 10) { const [bx, by] = [cx, cy]; const dx = (x - bx) / (L * sc * 0.6), d = Math.abs(cy + y0 - by - Math.tan(-a) * (x - bx)), push = Math.exp(-dx * dx) * 40 * Math.exp(-d / 40) * Math.sign(y0 || 1);
        const sh = M > 1 && x > cx - L * sc * 0.55 ? Math.exp(-((x - (cx - L * sc * 0.5)) ** 2) / 300) * 14 * Math.sign(y0) : 0; const yy = cy + y0 + push + sh;
        x ? g.lineTo(x, yy) : g.moveTo(x, yy); } g.stroke();
      const px = ((t * (120 + 260 * M) + ln.ph * W) % W); g.fillStyle = '#bfe6ff'; g.fillRect(px, cy + y0 - 1, 6, 2); }
    // body: nose to the left (into the wind)
    for (const p of parts) { const [x0, y0] = toS(L - p.y - p.h, -p.d / 2), [x1, y1] = toS(L - p.y, -p.d / 2), [x2, y2] = toS(L - p.y, p.d / 2), [x3, y3] = toS(L - p.y - p.h, p.d / 2);
      g.fillStyle = p.col; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.closePath(); g.fill(); }
    const dot = (yy, col, lab) => { const [x, y] = toS(L - yy, 0); g.fillStyle = col; g.beginPath(); g.arc(x, y, 8, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = '12px monospace'; g.fillText(lab, x - 14, y - 14); };
    dot(ycom, '#ffd23a', 'CoM'); dot(ycp, '#4ad6ff', 'CoP');
    g.font = 'bold 16px sans-serif'; g.fillStyle = stable ? '#7dffa6' : '#ff6262';
    g.fillText(stable ? `✔ STABLE — weathervanes back into the wind (margin ${margin.toFixed(2)} cal)` : '✘ FLIPS — the CoP is ahead of the CoM: add tail fins or move weight up', 16, H - 16);
    $('wtV').textContent = 'Flow lines bend around the body; the yellow dot is the centre of mass, the blue one the centre of pressure. The air pushes at the CoP: behind the CoM it straightens the rocket, ahead of it it flips it.';
  }
  // ---------- disassembly card ----------
  function boomCard(cause) {
    const CAUSE = { breakup: ['🌪️', 'Torn apart by the air'], tumble: ['🔄', 'Tumbled out of control'], overq: ['💨', 'Too fast, too low'], ground: ['🪨', 'Met the ground'], impact: ['🪨', 'Hard landing'], burnup: ['🔥', 'Burned up'], fellback: ['⬇️', 'Fell back'], twr: ['🐢', 'Too heavy to fly'] }[cause] || ['💥', 'Kaboom'];
    return `<div class="boom"><span>${CAUSE[0]}</span><div><b>UNPLANNED DISASSEMBLY</b><small>${CAUSE[1]}</small></div></div>`;
  }
  function endExtras(out, split) {
    if (split) { if (!out) return {}; const u = [...out.contracts.map(c => `📜 <b>${c.name}</b>`), ...out.ach.map(a => `${a.icon} <b>${a.name}</b>`)];
      if (out.daily) u.push(`📅 Daily ${out.daily.score.toLocaleString()}${out.daily.best ? ' · best!' : ''}`); if (out.streak > 1) u.push(`🔥 ${out.streak}-day streak`);
      const more = [...out.contracts.filter(c => c.reward).map(c => `📜 ${c.name} — unlocked ${c.reward.replace(':', ' ')}`), ...out.ach.map(a => `${a.icon} Achievement: ${a.name}`)].join('<br>');
      return { medal: out.medal ? ` <span class="medal ${out.medal}">${out.medal.toUpperCase()}</span>` : '', unlocks: u.join(' · '), more }; }
    if (!out) return ''; const L = [];
    if (out.medal) L.push(`<span class="medal ${out.medal}">${out.medal.toUpperCase()} MEDAL</span>`);
    for (const c of out.contracts) L.push(`<span class="good">📜 Contract complete: <b>${c.name}</b>${c.reward ? ` — unlocked ${c.reward.replace(':', ' ')}` : ''}</span>`);
    for (const a of out.ach) L.push(`<span class="good">${a.icon} Achievement: <b>${a.name}</b></span>`);
    if (out.daily) L.push(`<span class="good">📅 Daily challenge done: ${out.daily.score.toLocaleString()}${out.daily.best ? ' — new best!' : ''}</span>`);
    if (out.streak > 1) L.push(`<span>🔥 ${out.streak}-day streak</span>`);
    return L.join('<br>');
  }
  // ---------- paint shop (hangar) ----------
  function paintRow() {
    const s = ctx.progress(), d = ctx.design();
    const sw = Object.entries(PAINTS).map(([id, p]) => { const ok = isUnlocked(s, 'paint:' + id); return `<button class="sw ${d.paint === id || (!d.paint && id === 'classic') ? 'on' : ''} ${ok ? '' : 'lock'}" data-paint="${id}" title="${p.name}${ok ? '' : ' (locked: complete contracts)'}" style="background:#${p.body.toString(16).padStart(6, '0')};border-color:#${p.accent.toString(16).padStart(6, '0')}">${ok ? '' : '🔒'}</button>`; }).join('');
    const dc = Object.entries(DECALS).map(([id, g]) => `<option value="${id}" ${isUnlocked(s, 'decal:' + id) ? '' : 'disabled'} ${d.decal === id ? 'selected' : ''}>${g || '—'} ${id}${isUnlocked(s, 'decal:' + id) ? '' : ' 🔒'}</option>`).join('');
    return `<div class="paint"><label>🎨 Paint</label>${sw}<label>Decal <select id="decalSel">${dc}</select></label><label>Name <input id="nameIn" maxlength="18" value="${esc(d.name || '')}"></label></div>`;
  }
  function wirePaint(onChange) {
    document.querySelectorAll('[data-paint]').forEach(b => b.onclick = () => { if (b.classList.contains('lock')) { ctx.toast('Locked — complete contracts in 🎯 Missions to unlock', '#ffb35c'); return; } onChange({ paint: b.dataset.paint }); });
    const ds = $('decalSel'); if (ds) ds.onchange = () => onChange({ decal: ds.value });
    const ni = $('nameIn'); if (ni) ni.onchange = () => onChange({ name: ni.value.trim() || 'My rocket' });
  }
  return { renderPilot, renderNav, hideNav, cycleSpeed, get navOut() { return navOut; }, call, openHub, openAtlas, reveal, photo, drawGhost, openTunnel, boomCard, endExtras, paintRow, wirePaint, toggleEngineer, get engineer() { return engineer; },
    show(on) { hud.classList.toggle('hidden', !on); if (!on) callout.className = ''; } };
}

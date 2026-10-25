// Academy UI: menu, first-run prompt, lesson panel with live step guidance and HUD highlights, concept cards
// with small interactive plots, and the in-flight Learn overlay. Logic lives in academy.js (tested headlessly).
import * as P from './physics.js?v=f5.9-2';
import { ORBIT_DV, designStats } from './parts.js?v=f5.9-2';
import { isTouch } from './mobile.js?v=f5.9-2';
import { localize, keyLabel } from './wording.js?v=f5.9-2';
import { LESSONS, Tutor, GLOSSARY, loadProgress, saveProgress, isUnlocked, isDone, markPassed, markSkipped, nextLesson, fmt } from './academy.js?v=f5.9-2';

const KEYCAP = { Space: 'SPACE', Shift: 'Shift', Ctrl: 'Ctrl' };
const TOUCH = isTouch();
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export function createAcademy(api) {
  const $ = id => document.getElementById(id), store = (() => { try { return localStorage; } catch (e) { return { getItem: () => null, setItem: () => {} }; } })();
  let prog = loadProgress(store), cur = -1, tutor = null, shownPass = false, learnOn = false, lastText = '';
  const el = (tag, props = {}, html = '') => { const e = document.createElement(tag); Object.assign(e, props); if (html) e.innerHTML = html; return e; };
  // DOM
  const menu = el('div', { id: 'academy', className: 'panel hidden' }), panel = el('div', { id: 'lesson', className: 'hidden' }), card = el('div', { id: 'concept', className: 'panel hidden' });
  const first = el('div', { id: 'firstRun', className: 'panel hidden' }), learn = el('div', { id: 'learn', className: 'hidden' }), tip = el('div', { id: 'learnTip', className: 'hidden' });
  document.body.append(menu, panel, card, first, learn, tip);
  const save = () => saveProgress(store, prog);

  // ---------- menu ----------
  function renderMenu() {
    const nx = nextLesson(prog);
    menu.innerHTML = `<h2>🎓 Orbit Rush Academy</h2><p class="sub">Learn real rocket science by flying it — from your first hop to a recovered orbital mission. Lessons unlock in order; you can skip any.</p>
      <ol class="lessons">${LESSONS.map((l, i) => { const un = isUnlocked(prog, i), st = prog.passed[l.id] ? '✔' : prog.skipped[l.id] ? '↷' : un ? '' : '🔒';
        return `<li class="${un ? '' : 'locked'} ${prog.passed[l.id] ? 'passed' : ''} ${i === nx ? 'next' : ''}"><span class="st">${st}</span><div><b>${i + 1}. ${esc(l.title)}</b><small>${esc(l.goal)}</small></div>
        <span class="lb">${un ? `<button data-go="${i}">${prog.passed[l.id] ? 'Replay' : 'Start'}</button>` : ''}${!isDone(prog, l.id) ? `<button data-skip="${i}" class="ghost" title="Mark as skipped and unlock the next lesson">Skip</button>` : ''}</span></li>`; }).join('')}</ol>
      <div class="row"><button id="acClose">Sandbox (free flight)</button><button id="acReset" class="ghost">Reset progress</button><span class="small">${Object.keys(prog.passed).length}/${LESSONS.length} passed</span></div>`;
    menu.querySelectorAll('[data-go]').forEach(b => b.onclick = () => start(+b.dataset.go));
    menu.querySelectorAll('[data-skip]').forEach(b => b.onclick = () => { markSkipped(prog, LESSONS[+b.dataset.skip].id); save(); renderMenu(); });
    $('acClose').onclick = () => { menu.classList.add('hidden'); };
    $('acReset').onclick = () => { if (confirm('Reset Academy progress?')) { prog = { ...loadProgress({ getItem: () => null }), seen: true }; save(); renderMenu(); } };
  }
  function openMenu() { renderMenu(); menu.classList.remove('hidden'); card.classList.add('hidden'); first.classList.add('hidden'); }

  // ---------- lessons ----------
  function start(i) {
    const L = LESSONS[i]; cur = i; tutor = new Tutor(L); shownPass = false; lastText = '';
    menu.classList.add('hidden'); prog.seen = true; save();
    api.setDesign(L.start.design);
    if (L.start.mode === 'flight') api.launch(); else api.goBuild();
    panel.classList.remove('hidden'); showConcept(false); tick(0);
  }
  function stop() { cur = -1; tutor = null; panel.classList.add('hidden'); card.classList.add('hidden'); clearHl(); }
  const lesson = () => (cur >= 0 ? LESSONS[cur] : null);
  function ctx(dt) { const c = api.ctx(); c.dt = dt; return c; }
  function tick(dt) {
    if (!tutor) return;
    const c = ctx(dt), r = tutor.update(c), L = lesson();
    if (r.passed && !prog.passed[L.id]) { markPassed(prog, L.id); save(); }
    if (r.passed && !shownPass) { shownPass = true; api.toast(`✔ Lesson passed: ${L.title}`, '#7dffa6'); setTimeout(() => showConcept(true), 900); }
    renderPanel(c, r);
  }
  function renderPanel(c, r) {
    const L = lesson(), T = tutor; panel.classList.toggle('build', c.state === 'build');
    const step = T.step, txt = r.passed ? 'Lesson complete!' : esc(localize(T.text(c) || '', TOUCH));
    const keys = !r.passed && step.keys ? step.keys.map(k => `<kbd>${TOUCH ? keyLabel(k, true) : KEYCAP[k] || k}</kbd>`).join(' ') : '';
    const dots = L.steps.map((_, k) => `<i class="${k < T.i ? 'd' : k === T.i && !r.passed ? 'c' : ''}"></i>`).join('');
    const html = `<div class="lh"><b>${cur + 1}. ${esc(L.title)}</b><span class="dots">${dots}</span></div>
      <div class="goal">🎯 ${esc(L.goal)}</div>
      <div class="stp ${r.passed ? 'good' : ''}">${txt}</div>${keys ? `<div class="keys">${keys}</div>` : ''}
      ${r.fail ? `<div class="bad fail">✘ ${esc(r.fail)}</div>` : ''}
      <div class="lb"><button data-a="concept">Concept</button>${r.fail || c.state === 'flight' && c.F && c.F.flags.dead ? '<button data-a="retry" class="hot">↻ Retry</button>' : '<button data-a="retry">↻ Restart</button>'}${r.passed ? `<button data-a="next" class="hot">Next ▶</button>` : '<button data-a="skip" class="ghost">Skip</button>'}<button data-a="menu" class="ghost">Academy</button><button data-a="exit" class="ghost" title="Leave the lesson (free flight)">✕</button></div>`;
    if (html !== lastText) { panel.innerHTML = html; lastText = html; panel.querySelectorAll('[data-a]').forEach(b => b.onclick = e => { e.currentTarget.blur(); act(b.dataset.a); }); }
    applyHl(r.passed ? [] : step.hl || []);
  }
  function act(a) {
    const L = lesson(); if (!L) return;
    if (a === 'concept') showConcept(false);
    else if (a === 'retry') start(cur);
    else if (a === 'skip') { markSkipped(prog, L.id); save(); next(); }
    else if (a === 'next') next();
    else if (a === 'menu') { stop(); openMenu(); }
    else if (a === 'exit') stop();
  }
  function next() { const n = cur + 1; card.classList.add('hidden'); if (n < LESSONS.length) start(n); else { stop(); openMenu(); api.toast('🎓 Academy complete — you flew a full orbital mission!', '#7dffa6'); } }
  // ---------- concept card ----------
  function showConcept(passed) {
    const L = lesson(); if (!L) return; const c = ctx(0); c.mem = tutor.mem; c.fm = tutor.fm; c.tutor = tutor;
    if (c.design && !c.stats) c.stats = designStats(c.design);
    let body = ''; try { body = L.concept.body(c); } catch (e) { body = ''; }
    card.innerHTML = `<div class="ch">${passed ? '<span class="good">✔ PASSED</span> · ' : ''}Lesson ${cur + 1} · Concept</div><h2>${esc(L.concept.title)}</h2>${body}
      ${L.concept.plot ? '<canvas id="acPlot" width="560" height="190"></canvas><div id="acPlotV" class="small"></div>' : ''}
      <div class="row">${passed ? `<button id="cNext" class="big">${cur + 1 < LESSONS.length ? 'Next lesson ▶' : 'Finish 🎓'}</button><button id="cStay">Keep flying</button>` : '<button id="cOk" class="big">Got it — let\'s fly</button>'}</div>`;
    card.classList.remove('hidden');
    if (L.concept.plot) drawPlot($('acPlot'), L.concept.plot, c);
    const close = () => card.classList.add('hidden');
    if ($('cOk')) $('cOk').onclick = close; if ($('cStay')) $('cStay').onclick = close; if ($('cNext')) $('cNext').onclick = next;
  }
  // ---------- plots (data straight from the physics modules) ----------
  function drawPlot(cv, kind, c) {
    const g = cv.getContext('2d'), W = cv.width, H = cv.height, m = { l: 52, r: 12, t: 12, b: 30 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
    const F = c.F, tel = F && c.state === 'flight' ? F.tel : null;
    let spec;
    if (kind === 'density') spec = { x: [0, 120], xl: 'altitude (km)', yl: 'ρ (kg/m³, log)', log: true, y: [1e-8, 2], f: x => P.atmosphere(x * 1000).rho, mark: tel ? F.alt / 1000 : null, fmt: (x, y) => `${fmt(x)} km: ρ = ${y.toExponential(2)} kg/m³ (${fmt(y / P.atmosphere(0).rho * 100, y > 0.01 ? 0 : 4)}% of sea level)` };
    else if (kind === 'cdmach') spec = { x: [0, 6], xl: 'Mach', yl: 'drag coefficient Cd₀', y: [0, Math.max(...Array.from({ length: 61 }, (_, i) => P.cd0(i / 10))) * 1.15], f: x => P.cd0(x), mark: tel && tel.machShown != null ? tel.mach : null, fmt: (x, y) => `Mach ${fmt(x, 2)}: Cd₀ = ${fmt(y, 3)}` };
    else if (kind === 'heat') { const rho = tel && tel.rho > 1e-9 ? tel.rho : P.atmosphere(60000).rho, rn = tel ? tel.rnLead || 2.5 : 2.5;
      spec = { x: [0, 8], xl: `speed (km/s) at ρ = ${rho.toExponential(1)} kg/m³, rₙ ${fmt(rn, 1)} m`, yl: 'q̇ (kW/m²)', y: [0, P.suttonGraves(rho, 8000, rn) / 1000 * 1.05], f: x => P.suttonGraves(rho, x * 1000, rn) / 1000, mark: tel ? tel.vAir / 1000 : null, fmt: (x, y) => `${fmt(x, 2)} km/s: q̇ = ${fmt(y)} kW/m² (Sutton–Graves)` }; }
    else if (kind === 'dvbar') return drawDv(g, W, H, c);
    const X = x => m.l + (x - spec.x[0]) / (spec.x[1] - spec.x[0]) * pw;
    const Y = y => spec.log ? m.t + ph - (Math.log10(Math.max(y, spec.y[0])) - Math.log10(spec.y[0])) / (Math.log10(spec.y[1]) - Math.log10(spec.y[0])) * ph : m.t + ph - (y - spec.y[0]) / (spec.y[1] - spec.y[0]) * ph;
    const draw = hx => {
      g.clearRect(0, 0, W, H); g.fillStyle = '#0b1424'; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#ffffff22'; g.fillStyle = '#9ab'; g.font = '11px monospace'; g.lineWidth = 1;
      for (let k = 0; k <= 4; k++) { const x = spec.x[0] + (spec.x[1] - spec.x[0]) * k / 4; g.beginPath(); g.moveTo(X(x), m.t); g.lineTo(X(x), m.t + ph); g.stroke(); g.fillText(fmt(x, x % 1 ? 1 : 0), X(x) - 8, H - 14); }
      if (spec.log) for (let e = Math.ceil(Math.log10(spec.y[0])); e <= Math.log10(spec.y[1]); e += 2) { g.beginPath(); g.moveTo(m.l, Y(10 ** e)); g.lineTo(m.l + pw, Y(10 ** e)); g.stroke(); g.fillText('1e' + e, 4, Y(10 ** e) + 4); }
      else for (let k = 0; k <= 3; k++) { const y = spec.y[0] + (spec.y[1] - spec.y[0]) * k / 3; g.beginPath(); g.moveTo(m.l, Y(y)); g.lineTo(m.l + pw, Y(y)); g.stroke(); g.fillText(fmt(y, y < 10 ? 2 : 0), 4, Y(y) + 4); }
      g.fillText(spec.xl, m.l + pw / 2 - spec.xl.length * 3.3, H - 2); g.save(); g.translate(10, m.t + ph / 2 + 40); g.restore();
      g.fillStyle = '#9ab'; g.fillText(spec.yl, m.l + 6, m.t + 10);
      g.strokeStyle = '#7dd3ff'; g.lineWidth = 2; g.beginPath();
      for (let k = 0; k <= 200; k++) { const x = spec.x[0] + (spec.x[1] - spec.x[0]) * k / 200, y = spec.f(x); k ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)); } g.stroke();
      if (spec.mark !== null && spec.mark >= spec.x[0] && spec.mark <= spec.x[1]) { const y = spec.f(spec.mark); g.fillStyle = '#ff9a3c'; g.beginPath(); g.arc(X(spec.mark), Y(y), 5, 0, 7); g.fill(); g.fillText('you', X(spec.mark) + 7, Y(y) - 6); }
      if (hx !== undefined) { const y = spec.f(hx); g.strokeStyle = '#ffffff66'; g.beginPath(); g.moveTo(X(hx), m.t); g.lineTo(X(hx), m.t + ph); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(X(hx), Y(y), 3.5, 0, 7); g.fill(); $('acPlotV').textContent = spec.fmt(hx, y); }
      else $('acPlotV').textContent = spec.mark !== null ? spec.fmt(spec.mark, spec.f(spec.mark)) + ' — you are here' : 'Hover the plot to read values.';
    };
    draw();
    cv.onmousemove = e => { const r = cv.getBoundingClientRect(), x = spec.x[0] + ((e.clientX - r.left) * W / r.width - m.l) / pw * (spec.x[1] - spec.x[0]); draw(Math.max(spec.x[0], Math.min(spec.x[1], x))); };
    cv.onmouseleave = () => draw();
  }
  function drawDv(g, W, H, c) {
    const s = c.stats || designStats(c.design), tot = s.total, max = Math.max(tot, ORBIT_DV) * 1.1, x0 = 20, w = W - 40, y = 60, h = 44, cols = ['#ff9a3c', '#7dd3ff', '#b98cff', '#7dffa6'];
    g.clearRect(0, 0, W, H); g.fillStyle = '#0b1424'; g.fillRect(0, 0, W, H); g.font = '12px monospace';
    let x = x0; s.stages.forEach((st, i) => { const ww = st.dv / max * w; g.fillStyle = cols[i % 4]; g.fillRect(x, y, ww, h); g.fillStyle = '#000'; if (ww > 60) g.fillText(`S${i + 1} ${fmt(st.dv)}`, x + 4, y + 26); x += ww; });
    const xo = x0 + ORBIT_DV / max * w; g.strokeStyle = '#fff'; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(xo, y - 16); g.lineTo(xo, y + h + 16); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#fff'; g.fillText(`orbit ≈ ${fmt(ORBIT_DV)} m/s`, Math.min(xo - 40, W - 150), y - 22); g.fillText(`your rocket: ${fmt(tot)} m/s Δv`, x0, y + h + 34);
    const v = document.getElementById('acPlotV'); if (v) v.textContent = 'Δv budget: each colour is one stage (rocket equation, your numbers). The dashed line is what low orbit costs.';
  }
  // ---------- highlights ----------
  let hlEls = [];
  function clearHl() { for (const e of hlEls) e.classList.remove('hl'); hlEls = []; }
  function applyHl(list) {
    clearHl();
    for (const k of list) { const sel = k.startsWith('#') || k.startsWith('.') ? k : `[data-l="${k}"]`; document.querySelectorAll(sel).forEach(e => { e.classList.add('hl'); hlEls.push(e); }); }
  }
  // ---------- Learn overlay ----------
  function renderLearn() {
    if (!learnOn) return;
    const seen = new Set([...document.querySelectorAll('#hud [data-l]')].filter(e => e.offsetParent).map(e => e.dataset.l));
    learn.innerHTML = `<h4>LEARN <small>(/ to close · hover any label)</small></h4>` + Object.entries(GLOSSARY).filter(([k]) => seen.has(k)).map(([k, t]) => `<div><b>${k.toUpperCase()}</b> ${esc(t)}</div>`).join('');
  }
  function toggleLearn(on = !learnOn) { learnOn = on; learn.classList.toggle('hidden', !on); document.body.classList.toggle('learning', on); renderLearn(); }
  document.addEventListener('mousemove', e => { const t = e.target.closest && e.target.closest('#hud [data-l]'); if (!t) { tip.classList.add('hidden'); return; }
    const g = GLOSSARY[t.dataset.l]; if (!g) return; tip.textContent = g; tip.classList.remove('hidden'); const r = t.getBoundingClientRect();
    tip.style.left = Math.min(innerWidth - 330, r.right + 8) + 'px'; tip.style.top = Math.max(4, r.top - 4) + 'px'; });
  // ---------- first run ----------
  function hideFirst() { first.classList.add('hidden'); } // f4.1b: never over a flight
  function firstRun() {
    if (prog.seen || document.body.classList.contains('flying') || (window.__game && window.__game.state === 'flight')) return;
    first.innerHTML = `<h2>Welcome to Orbit Rush 🚀</h2><p>Fly now, or learn with the Academy.</p>
      <div class="row"><button id="frSb" class="big">🚀 Fly now</button><button id="frAc">🎓 Academy</button></div>`; // QA f5b.3: short welcome, 1 tap to liftoff
    first.classList.remove('hidden');
    $('frAc').onclick = () => { prog.seen = true; save(); first.classList.add('hidden'); start(0); };
    $('frSb').onclick = () => { prog.seen = true; save(); first.classList.add('hidden'); const f = document.getElementById('hFly'); if (f && f.offsetParent) f.click(); };
  }
  return {
    openMenu, start, stop, tick, toggleLearn, renderLearn, firstRun, hideFirst,
    get active() { return !!tutor; }, get lesson() { return lesson(); }, get tutor() { return tutor; }, get progress() { return prog; }, get learnOn() { return learnOn; },
    onLaunch(F) { const L = lesson(); if (L && L.start.setup) L.start.setup(F); },
    onEnd() { if (tutor) tick(0); },
  };
}

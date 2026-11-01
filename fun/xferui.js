// f6.5 Plan transfer (pre-launch): pick a world, see the launch day / time / site, the burns, the Δv bill and whether this rocket can do it.
// Self-contained: one overlay (#xferPlan), classes prefixed xp-, CSS in one block at the end of style.css. Opened from 🎯 in the Home top bar.
import * as P from '../physics.js?v=f5.9-13';
import * as T from '../physics/transfer_plan.js?v=f5.9-13';
import * as UN from './units.js?v=f5.9-13';
const D2R = Math.PI / 180, DAY = 86400, esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const MAIN = ['moon', 'mars', 'venus'], MORE = ['mercury', 'jupiter', 'saturn', 'uranus', 'neptune'];
const utc = d => d.toLocaleString('en-US', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) + ' UTC';
const day = d => d.toLocaleDateString('en-US', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
const span = s => s >= 2 * DAY ? `${Math.round(s / DAY)} days` : s >= 3600 ? `${(s / 3600).toFixed(1)} hours` : `${Math.round(s / 60)} min`;
// plain-words report for a plan (also used by the tests)
export function describe(pl, dvAvail, rocketName) {
  if (!pl || !pl.ok) return { html: `<p class="xp-bad">${esc(pl && pl.why || 'No plan')}</p>`, level: 'none' };
  const L = pl.launch, vd = T.verdict(pl, dvAvail), win = pl.windows.filter(w => w.t > pl.departT + 20 * DAY)[0], steps = [
    ['🚀', 'Launch', `${utc(L.date)} · ${T.fmtHour(L.localHour)} local time at ${esc(L.siteName)}`, `heading ${L.azimuth.toFixed(0)}° · orbit tilt ${L.incl.toFixed(0)}°`],
    ['🛰️', 'Parking orbit', `${UN.dist(pl.park.alt)} up`, `wait ${span(pl.departT - L.t - T.ASCENT_S)} for the right spot`],
    ...pl.burns.map(b => [b.key === 'tmi' ? '🔥' : b.key === 'mid' ? '🧭' : '🅿️', b.name, `${UN.dv(b.dv)} · ${day(P.dateFromT(b.t))}`, b.note])];
  const vc = { ok: 'xp-good', tight: 'xp-warn', no: 'xp-bad', none: '' }[vd.level];
  const html = `<div class="xp-head2"><b>${esc(pl.targetName)}</b> · launch ${utc(L.date)} · ${esc(L.siteName)} · trip ${span(pl.flightTime)}</div>
    ${vd.text ? `<div class="xp-verdict ${vc}">${vd.text}${vd.level === 'no' ? ` About ${UN.dv(-vd.spare)} short.` : vd.level === 'ok' ? ` About ${UN.dv(vd.spare)} spare.` : ''}</div>` : ''}
    <details class="xp-more2"><summary>Burns and fuel bill</summary><ol class="xp-steps">${steps.map(s => `<li><span>${s[0]}</span><div><b>${s[1]}</b> <i>${s[2]}</i><small>${s[3]}</small></div></li>`).join('')}</ol>
    <div class="xp-bill">Fuel bill: <b>${UN.dv(pl.required)}</b> of Δv (${UN.dv(pl.ascentDv)} to orbit + ${UN.dv(pl.transferDv)} for the transfer)${dvAvail > 0 ? ` · ${esc(rocketName || 'this rocket')} carries <b>${UN.dv(dvAvail)}</b>` : ''}</div>
    ${win ? `<div class="xp-next">Miss it? The next window is ${day(win.date)}.</div>` : ''}</details>`;
  return { html, level: vd.level };
}
export function createXferPlanner({ getEpoch, getDvAvail, getRocketName, getArmed, onArm, onClear }) {
  const el = document.createElement('div'); el.id = 'xferPlan'; el.className = 'hidden';
  el.innerHTML = `<div class="xp-box"><div class="xp-top"><b>Plan transfer</b><button class="xp-x" aria-label="Close">✕</button></div>
    <div class="xp-chips">${MAIN.map(id => `<button data-t="${id}">${P.BODIES[id].name}</button>`).join('')}<select class="xp-more" aria-label="More worlds"><option value="">More…</option>${MORE.map(id => `<option value="${id}">${P.BODIES[id].name}</option>`).join('')}</select></div>
    <div class="xp-body"><p class="xp-hint">Pick a world. I find the best launch day, time and site for it, and plan the burns.</p></div>
    <div class="xp-act"><button class="xp-auto" disabled>▶ Launch on AUTO</button><button class="xp-set" disabled>Set up the launch</button><button class="xp-clear" hidden>Clear plan</button></div></div>`;
  document.body.appendChild(el); const q = s => el.querySelector(s); let target = null, plan = null, busy = 0; const cache = new Map();
  const refresh = () => { const armed = getArmed(); q('.xp-clear').hidden = !armed; const ok = plan && plan.ok; q('.xp-auto').disabled = !ok; q('.xp-set').disabled = !ok;
    el.querySelectorAll('.xp-chips button').forEach(b => b.classList.toggle('on', b.dataset.t === target)); const sel = q('.xp-more'); sel.classList.toggle('on', !!target && MORE.includes(target)); if (!(target && MORE.includes(target))) sel.value = ''; };
  const run = id => { target = id; plan = null; const tok = ++busy; q('.xp-body').innerHTML = `<p class="xp-hint">Planning the trip to ${P.BODIES[id].name}… (sweeping launch days, sites and times)</p>`; refresh();
    setTimeout(() => { if (tok !== busy) return; const t0 = P.tFromDate(getEpoch()), key = id + ':' + Math.floor(t0 / 3600);
      let pl = cache.get(key); if (!pl) { try { pl = T.planTransfer({ target: id, t0 }); } catch (e) { pl = { ok: false, why: 'The planner hit a problem: ' + e.message }; } cache.set(key, pl); }
      if (tok !== busy) return; plan = pl; q('.xp-body').innerHTML = describe(pl, getDvAvail(), getRocketName()).html; refresh(); }, 40); };
  el.querySelector('.xp-chips').onclick = e => { const b = e.target.closest('button'); if (b) run(b.dataset.t); };
  q('.xp-more').onchange = e => { if (e.target.value) run(e.target.value); };
  q('.xp-x').onclick = () => show(false);
  q('.xp-auto').onclick = () => { if (plan && plan.ok) { onArm(plan, true); show(false); } };
  q('.xp-set').onclick = () => { if (plan && plan.ok) { onArm(plan, false); show(false); } };
  q('.xp-clear').onclick = () => { onClear(); plan = null; target = null; q('.xp-body').innerHTML = '<p class="xp-hint">Plan cleared: the next launch is a normal one.</p>'; refresh(); };
  el.addEventListener('pointerdown', e => { if (e.target === el) show(false); });
  function show(v) { el.classList.toggle('hidden', !v); if (v) { const a = getArmed(); if (a && !plan) { target = a.target; plan = a; q('.xp-body').innerHTML = describe(a, getDvAvail(), getRocketName()).html; } else if (!plan && !target) run('moon'); /* f5.9-14 (QA P1): open on the Moon, the nearest trip */ refresh(); } }
  return { el, show, get on() { return !el.classList.contains('hidden'); }, run, get plan() { return plan; } };
}

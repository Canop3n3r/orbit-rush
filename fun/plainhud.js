// f5.5c (Aaron): plain telemetry for non-nerds. One bottom-left card: a big speedometer in mph, altitude,
// Ap and Pe heights each with a T−/T+ clock, and Δv left per stage (replaces the fuel bars). The jargon chips
// (ALT km / SRF m/s / AP·T−AP / PE / FUEL / STAGE) move behind the 📊 Details toggle (engineer view).
import * as U from './units.js?v=f5.9-3';
export const MPH = 2.236936, MI = 1609.344, FT = 0.3048;
const c0 = (x, d = 0) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
export function fmtHeight(m) { if (!isFinite(m)) return '—'; if (!U.imp()) return U.dist(m); if (Math.abs(m) < MI) return c0(m / FT) + ' ft'; const mi = m / MI; return (Math.abs(mi) < 100 ? c0(mi, 1) : c0(mi)) + ' mi'; } // f5.7q: follows the Units setting
export function fmtClock(s) { if (!isFinite(s)) return ''; s = Math.max(0, s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`; }
// apsis line: o = orbit elements { ap, pe, T, vr }, tAp/tPe = seconds (sim) to the next apsis, k = sim→real factor
// T− counts down to the next pass; after passing a suborbital apoapsis (falling) it counts T+ since it.
export function apsisLine(which, o, tNext, k = 1, onPad = false) {
  const h = which === 'ap' ? o.ap : o.pe, lab = which === 'ap' ? 'Ap' : 'Pe';
  if (onPad) return { lab, h: '—', t: '' };
  if (which === 'ap' && !isFinite(h)) return { lab, h: 'escape', t: '' };
  if (which === 'pe' && h < 0) return { lab, h: 'below ground', t: '' };
  const T = o.T, closed = isFinite(T) && T > 0; let t = '';
  if (isFinite(tNext)) { const falling = (o.vr || 0) < 0;
    if (which === 'ap' && falling && closed && o.pe < 0) t = 'T+' + fmtClock((T - tNext) / k); // suborbital: Ap already behind us
    else t = 'T−' + fmtClock(tNext / k); }
  return { lab, h: fmtHeight(h), t };
}
// Δv per stage still attached (vacuum Isp), top of the list = the stage firing now
export function stageDvs(stages, cur, massNow) {
  let m = massNow; const out = [];
  for (let i = cur; i < stages.length; i++) { const s = stages[i]; let dv = 0;
    if (s.eng && s.eng.tv > 0 && s.fuel > 0 && m > s.fuel) dv = s.eng.ispVac * 9.80665 * Math.log(m / (m - s.fuel));
    out.push({ n: i + 1, dv, on: i === cur }); m -= (s.fuel || 0) + (s.dry || 0); }
  return out;
}
// fx-2 manual landing aid: below 3 km and falling, show vertical speed, time to impact and when to light the
// suicide burn at full thrust (no drag counted, so it errs early). h: m above the ground, vs: m/s (+ up), aMax: m/s² thrust, g.
export function landAid(h, vs, aMax, g) {
  if (!(h < 3000) || !(vs < -2) || h < 0.5) return null;
  const vd = -vs, tImp = (-vd + Math.sqrt(vd * vd + 2 * g * h)) / g, net = aMax - g;
  if (!(net > 0.05)) return { vs: Math.round(U.spdN(vs)), tImp, burnIn: null, state: 'low' };
  const dStop = vd * vd / (2 * net), burnIn = (h - dStop) / vd;
  return { vs: Math.round(U.spdN(vs)), tImp, burnIn, state: burnIn <= 0.3 ? 'now' : burnIn < 4 ? 'soon' : 'wait' };
}
export function createPlainHud() {
  const el = document.createElement('div'); el.id = 'plain'; el.className = 'hidden';
  el.innerHTML = `<div id="spd"><b class="spV">0</b><small>MPH</small></div><div id="plAlt">ALT 0 ft</div>
    <div id="apPe"><div><b>Ap</b> <span id="plAp">—</span> <i id="plApT"></i></div><div><b>Pe</b> <span id="plPe">—</span> <i id="plPeT"></i></div></div>
    <div id="plLand" class="hidden"><b id="plVs"></b><span id="plImp"></span><em id="plBurn"></em></div><div id="dvStages"></div>`;
  document.body.appendChild(el);
  const $ = id => document.getElementById(id), last = {}, set = (id, t) => { if (last[id] !== t) { last[id] = t; $(id).textContent = t; } };
  function update(d) { // { on, mps, alt, ap:{h,t}, pe:{h,t}, dv:[{n,dv,on}] }
    el.classList.toggle('hidden', !d.on); if (!d.on) return;
    el.querySelector('.spV').textContent = c0(U.spdN(d.mps)); { const sm = el.querySelector('#spd small'), l = U.spdLab().toUpperCase(); if (sm && sm.textContent !== l) sm.textContent = l; }
    set('plAlt', 'ALT ' + fmtHeight(d.alt)); set('plAp', d.ap.h); set('plApT', d.ap.t); set('plPe', d.pe.h); set('plPeT', d.pe.t);
    const la = d.land || null; $('plLand').classList.toggle('hidden', !la); document.body.classList.toggle('plLandOn', !!la); if (la) { set('plVs', 'V/S ' + la.vs + ' ' + U.spdLab()); set('plImp', 'Impact ' + la.tImp.toFixed(1) + ' s');
      set('plBurn', la.state === 'low' ? 'TWR too low' : la.state === 'now' ? '🔥 BURN NOW' : 'Burn in ' + la.burnIn.toFixed(1) + ' s'); $('plLand').className = 'on ' + la.state; }
    const key = d.dv.map(s => s.n + ':' + Math.round(s.dv) + (s.on ? '*' : '')).join(',');
    if (last.dv !== key) { last.dv = key; $('dvStages').innerHTML = '<b class="dvH">Δv left</b>' + d.dv.map(s => `<div class="dvS${s.on ? ' on' : ''}"><span>Stage ${s.n}</span><em>${U.dv(s.dv)}</em></div>`).join(''); }
  }
  return { el, update };
}

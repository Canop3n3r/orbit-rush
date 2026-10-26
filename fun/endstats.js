// End-of-flight stats as plain lines (no DOM): buildEndStats(stats) -> { cost, head, details, all }.
// head = the 3 short lines shown on the end card; details = the rest (shown under the card's details). Every line is { k, text }.
// Units follow the Imperial/metric switch (mph, mi, ft, psf / km/h, km, m, kPa). Jokes are short, clean, and picked by `seed`.
import { launchCost, LAUNCH_COSTS_NOTE } from '../data/launch_costs.js';

const MPH = 2.236936, MI = 1609.344, FT = 0.3048, PSF = 0.0208854;
const RECOVER_SAVE = 0.6; // a recovered stage or capsule is worth roughly this share of the launch price
const SOUND_MPH = 767, HIGHWAY_MPH = 70, EVEREST_M = 8849, CRUISE_M = 10668;
const n0 = x => Math.round(x).toLocaleString('en-US');
const pick = (arr, seed, salt = 0) => arr[((Math.imul(Math.floor(seed) | 0, 0x9e3779b1 | 0) + salt * 40503) >>> 0) % arr.length];

export const money = usd => (usd >= 1e9 ? '$' + (usd / 1e9).toFixed(usd >= 1e10 ? 0 : 1).replace(/\.0$/, '') + 'B'
  : usd >= 1e6 ? '$' + (usd / 1e6).toFixed(usd >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M' : usd >= 1e3 ? '$' + Math.round(usd / 1e3) + 'k' : '$' + Math.round(usd));
// units of money for the jokes: [price in USD, singular, plural]
export const MONEY_UNITS = [[5, 'cup of coffee', 'cups of coffee'], [20, 'large pizza', 'large pizzas'], [150e3, 'school bus', 'school buses'], [400e3, 'house', 'houses'], [100e6, 'small airliner', 'small airliners']];
export function moneyJoke(usd, seed) {
  const ok = MONEY_UNITS.filter(([p]) => usd / p >= 2 && usd / p <= 2e5);
  const [p, one, many] = ok.length ? pick(ok, seed, 7) : MONEY_UNITS[MONEY_UNITS.length - 1];
  const n = Math.max(1, Math.round(usd / p)); return `${n0(n)} ${n === 1 ? one : many}`;
}
const dist = (m, imp) => { const a = Math.abs(m); return imp ? (a < MI * 0.5 ? n0(m / FT) + ' ft' : (m / MI >= 100 ? n0(m / MI) : (m / MI).toFixed(1)) + ' mi') : (a < 1000 ? n0(m) + ' m' : (m / 1000 >= 100 ? n0(m / 1000) : (m / 1000).toFixed(1)) + ' km'); };
const speed = (mps, imp) => n0(imp ? mps * MPH : mps * 3.6) + (imp ? ' mph' : ' km/h');
const press = (pa, imp) => imp ? n0(pa * PSF) + ' psf' : (pa / 1000).toFixed(1) + ' kPa';
const clock = s => { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60); return m ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`; };

// s: { maxQ (Pa), maxQAlt (m), maxQMet (s), maxV (m/s, surface-relative), maxAlt (m), maxG, dead, recovered, cause, vehicle: { ids, massT, crewed, hop, deepSpace }, imperial, seed }
export function buildEndStats(s) {
  const imp = s.imperial !== false, seed = s.seed || 0, q = s.maxQ || 0, v = s.maxV || 0, alt = s.maxAlt || 0, g = s.maxG || 0;
  const c = launchCost(s.vehicle || {}), usd = c.usd, saved = usd * RECOVER_SAVE, buck = moneyJoke(s.recovered ? saved : usd, seed);
  const L = [];
  // cost / saved
  let cost;
  if (s.recovered) cost = pick([`Recovered: saved about ${money(saved)} (${buck} not on fire).`, `Recovered: saved about ${money(saved)}. That's ${buck} the bank gets to keep.`, `Recovered: saved about ${money(saved)}, roughly ${buck}.`], seed, 1);
  else if (s.dead) cost = pick([`That failure would have cost about ${money(usd)}: roughly ${buck}.`, `Ballpark bill for this bang: ${money(usd)}, or about ${buck}.`, `The bank would have felt this one: about ${money(usd)} (${buck}).`], seed, 1);
  else cost = `Launch price tag: about ${money(usd)} (${buck}).`;
  // max Q
  let mq;
  if (q < 100) mq = 'Max Q: barely any. The rocket never really got going.';
  else { const f = { q: press(q, imp), alt: dist(s.maxQAlt || 0, imp), t: clock(s.maxQMet || 0) };
    mq = pick([`Max Q: ${f.q} at ${f.alt} up. The rocket had feelings about it.`, `Max Q: ${f.q} at ${f.alt} up, ${f.t} in. The bolts said please no.`, `Max Q: ${f.q} at ${f.alt} up. Peak air-punch, ${f.t} after liftoff.`, `Max Q: ${f.q} at ${f.alt} up. The air pushed back, hard.`], seed, 2); }
  // top speed
  const mph = v * MPH; let fast;
  if (v < 3) fast = 'Fastest: basically standing still.';
  else if (mph >= SOUND_MPH) fast = pick([`Fastest: ${speed(v, imp)}. That's ${(mph / SOUND_MPH).toFixed(1)}× the speed of sound.`, `Top speed: ${speed(v, imp)}, about ${n0(mph / HIGHWAY_MPH)}× highway cruising.`, `Fastest: ${speed(v, imp)}. Speed limit: ignored.`], seed, 3);
  else fast = pick([`Fastest: ${speed(v, imp)}.`, `Top speed: ${speed(v, imp)}. Speed limit: ignored.`, `Fastest: ${speed(v, imp)}, ${mph >= HIGHWAY_MPH ? 'faster than the highway allows' : 'a brisk ride'}.`], seed, 3);
  // details
  const hi = alt < 100 ? 'Highest: never left the pad.' : `Highest: ${dist(alt, imp)} up${alt > CRUISE_M * 2 ? `, ${(alt / CRUISE_M).toFixed(alt / CRUISE_M < 10 ? 1 : 0)}× an airliner's cruising height` : alt > EVEREST_M ? `, ${(alt / EVEREST_M).toFixed(1)}× Everest` : ''}.`;
  const gl = g < 0.05 ? 'Peak force: none worth mentioning.' : `Peak force: ${g.toFixed(1)} g, ${g < 2 ? 'a gentle push' : g < 4 ? 'roller-coaster territory' : g < 8 ? 'fighter-pilot territory' : 'pancake territory'}.`;
  L.push({ k: 'cost', text: cost }, { k: 'maxq', text: mq }, { k: 'fast', text: fast }, { k: 'alt', text: hi }, { k: 'g', text: gl });
  L.push({ k: 'note', text: `${LAUNCH_COSTS_NOTE}${c.basis === 'class' ? ' This rocket uses its size class.' : ''}` });
  // ONE compact line for the end card (budget: a few words, one row): peak q, top speed and the cost / saving; the long jokes ride in the tooltip
  const qs = q < 100 ? 'no max Q' : `max Q ${press(q, imp)}`, vs = v < 3 ? 'barely moved' : `top ${speed(v, imp)}`, ms = s.recovered ? `saved ~${money(saved)}` : s.dead ? `failure ~${money(usd)}` : `price ~${money(usd)}`;
  return { cost: { usd, saved, basis: c.basis, key: c.key, cls: c.cls }, line: `${qs} · ${vs} · ${ms}`, tip: L.filter(x => x.k !== 'note').map(x => x.text).join('\n') + '\n' + LAUNCH_COSTS_NOTE, head: L.slice(0, 3), details: L.slice(3), all: L };
}

// live tracker, called once per physics step by the flight: keeps peak dynamic pressure (with where and when), top speed, peak altitude
export function newStats() { return { q: 0, qAlt: 0, qMet: 0, v: 0, alt: 0 }; }
export function trackStats(st, tel, alt, speedMps, met) {
  if (tel && tel.q > st.q) { st.q = tel.q; st.qAlt = alt; st.qMet = met; }
  if (speedMps > st.v) st.v = speedMps; if (alt > st.alt) st.alt = alt;
}

// f5.7q (QA f5.7n, Aaron): one place for display units. Imperial (default) = mph, mi, ft, ft/s; metric = km/h, km, m, m/s.
// main.js binds the getter to the live settings so every HUD / pane / card follows the Units setting.
let get = () => 'imperial';
export const bindUnits = f => { get = f; };
export const imp = () => get() !== 'metric';
const FT = 0.3048, MI = 1609.344, c0 = x => Math.round(x).toLocaleString('en-US');
export const spdLab = () => imp() ? 'mph' : 'km/h';
export const spdN = mps => imp() ? mps * 2.236936 : mps * 3.6;
export const spd = mps => c0(spdN(mps)) + ' ' + spdLab();
export const dvLab = () => imp() ? 'ft/s' : 'm/s';
export const dvN = mps => imp() ? mps / FT : mps;
export const dv = mps => c0(dvN(mps)) + ' ' + dvLab();
export const vs = mps => (mps >= 0 ? '+' : '−') + c0(Math.abs(dvN(mps))) + ' ' + dvLab();
export const bigLab = () => imp() ? 'mi' : 'km';
export const bigN = m => imp() ? m / MI : m / 1000;
/* distance number in mi/km, 1 decimal under 100 */
export const bigS = m => { const k = bigN(m); return Math.abs(k) < 100 ? k.toFixed(1) : Math.abs(k) < 1e5 ? c0(k) : (k / 1e6).toFixed(2) + 'M'; };
export const big = m => bigS(m) + ' ' + bigLab();
export const smallLab = () => imp() ? 'ft' : 'm';
export const smallN = m => imp() ? m / FT : m;
/* altitude-style distance: ft/m low, mi/km high */
export const dist = m => { const a = Math.abs(m); if (imp()) return a < MI * 0.5 ? c0(m / FT) + ' ft' : bigS(m) + ' mi'; return a < 1000 ? c0(m) + ' m' : bigS(m) + ' km'; };
/* authored text ("Reach 10 km", "Climb above 10 km") in the current units */
export const txt = s => imp() && typeof s === 'string' ? s.replace(/(\d+(?:\.\d+)?) km\b/g, (_, n) => big(+n * 1000)).replace(/(\d+(?:\.\d+)?) m\/s\b/g, (_, n) => dv(+n)) : s;

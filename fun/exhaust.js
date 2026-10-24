// f5.3 exhaust (engines-1 data): one plume per engine at each nozzle, coloured by propellant.
import { VEHICLES, ROSTER_BLUEH } from '../vehicles/catalog.js?v=f5.8p';
import { rosterFor } from './specstack.js?v=f5.8p';
const ALL = [...VEHICLES, ...ROSTER_BLUEH], ALIAS = { 'titan-ss-v3': 'colossus-v3', 'titan-ss-v4': 'colossus-v4' };
export const PROPS = ['kerolox', 'methalox', 'hydrolox', 'hypergolic', 'solid'];
// look per propellant: plume/glow/core/bell colours, sprite HDR colour, opacity k, smoke amount, soot (dark smoke), diamond strength
export const LOOK = {
  kerolox:    { plume: 0xff9a3c, glow: 0xff5a10, core: 0xffd890, bell: 0xffb27a, sprite: [6, 3.2, 1.2], k: 1.15, smoke: 1.0, soot: 1, dia: 0.8 },
  methalox:   { plume: 0x7a5cff, glow: 0x4a2cff, core: 0xb8b0ff, bell: 0x8f7aff, sprite: [2.4, 1.8, 6], k: 1.15, smoke: 0.45, soot: 0, dia: 1.0 },
  hydrolox:   { plume: 0xd8e8ff, glow: 0xa8c4ff, core: 0xf2f8ff, bell: 0xc4d8ff, sprite: [2.2, 2.6, 4.2], k: 0.32, smoke: 0.2, soot: 0, dia: 1.8 },
  hypergolic: { plume: 0xffc896, glow: 0xffa868, core: 0xfff0dc, bell: 0xffcfa0, sprite: [4, 3, 2.2], k: 0.7, smoke: 0.35, soot: 0, dia: 0.5 },
  solid:      { plume: 0xfff2c8, glow: 0xffb44a, core: 0xffffff, bell: 0xffe0a0, sprite: [7, 5.6, 3.6], k: 1.3, smoke: 2.4, soot: 0, dia: 0.3 },
};
export function vehicleOf(model) { if (!model) return null; const id = ALIAS[model] || model; let v = null; try { v = rosterFor(id); } catch (e) {}
  return (v && v.stages) ? v : ALL.find(x => x.id === id) || (/^colossus-/.test(id) ? ALL.find(x => x.id === 'colossus-v3') : null) || (/^heron-9/.test(id) ? ALL.find(x => x.id === 'heron-9') : null); }
// propellant guess for a hand-built stage: hydrogen tanks/engines → hydrolox, else kerosene
export const guessProp = parts => (parts.some(p => /h2|lark|osprey/.test(p.id || '')) ? 'hydrolox' : parts.some(p => p.id === 'spark') ? 'hypergolic' : 'kerolox');
// stage info for design stage index si (catalog stages in order; extra design stages reuse the last)
export function stageEngines(model, si, parts = [], radial = false, k = 1) {
  const v = vehicleOf(model), st = v && v.stages || [];
  const core = st.filter(x => x.propellant !== 'solid' && !x.parallel), list = core.length ? core : st; // strap-on solids and parallel side boosters ride as radial stages (fx-1: Heavy core 9, upper 1)
  let s = list.length ? list[Math.min(si, list.length - 1)] : null;
  if (radial) { s = st.find(x => x.parallel) || st.find(x => x.propellant === 'solid') || (st.length > list.length ? st[0] : null) || s;
    if (s && s.engineCount > 0 && k > 1) s = { ...s, engineCount: Math.max(1, Math.round(s.engineCount / k)) }; } // per side booster
  const nParts = parts.filter(p => p.kind === 'engine').reduce((t, p) => t + (p.n || 1), 0) || 1;
  if (!s || !(s.engineCount > 0)) return { n: nParts, prop: guessProp(parts), layout: { type: nParts > 1 ? 'ring' : 'single' } };
  return { n: Math.min(40, s.engineCount), prop: LOOK[s.propellant] ? s.propellant : 'kerolox', layout: s.nozzleLayout || { type: 'ring' }, estimated: !!s.estimated };
}
// ring sizes for n engines (outer ring first … centre): heron 9 = 8+1, colossus 33 = 20+10+3, 7 = 6+1
export function rings(n) { if (n <= 1) return [1]; if (n <= 4) return [n]; if (n <= 9) return [n - 1, 1]; if (n === 33) return [20, 10, 3];
  const outer = Math.round(n * 0.6), inner = n - outer; return inner > 6 ? [outer, inner - Math.ceil(inner * 0.3), Math.ceil(inner * 0.3)] : [outer, inner]; }
// nozzle centres (x, z) in metres for a stage of radius R
export function nozzles(info, R) {
  const n = info.n, L = info.layout || {}, out = [];
  if (Array.isArray(L.positions) && L.positions.length === n) return L.positions.map(p => [p[0] * R * 0.55, (p[1] ?? p[2] ?? 0) * R * 0.55]);
  if (n === 1) return [[0, 0]];
  const rs = rings(n), radii = rs.length === 1 ? [0.6] : rs.length === 2 ? [0.78, rs[1] === 1 ? 0 : 0.36] : [0.82, 0.52, 0.2];
  rs.forEach((k, i) => { const r = radii[i] * R; for (let j = 0; j < k; j++) { const a = (j / k) * Math.PI * 2 + (i % 2 ? Math.PI / k : 0); out.push(k === 1 && r === 0 ? [0, 0] : [Math.cos(a) * r, Math.sin(a) * r]); } });
  return out;
}
export const nozzleR = (n, R) => (n <= 1 ? R * 0.55 : Math.max(0.35, R * 0.95 / Math.sqrt(n) * (n >= 20 ? 0.8 : 0.9)));

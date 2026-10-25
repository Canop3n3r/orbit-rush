// f5.3 exhaust (engines-1 data): one plume per engine at each nozzle, coloured by propellant.
import * as CAT from '../vehicles/catalog.js?v=f5.9-3';
const { VEHICLES, ROSTER_BLUEH } = CAT;
import { rosterFor } from './specstack.js?v=f5.9-3';
const ALL = [...VEHICLES, ...ROSTER_BLUEH], ALIAS = { 'titan-ss-v3': 'colossus-v3', 'titan-ss-v4': 'colossus-v4' };
import { PLUME_TABLE, PROPS, stagePlume } from './plumetable.js?v=f5.9-3';
export { PROPS };
// look per propellant now lives in fun/plumetable.js (data-driven: colours, smoke, Mach diamonds, vacuum/sea-level rule, thrust scale)
export const LOOK = PLUME_TABLE;
const ENG = {}; for (const k in CAT) if (k.startsWith('ENGINES')) Object.assign(ENG, CAT[k]);
// the engines of core stage i of a model that has nCore core stage groups: roster stages in flight order when they line up 1:1 (solid stages included), else stageEngines
export function coreInfo(model, i, nCore, parts = []) { const v = vehicleOf(model), rs = v && v.stages ? v.stages.filter(x => !x.parallel).sort((a, b) => (a.group || 0) - (b.group || 0)) : [];
  if (rs.length && rs.length === nCore) return stageInfo(rs[i]); return stageEngines(model, i, parts); }
export const stageInfo = st => stagePlume(st, ENG); // plume summary of one roster stage
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
  const sp = stagePlume(s, ENG); return { n: Math.min(40, s.engineCount), prop: sp.prop, layout: s.nozzleLayout || { type: 'ring' }, estimated: !!s.estimated, vacuumOnly: sp.vacuumOnly, expansion: sp.expansion, tKN: sp.tKN };
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

// f5.2 (Aaron: accurate specs): a house rocket flies a physics stack built from Vehicle Specs' roster data (rocketdb):
// stage count, dry/propellant mass, engine thrust and Isp, booster stage, payload and fairing mass. The part list only
// gives the stack its shape; the physics numbers are overridden from the roster (flight.js applies design.spec).
// Rockets with any unsourced engine are UNMODELLED and keep the matched showroom stack.
import * as CAT from '../vehicles/catalog.js?v=f5.6n';
const ROSTER = [], ENG = {};
for (const k in CAT) { if (k.startsWith('ROSTER_')) ROSTER.push(...CAT[k]); if (k.startsWith('ENGINES')) Object.assign(ENG, CAT[k]); }
// art id -> roster [id, variant prefix]
const ALIAS = { 'arion-62': ['arion-6', 'b2'], 'arion-64': ['arion-6', 'b4'], 'atlantean-v-551': ['atlantean-v', 'v5'], 'atlantean-v-401': ['atlantean-v', 'v0'],
  'atlantean-v-501': ['atlantean-v', 'v0'], 'deltoid-4-heavy': ['deltoid-4', 'heavy'], 'steppe-arrow-2': ['steppe-arrow'], 'gorynych-m': ['gorynych'], 'jade-lantern-5b': ['jade-lantern-5', 'two'] };
export function rosterFor(artId) {
  const [id, vp] = ALIAS[artId] || [artId]; const c = ROSTER.filter(v => v.id === id); if (!c.length) return null;
  return (vp ? c.find(v => String(v.variant || '').startsWith(vp)) : c[0]) || null;
}
export const modelled = v => !!v && v.stages.every(s => Object.keys(s.engines).every(e => ENG[e] && !ENG[e].unsourced && ENG[e].tVac > 0));
const engOf = engines => { let n = 0, tv = 0, tsl = 0, fv = 0, fsl = 0;
  for (const [id, k] of Object.entries(engines)) { const e = ENG[id]; n += k; tv += k * e.tVac; tsl += k * (e.tSl || 0); fv += k * e.tVac / e.ispVac; fsl += e.ispSl > 0 ? k * (e.tSl || 0) / e.ispSl : 0; }
  const ispVac = tv / fv, ispSl = tsl > 0 ? tsl / fsl : ispVac * 0.6; return { n, tv: tv / n, ispSl, ispVac }; };
// physics stages in flight order (bottom first): [boosters?], core, upper stages...
export function specStages(v) {
  const g0 = v.stages.filter(s => (s.group || 0) === 0), rest = v.stages.filter(s => (s.group || 0) > 0).sort((a, b) => a.group - b.group);
  const core = g0.length > 1 ? g0.reduce((a, b) => (b.burn > a.burn ? b : a)) : g0[0], boost = g0.filter(s => s !== core);
  const out = [];
  // this game lights one stage at a time, so the parallel phase (boosters + core together) is its own stage: booster
  // propellant + the core propellant burnt beside them; the core stage keeps the rest
  const ce = engOf(core.engines);
  if (boost.length) { const e = boost.map(s => engOf(s.engines)), bt = Math.max(...boost.map(s => s.jettisonAt || s.burn)), coreUsed = Math.min(core.prop * 0.9, core.prop * bt / core.burn);
    const T = e.reduce((t, x) => t + x.tv * x.n, 0) + ce.tv * ce.n, n = e.reduce((t, x) => t + x.n, 0) + ce.n;
    const fv = e.reduce((t, x) => t + x.tv * x.n / x.ispVac, 0) + ce.tv * ce.n / ce.ispVac, fs = e.reduce((t, x) => t + x.tv * x.n / x.ispSl, 0) + ce.tv * ce.n / ce.ispSl;
    out.push({ radial: true, dry: boost.reduce((t, s) => t + s.dry, 0) / 1000, fuel: (boost.reduce((t, s) => t + s.prop, 0) + coreUsed) / 1000, n, tv: T / n, ispSl: T / fs, ispVac: T / fv });
    out.push({ dry: core.dry / 1000, fuel: (core.prop - coreUsed) / 1000, n: ce.n, tv: ce.tv, ispSl: ce.ispSl, ispVac: ce.ispVac }); }
  else out.push({ dry: core.dry / 1000, fuel: core.prop / 1000, n: ce.n, tv: ce.tv, ispSl: ce.ispSl, ispVac: ce.ispVac });
  for (const s of rest) { const e = engOf(s.engines); out.push({ dry: s.dry / 1000, fuel: s.prop / 1000, n: e.n, tv: e.tv, ispSl: e.ispSl, ispVac: e.ispVac }); }
  const mode = (v.modes || [])[0]; out[out.length - 1].payload = (mode && mode.payload || 0) / 1000 * (LOAD[v.id + ':' + String(v.variant || '').split(' ')[0]] || LOAD[v.id] || 0.75);
  return out;
}
const P = (id, n) => (n ? { id, n } : { id }), SYM = [2, 3, 4, 6];
// a part design with the same stage shape (physics numbers come from design.spec)
export function specDesign(v, name, model) {
  const S = specStages(v), radial = S[0].radial ? S[0] : null, core = S.filter(s => !s.radial); const parts = [];
  parts.push(P('fairing'), P('probe')); // a shroud always (roster fairing mass when sourced, else the part's 1 t: ESTIMATE)
  for (let i = core.length - 1; i >= 0; i--) { if (i < core.length - 1) parts.push(P('dec')); parts.push(P(i ? 'tank-m' : 'tank-xl')); parts.push(P(i ? 'lark' : 'thumper', Math.min(5, Math.max(1, core[i].n)))); }
  parts.push(P('fins'));
  if (radial) { const k = SYM.reduce((a, b) => (Math.abs(b - radial.n) < Math.abs(a - radial.n) ? b : a), 2); parts.push(P('rdec', k), P('tank-r'), P('thumper', 1)); }
  return { name, model, parts, spec: { stages: S, fairing: (v.fairing || 0) / 1000, src: v.src } };
}
// house rockets verified by the f5.2 audit (tests/specstack.mjs): the roster stack reaches orbit on AUTO and its stages match the model.
// The others keep the matched showroom stack: AUTO can't fly their roster numbers to orbit yet, or the model's stage groups differ.
// f5.3: payload carried, as a fraction of the roster's max LEO payload. Pitch/turn and direct-insertion tunes were tried and gave
// 0 extra orbits (these stacks run out of Δv against the game's losses). Lead decision: every real-spec rocket flies a realistic mission
// payload, 75% of max by default and 50% where listed; masses, thrust and Isp stay real.
export const LOAD = { 'thorin': 0.5, 'thorin-toaster': 0.5, 'cosmokart-1': 0.5, 'cosmokart-1b': 0.5, 'electrino': 0.5, 'titanus-4': 0.5, 'arion-6:b4': 0.5, 'atlantean-v:v5': 0.5 };
// f5.3: every roster-matched model whose stack reaches orbit on AUTO and matches the model's stages (tests/specstack.mjs).
// dark-dart and scoutling (and the three shape mismatches: jade-lantern-5, moonhammer, gorynych-m) keep the matched showroom stack.
export const SPEC_OK = ['space-truck', 'saturnine-v', 'thorin', 'thorin-toaster', 'thorin-agenta', 'thorin-capable', 'thorin-capablestar', 'deltoid', 'deltoid-3', 'cosmokart-1', 'cosmokart-1b', 'cosmokart-2', 'cosmokart-3m', 'whirligig-2', 'whirligig-3', 'riverbend', 'arion-5', 'arion-62', 'arion-64', 'new-glendale', 'electrino', 'titanus-4', 'jade-lantern-5b', 'polar-slinger', 'tsubame', 'rodnik', 'titanus-2', 'pegacorn', 'antarion', 'steppe-arrow-2', 'atlantean-v-401', 'atlantean-v-501', 'atlantean-v-551', 'deltoid-4-heavy'];
export const specFor = id => (SPEC_OK.includes(id) ? rosterFor(id) : null);

// the payload a real-spec rocket carries, in tonnes (shown on its cards)
export const payloadT = id => { const v = specFor(id); if (!v) return null; const S = specStages(v); return S[S.length - 1].payload; };

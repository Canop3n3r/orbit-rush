// Plume style + size (QA plume pass): propellant -> look, engine -> plume size, every roster id resolves, monotonic in thrust / engine count.
import { STYLE, STYLE_PROPS, styleFor, propOf, plumeDims, vacFactors, estExitDiameter, estEngineThrust } from '../gfx/plume_style.js';
import { PROPS } from '../fun/plumetable.js';
import { VEHICLES } from '../vehicles/catalog.js';
import { vehicleOf, stageInfo } from '../fun/exhaust.js';
import { NOZZLES } from '../gfx/vehicles/nozzles.js';
import fs from 'fs';
let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
const TS = [20, 50, 100, 200, 400, 900, 1500, 2700, 7000, 15000], PR = STYLE_PROPS;
// 1. every propellant has a complete style; the roster's five all resolve to themselves (no silent fallback), unknown -> kerolox
ok(PROPS.every(p => STYLE[p]) && STYLE.electric, 'a style row for every roster propellant + electric');
const FIELDS = ['len', 'wid', 'smoke', 'puff', 'glow', 'vacLen', 'vacK', 'vacW', 'k', 'plume', 'core', 'glow'];
ok(PR.every(p => FIELDS.every(f => Number.isFinite(styleFor(p)[f]))), 'every style has every number');
ok(PROPS.every(p => styleFor(p).prop === p) && propOf('plasma') === 'kerolox' && propOf('ion') === 'electric' && styleFor(undefined).prop === 'kerolox', 'propellant resolves, aliases and unknowns fall back');
// 2. the look per class
const at = p => plumeDims({ prop: p, tKN: 900, n: 1 }), L = p => at(p).len, K = p => styleFor(p).k;
ok(L('solid') > L('kerolox') && L('kerolox') > L('methalox') && L('methalox') > L('hydrolox') && L('hydrolox') > L('hypergolic') && L('hypergolic') > L('electric'), 'same thrust: solid > kerolox > methalox > hydrolox > hypergolic > electric in length');
ok(styleFor('solid').smoke >= 2 && styleFor('solid').trail === 'solid' && styleFor('solid').wid > styleFor('kerolox').wid, 'solid: thick plume, dense smoke trail');
ok(styleFor('kerolox').sooty && !PR.filter(p => p !== 'kerolox').some(p => STYLE[p].sooty) && styleFor('kerolox').soot === 1, 'only kerolox is sooty');
ok(styleFor('hydrolox').smoke === 0 && styleFor('hydrolox').puff === 0 && K('hydrolox') < 0.25 && styleFor('hydrolox').len <= 8, 'hydrolox: no smoke, no flame puffs, almost invisible');
ok(styleFor('methalox').smoke <= 0.15 && K('methalox') < K('kerolox') && styleFor('methalox').wid < 1, 'methalox: clean and small');
ok(styleFor('hypergolic').smoke <= 0.06 && K('hypergolic') <= 0.35, 'hypergolic: faint, nearly clear');
ok(styleFor('electric').len <= 2 && K('electric') <= 0.4 && styleFor('electric').glow <= 0.3, 'electric: a tiny glow');
ok(K('solid') >= K('kerolox') && K('kerolox') > K('methalox') && K('methalox') > K('hydrolox'), 'brightness order solid >= kerolox > methalox > hydrolox');
// 3. size grows with thrust and with engine count inside a class, and stays inside sane clamps
for (const p of PR) { const a = TS.map(t => plumeDims({ prop: p, tKN: t, n: 1 })), b = [1, 2, 3, 5, 9, 19, 33].map(n => plumeDims({ prop: p, tKN: 900, n }));
  ok(a.every((d, i) => i === 0 || (d.len >= a[i - 1].len && d.rn >= a[i - 1].rn)) && a[a.length - 1].len > a[0].len * 1.5, `${p}: plume length and radius grow with thrust (${a[0].len.toFixed(1)} .. ${a[a.length - 1].len.toFixed(1)} m)`);
  ok(b.every((d, i) => i === 0 || d.len >= b[i - 1].len) && b[b.length - 1].len > b[0].len, `${p}: a bigger cluster has a longer merged column`);
  ok([...a, ...b].every(d => d.len >= 1.2 && d.len <= 180 && d.rn > 0.05 && d.rn <= 3), `${p}: clamped 1.2..180 m`); }
ok(estExitDiameter(900) > estExitDiameter(100) && estExitDiameter(100, true) > 2.5 * estExitDiameter(100) && estExitDiameter(0) >= 0.12 && estExitDiameter(1e9) <= 6, 'exit diameter estimate: grows with thrust, vacuum bells are wider, clamped');
ok(estEngineThrust(3.7, 9) < estEngineThrust(3.7, 1) && estEngineThrust(0, 1) > 0, 'no-data thrust estimate splits over the engines');
// a model bell wins over the estimate, but only inside 0.4..2.5 x the estimate (a mis-scaled bell never makes a wall or a needle)
ok(plumeDims({ prop: 'kerolox', tKN: 900, exitR: 0.5 }).rn === 0.5 && plumeDims({ prop: 'kerolox', tKN: 900, exitR: 40 }).rn < 3 && plumeDims({ prop: 'kerolox', tKN: 900, exitR: 0.001 }).rn > 0.1, 'model bell radius is used, clamped to the estimate');
const tiny = plumeDims({ prop: 'kerolox', tKN: 31, n: 1, vacuumOnly: true }), boost = plumeDims({ prop: 'kerolox', tKN: 914, n: 9 });
ok(tiny.len < 0.25 * boost.len && tiny.len < 8, `a 31 kN upper-stage engine (${tiny.len.toFixed(1)} m) is nowhere near a 9 x 914 kN booster (${boost.len.toFixed(1)} m)`);
ok(plumeDims({ prop: 'kerolox', tKN: 0, n: 1, stageD: 3.7 }).len > plumeDims({ prop: 'kerolox', tKN: 0, n: 1, stageD: 1.2 }).len, 'no engine data: the stage diameter sets the size');
// 4. vacuum / sea-level behaviour
for (const p of PR) { const s = styleFor(p), v0 = vacFactors(s, 0), v1 = vacFactors(s, 1);
  ok(v0.len === 1 && v0.k === 1 && v0.bellW === 1 && v1.len <= 1 && v1.k <= 1 && v1.bellW >= 1 && v1.k > 0, `${p}: sea level untouched, vacuum = shorter, fainter, wider bell`); }
ok(vacFactors(styleFor('hydrolox'), 1).k < vacFactors(styleFor('kerolox'), 1).k && vacFactors(styleFor('solid'), 1).k >= 0.99, 'in vacuum hydrolox nearly vanishes, a solid stays bright');
// 5. every roster/catalog id: each stage resolves to a real propellant style and a sane plume; within a class bigger engines never get a shorter plume
const ids = new Set(VEHICLES.map(v => v.id)), dir = new URL('../vehicles/roster/', import.meta.url);
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'loss.js')) { const m = await import(new URL(f, dir)); for (const [k, v] of Object.entries(m)) if (k.startsWith('ROSTER_')) for (const x of v) ids.add(x.id); }
for (const id of Object.keys(NOZZLES)) if (!/^(catch-tower|payload-)/.test(id)) ids.add(id);
const rows = [], missing = [], insane = []; let noStage = 0;
for (const id of ids) { const v = vehicleOf(id); if (!v || !v.stages) { noStage++; continue; }
  v.stages.forEach((s, i) => { const inf = stageInfo(s), st = styleFor(inf.prop), d = plumeDims({ prop: inf.prop, tKN: inf.tKN, n: inf.n, vacuumOnly: inf.vacuumOnly, stageD: (v.d || 3) });
    if (!s.propellant || !STYLE[s.propellant] || st.prop !== s.propellant) missing.push(`${id}#${i} ${s.propellant}`);
    if (!(d.len >= 1.2 && d.len <= 180 && Number.isFinite(d.rn))) insane.push(`${id}#${i} ${d.len}`);
    rows.push({ id, i, prop: inf.prop, n: inf.n, tKN: inf.tKN, vac: inf.vacuumOnly, d }); }); }
ok(rows.length > 150, `${ids.size} ids, ${rows.length} stages checked (${noStage} ids without roster stages: bells only)`);
ok(missing.length === 0, 'every roster stage has a propellant style' + (missing.length ? ': ' + missing.slice(0, 6).join(', ') : ''));
ok(insane.length === 0, 'every roster stage has a sane plume size' + (insane.length ? ': ' + insane.slice(0, 6).join(', ') : ''));
for (const p of PROPS) for (const vac of [false, true]) { const g = rows.filter(r => r.prop === p && r.n === 1 && r.tKN > 0 && r.vac === vac).sort((a, b) => a.tKN - b.tKN);
  let mono = true; for (let i = 1; i < g.length; i++) if (g[i].d.len < g[i - 1].d.len - 1e-9 || g[i].d.rn < g[i - 1].d.rn - 1e-9) mono = false;
  ok(mono, `${p}${vac ? ' (vacuum bells)' : ''}: ${g.length} single-engine roster stages, plume grows with thrust (${g.length ? g[0].d.len.toFixed(1) + ' .. ' + g[g.length - 1].d.len.toFixed(1) + ' m' : 'none'})`); }
const cls = p => { const g = rows.filter(r => r.prop === p && r.tKN > 0); return g.reduce((t, r) => t + r.d.len, 0) / Math.max(1, g.length); };
ok(cls('solid') > cls('hydrolox') && cls('kerolox') > cls('hydrolox') && cls('kerolox') > cls('hypergolic'), `roster averages: solid ${cls('solid').toFixed(0)} m, kerolox ${cls('kerolox').toFixed(0)}, methalox ${cls('methalox').toFixed(0)}, hydrolox ${cls('hydrolox').toFixed(0)}, hypergolic ${cls('hypergolic').toFixed(0)}`);
const lens = rows.map(r => r.d.len); ok(Math.max(...lens) / Math.min(...lens) > 8, `plume lengths across the roster span ${Math.min(...lens).toFixed(1)} .. ${Math.max(...lens).toFixed(1)} m, not one size`);
process.exit(bad ? 1 : 0);

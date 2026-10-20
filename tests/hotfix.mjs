// gx1h regression: map exit can't be trapped by a focused input; Esc leaves the map; warp arrows respect limits.
import { readFileSync } from 'node:fs';
import { Flight, WARPS } from '../flight.js?v=f5';
import { TEMPLATES, cloneDesign } from '../parts.js?v=f5';
let n = 0, bad = 0; const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL', m); } };
const src = readFileSync(new URL('../main.js', import.meta.url), 'utf8'), html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
ok(/e\.code === 'Escape' \|\| e\.code === 'Enter' \|\| e\.code === 'KeyM'/.test(src) && /e\.target\.blur\(\)/.test(src), 'focused number input releases M/Esc');
ok(/camMode === 'map'\) \{ exitMap\(\); return; \}/.test(src), 'Esc in map exits the map instead of pausing');
ok(/paused && camMode === 'map'\) \{ setPause\(false\); exitMap\(\)/.test(src), 'M while paused over the map exits');
ok(/k === 'close'\) exitMap\(\)/.test(src), '✕ Map uses exitMap');
ok(/renderer\.domElement\.addEventListener\('pointerdown'[^\n]*blur/.test(src), 'clicking the 3D view blurs focus');
for (const id of ['warpBar', 'wDn', 'wVal', 'wUp']) ok(html.includes(`id="${id}"`), id + ' present');
ok(/code === 'KeyT'\) \{ warpStep\(1\)/.test(src) && /code === 'Comma'\) \{ warpStep\(-1\)/.test(src), 'T and , drive the arrows');
// physics: on the pad / in the atmosphere the warp limit is below the max level
const F = new Flight(cloneDesign(TEMPLATES[0]), { toast() {} });
const lim = F.warpLimit()[0]; ok(lim < WARPS[WARPS.length - 1], 'atmosphere limits warp (got ×' + lim + ')');
F.placeInOrbit(400000, F.v.stages.length - 1); F.ignited = true; F.flags.liftoff = true; F.v.throttle = 0; F.v.ut = 0;
ok(F.warpLimit()[0] > lim, 'orbit allows more warp than the pad (×' + F.warpLimit()[0] + ')');
console.log(`hotfix: ${n - bad}/${n} passed`); if (bad) process.exit(1);

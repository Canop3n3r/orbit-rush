// plume-soft-1 (QA f5.8r/v): the vacuum plume is one soft flaring shell, no hard cone, no starburst; the exhaust smoke is bounded.
// Pure data + source checks here (no GPU); the real material / scene checks run in tests/smoke/plume_soft.cjs.
import fs from 'fs';
import { VAC_PLUME, vacBlend, vacAlt, vacWidth, vacOpacity, smokeWidthCap, smokeFade, plumeLook } from '../fxmap.js';
let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
const src = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
ok(VAC_PLUME.axialK > 0 && VAC_PLUME.radialK > 0 && VAC_PLUME.ramp > 0, 'the vacuum shell has a length falloff and an edge falloff (> 0)');
ok(VAC_PLUME.hard === 0 && VAC_PLUME.flare > 1, 'no hard edge, and the shell flares from the bell exit');
ok(vacBlend(0) === 0 && vacBlend(1) === 1 && vacBlend(0.5) > 0 && vacBlend(0.5) < 1, 'sea level = cones, vacuum = the soft shell, smooth in between');
ok(vacAlt(30000) === 0 && vacAlt(130000) === 1, 'altitude factor runs 40 km .. 120 km');
ok(vacWidth(1) > vacWidth(0) * 1.8, 'wider with altitude');
ok(vacOpacity(1, 1, 1) < vacOpacity(0, 1, 1) * 0.6, 'fainter with altitude');
ok(vacOpacity(0, 1, 0.3) < vacOpacity(0, 1, 1.15) * 0.4, 'hydrolox (k 0.3) is much fainter than kerolox (k 1.15)');
ok(vacOpacity(0, 5, 5) <= 0.8, 'the shell never goes opaque');
ok(plumeLook(10, 1).vac > 0.99 && vacBlend(plumeLook(10, 1).vac) === 1, 'in vacuum the soft shell is fully in');
ok(smokeWidthCap(500) > 1e6 && smokeWidthCap(20000) <= 40 && smokeWidthCap(60000) <= 10.01, 'exhaust smoke width is capped above the pad (<= 40 m at 20 km, <= 10 m high up)');
ok(smokeFade(5000) === 1 && smokeFade(40000) === 0, 'smoke thins out between 14 and 40 km');
const pm = src('fun/plumemat.js'), mn = src('main.js');
const vac = pm.slice(pm.indexOf('export function vacPlumeMaterial'));
ok(/depthWrite:\s*false/.test(vac) && /AdditiveBlending/.test(vac) && /transparent:\s*true/.test(vac), 'vacuum material: additive, transparent, depthWrite off');
ok(/axialK/.test(vac) && /smoothstep/.test(vac) && /radialK/.test(vac), 'vacuum material fades along the length, at the nozzle ramp and at the edges');
ok(/vacGeo\(\)/.test(mn) && /plumeVac/.test(mn) && /vshow\(plume\)/.test(mn), 'main.js builds the shell into every plume and drives it in emit()');
ok(/softGlowTexture\(\)/.test(mn) && !/map:\s*GX\.glowTexture\(\)/.test(mn.slice(mn.indexOf('plumeSprite:'), mn.indexOf('plumeSprite:') + 200)), 'the nozzle glow sprite uses the spike-free texture');
ok(/ey = /.test(mn) && /plume\.position\.y = ey/.test(mn), 'core plumes start at the bell exit height');
ok(/wCap = smokeWidthCap\(h\)/.test(mn) && /Math\.min\(wCap, /.test(mn), 'emit() caps the smoke width');
console.log(bad ? `${bad} FAILED` : 'plume_soft: all passed'); process.exit(bad ? 1 : 0);

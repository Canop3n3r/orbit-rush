// Reentry detail pass: plasma / compression / heating layers stay small, readable, and quality-tiered.
// Phone preset is `med` (main.js). Low is the auto-dropped tier. Flow particle budgets must not grow.
import * as FX from '../fxmap.js?v=reentry-fx';
import { readFileSync } from 'node:fs';
let pass = 0, fail = 0;
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✔', n, extra); } else { fail++; console.log('  ✘', n, extra); } };
const monotone = (f, xs, dir = 1) => xs.every((x, i) => i === 0 || dir * (f(x) - f(xs[i - 1])) >= -1e-12);
const range = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));

console.log('1. Shock collar stays a collar (no sky cone) and gets brighter only as the air heats');
{
  const L = 70, d = 3.7;
  ok(FX.shockCollarH(L, d) === Math.min(L * 0.18, 1.8 * d + 2), 'collar height is the f3 cap', FX.shockCollarH(L, d).toFixed(2));
  ok(FX.shockCollarH(L, d) <= L * 0.6 + 6, 'collar under the no_shock_cone screen limit');
  ok(FX.shockCollarI(0, 0) === 0 && FX.shockCollarI(FX.shockStrength(2, 30000), 0) < 0.2, 'cold Mach-2 collar stays dim', FX.shockCollarI(FX.shockStrength(2, 30000), 0).toFixed(3));
  ok(FX.shockCollarI(1, 1) > 0.7 && FX.shockCollarI(1, 1) <= 1, 'hot collar is clearly on, still clamped');
  ok(monotone(g => FX.shockCollarI(0.5, g), range(0, 1, 11)) && monotone(s => FX.shockCollarI(s, 0.2), range(0, 1, 11)), 'collar brightness non-decreasing in shock and glow');
}

console.log('2. Compression film is a nose cap, off until the layer is actually hot');
{
  const L = 70, d = 3.7, film = FX.compressionFilm(L, d, 1.2);
  ok(film.H <= FX.shockCollarH(L, d) && film.H <= 3.5 && film.H >= 0.3, 'film is shorter than the collar and at most a few metres', film.H.toFixed(2));
  ok(film.R <= 2.6 && film.R < d, 'film is not wider than the vehicle', film.R.toFixed(2));
  const cap = FX.compressionFilm(4.2, 2.5, 0.15);
  ok(cap.H >= 0.9 && cap.H <= 2.2 && cap.R < 2.5, 'a Mach-25 capsule still gets a nose-sized film', `${cap.H.toFixed(2)} × r ${cap.R.toFixed(2)}`);
  ok(FX.bowLength(4.2, 2.5) <= 5.6 && FX.bowLength(70, 3.7) <= 32 && FX.bowLength(70, 3.7) < 70, 'bow is a cap, not a body-length spear');
  ok(FX.wakeLength(4.2, 2.5, 0.7) < 32 && FX.wakeLength(70, 3.7, 1) <= 42 && FX.wakeLength(70, 3.7, 1) > 10, 'wake is a trail, not a screen-filling spike');
  ok(FX.compressionFilmI(1, 0, 0) === 0 && FX.compressionFilmI(FX.shockStrength(1.4, 40000), 0, 0.02) === 0, 'no film on a cold transonic collar');
  ok(FX.compressionFilmI(1, 0.6, 0.2) > 0.35, 'hypersonic compression lights the film');
  ok(monotone(g => FX.compressionFilmI(0.8, g, 0.2), range(0.05, 1, 10)), 'film brightens as compression glow rises');
}

console.log('3. Plasma sheath layers: stagnation core, turbulence, cooler wake — gated like the bow');
{
  ok(FX.stagnationCore(0) === 0 && FX.stagnationCore(1) === 1 && monotone(FX.stagnationCore, range(0, 1, 13)), 'stagnation core rises with plasma and saturates');
  ok(FX.stagnationCore(0.15) === 0 && FX.stagnationCore(0.9) > 0.8, 'core stays off until the sheath is obvious');
  ok(monotone(FX.sheathTurbulence, range(0, 1, 13)) && FX.sheathTurbulence(0.05) === 0 && FX.sheathTurbulence(1) === 1, 'turbulence fades in with the sheath');
  ok(FX.wakeGlow(1) < 0.75 && FX.wakeGlow(1) > 0.45 && FX.wakeGlow(0) === 0, 'wake stays dimmer than a full bow');
  const cap = FX.stagnationCap(3.7, 1);
  ok(cap.R < 3.7 && cap.R > 0.4 && FX.stagnationCap(3.7, 1).R >= FX.stagnationCap(3.7, 0.2).R, 'stagnation bulb stays inside the diameter and grows with plasma', cap.R.toFixed(2));
  ok(FX.entrySparks(0.3, +1200) === 0 && FX.entrySparks(0.9, +200) === 0, 'no entry sparks on a climb');
  ok(FX.entrySparks(0.05, -2000) === 0 && FX.entrySparks(0.85, -2500) > 0.7, 'sparks only on a hot descent');
  const wN = FX.windwardHeat(1, 1, true), wA = FX.windwardHeat(1, 0, true), wL = FX.windwardHeat(0, 1, true);
  ok(wN > wA && wA > wL && wL < 0.15, 'heating peaks on the windward nose, lee stays dim', `${wN.toFixed(2)} > ${wA.toFixed(2)} > ${wL.toFixed(2)}`);
  ok(FX.windwardHeat(1, 0, false) > FX.windwardHeat(1, 1, false), 'base-first entry heats the shield end');
}

console.log('4. Quality presets: phones skip the heavy layers; flow counts unchanged');
{
  const { low, med, high } = FX.QUALITY;
  ok(low.flowCPU === 350 && med.flowCPU === 1000 && high.flowCPU === 2200, 'CPU flow counts unchanged');
  ok(low.flowGPU === 2500 && med.flowGPU === 6000 && high.flowGPU === 10000, 'GPU flow counts unchanged');
  ok(low.sparks === 0 && low.sheet === false && low.core === false && low.turb === false, 'low: no extra reentry layers');
  ok(med.sheet === true && med.core === false && med.turb === true && med.sparks > 0 && med.sparks <= 160, 'med (phone): film + turbulence, small spark budget, no extra bulb', `sparks ${med.sparks}`);
  ok(high.sheet === true && high.core === true && high.turb === true && high.sparks > med.sparks && high.sparks <= 480, 'high: full sheath, sparks still capped', `sparks ${high.sparks}`);
  ok(low.plasmaShell === false && med.plasmaShell === true && high.plasmaShell === true, 'windward shell still med/high only');
}

console.log('5. fx.js draws those layers and does not grow the shock collar');
{
  const src = readFileSync(new URL('../fx.js', import.meta.url), 'utf8');
  ok(src.includes('shockCollarH') && src.includes('compressionFilm') && src.includes('stagnationCap') && src.includes('bowLength') && src.includes('wakeLength'), 'sizes come from fxmap');
  ok(src.includes('shockCollarI') && src.includes('compressionFilmI') && src.includes('entrySparks') && src.includes('stagnationCore'), 'intensities come from fxmap');
  ok(src.includes('Q.sheet') && src.includes('Q.core') && src.includes('Q.turb') && src.includes('Q.sparks'), 'every new layer checks the quality preset');
  ok(/shockCollarH\(/.test(src) && !/shock\.scale\.set\([^)]*L \* [2-9]/.test(src), 'the collar mesh uses the capped height');
}

console.log(`reentry_fx: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

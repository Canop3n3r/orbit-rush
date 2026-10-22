// f5.6u (QA f5.6s P2): the same AUTO launch driven through Flight.advance() at different render frame times
// (60 fps, 30 fps, 12 fps, 10 fps cap, jittery) must give the same orbit: physics steps are fixed-size with a
// carried remainder instead of simDt/N per frame. Run: node tests/framerate.mjs
import * as P from '../physics.js';
import { Flight } from '../flight.js';
import { SHOWROOM } from '../fun/showroom.js';
let p = 0, f = 0; const t = (c, m) => { if (c) { p++; console.log('  ✔ ' + m); } else { f++; console.log('  ✘ ' + m); } };
const d = SHOWROOM.find(r => r.id === 'swift').design;
const run = (frame) => { const F = new Flight(d, {}, { earthRot: true }); F.stagePress(); F.setAuto(true, true); let i = 0, real = 0;
  while (real < 1500 && !F.flags.dead && !(F.flags.orbit && F.v.guid === 'done')) { const rdt = frame(i++); real += rdt; F.advance(rdt); }
  const o = P.orbitOf(F.v); return { ap: o.ap / 1000, pe: o.pe / 1000, met: F.met, orbit: !!F.flags.orbit && !F.flags.dead }; };
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const cases = [['60 fps', () => 1 / 60], ['30 fps', () => 1 / 30], ['12 fps', () => 1 / 12], ['10 fps cap', () => 0.1], ['jitter 8-60 fps', () => 1 / 60 + rnd() * 0.1]];
const res = cases.map(([n, fr]) => [n, run(fr)]), [, ref] = res[0];
for (const [n, r] of res) console.log(`    ${n}: ${r.ap.toFixed(1)}×${r.pe.toFixed(1)} km, met ${r.met.toFixed(0)} s`);
t(ref.orbit, `60 fps reaches orbit (${ref.ap.toFixed(0)}×${ref.pe.toFixed(0)} km)`);
for (const [n, r] of res.slice(1)) t(r.orbit && Math.abs(r.ap - ref.ap) < 3 && Math.abs(r.pe - ref.pe) < 3 && Math.abs(r.met - ref.met) < 15, `${n} matches 60 fps (Δap ${(r.ap - ref.ap).toFixed(1)} km, Δpe ${(r.pe - ref.pe).toFixed(1)} km, Δmet ${(r.met - ref.met).toFixed(0)} s)`);
console.log(`framerate: ${p} passed, ${f} failed`); process.exit(f ? 1 : 0);

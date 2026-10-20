// f2h: every showroom rocket flies its role with AUTO (or its one-tap mission). Run: node tests/showroom.mjs
import * as P from '../physics.js?v=f5b';
import { Flight, simulateAuto } from '../flight.js?v=f5b';
import { validate, aeroBalance, designStats } from '../parts.js?v=f5b';
import { Director } from '../fun/director.js?v=f5b';
import { SHOWROOM, bars } from '../fun/showroom.js?v=f5b';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fail++; console.log('  ✘', m); } };
const T0 = P.tFromDate(Date.UTC(2026, 9, 19, 15)), km = x => (x / 1000).toFixed(0) + ' km';
ok(SHOWROOM.length >= 8 && SHOWROOM.length <= 12, `${SHOWROOM.length} prebuilt rockets`);
ok(new Set(SHOWROOM.map(r => r.name)).size === SHOWROOM.length, 'unique names');
const widths = new Set(), heights = [];
for (const r of SHOWROOM) { const s = designStats(r.design); heights.push(s.stages.length); r.design.parts.forEach(p => widths.add(p.id)); }
ok(['tank-n', 'tank-w', 'rdec', 'chute', 'bison'].every(id => widths.has(id)), 'varied: slim + wide tanks, side boosters, parachutes, engine clusters');
for (const r of SHOWROOM) {
  ok(validate(r.design).ok && aeroBalance(r.design).stable, `${r.name}: valid and aerodynamically stable`);
  const b = bars(r); ok(['power', 'range', 'difficulty'].every(k => b[k] > 0 && b[k] <= 1), `${r.name}: bars ${(b.power * 10).toFixed(0)}/${(b.range * 10).toFixed(0)}/${(b.difficulty * 10).toFixed(0)}`);
  if (r.check.startsWith('mission:')) {
    const id = r.check.slice(8), F = new Flight(r.design, {}, { t0: T0 }), D = new Director(F, id, { say: () => {} });
    for (let i = 0; i < 2e6 && D.active; i++) { D.tick(1 / 30); F.advance(1 / 30); }
    ok(D.ok && !F.flags.dead, `${r.name} — one-tap ${id}: ${D.result}`);
    if (id === 'hop') { ok(F.flags.landed && F.flags.touchdown < 6, `${r.name} touches down at ${F.flags.touchdown.toFixed(1)} m/s (hoverslam)`); ok((F.flags.maxAlt || 0) > 2000, `${r.name} hopped to ${km(F.flags.maxAlt || 0)}`); }
    if (r.alt) { const F2 = new Flight(r.design, {}, { t0: T0 }), D2 = new Director(F2, r.alt, { say: () => {} }); for (let i = 0; i < 2e6 && D2.active; i++) { D2.tick(1 / 30); F2.advance(1 / 30); } ok(D2.ok, `${r.name} — one-tap ${r.alt}: ${D2.result}`); }
    continue;
  }
  const res = simulateAuto(r.design, { dt: 1 / 20, tMax: 3000 });
  if (r.check === 'space') ok(!res.dead && res.ap > 100000, `${r.name} reaches space with AUTO (Ap ${km(res.ap)})`);
  if (r.check === 'orbit') ok(res.orbit && res.pe > P.ORBIT_PE, `${r.name} reaches orbit with AUTO (${km(res.ap)} × ${km(res.pe)})`);
  if (r.check === 'booster') { const rb = simulateAuto(r.design, { dt: 1 / 20, ...(r.design.recovery === 'rtls' ? {} : { reserve: 16 }) }) /* f4.1: RTLS boosters stage on AUTO's own boostback reserve */; ok(rb.orbit && rb.boosterLanded, `${r.name}: orbit and the booster lands itself`); }
  if (r.check === 'hop') ok(!res.dead && res.ap > 20000 && res.ap < 100000, `${r.name} hops to ${km(res.ap)} (suborbital)`);
}
console.log(`showroom: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

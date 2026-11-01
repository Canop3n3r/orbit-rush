// f5.9-13: a pre-launch transfer plan flown on AUTO, end to end. The plan picks the day, site and time; the Flight starts on that day with the
// real Earth rotation from that site; the Director flies the ascent, the planned departure, corrections and capture. node tests/xfer_auto.mjs [moon,mars]
import * as P from '../physics.js?v=f5.9-13';
import * as T from '../physics/transfer_plan.js?v=f5.9-13';
import { Flight } from '../flight.js?v=f5.9-13';
import { TEMPLATES } from '../parts.js?v=f5.9-13';
import { Director, MISSIONS } from '../fun/director.js?v=f5.9-13';
import { siteOpts } from '../sites.js?v=f5.9-13';
import { latLonToGame } from '../gfx/earthmap.js?v=f5.9-13';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fail++; console.log('FAIL', m); } };
const T0 = P.tFromDate(Date.UTC(2026, 10, 1, 12)), tpl = n => TEMPLATES.find(t => t.name === n);
for (const [id, rocket, maxF] of [['moon', 'Moon lander', 3e6], ['mars', 'Mars explorer', 6e6]].filter(x => (process.argv[2] || 'moon,mars').split(',').includes(x[0]))) {
  const pl = T.planTransfer({ target: id, t0: T0 }); ok(pl && pl.ok, `${id}: plan ok (${pl && pl.launch && pl.launch.siteName}, ${pl && pl.launch && pl.launch.date.toISOString()})`); if (!pl || !pl.ok) continue;
  const L = pl.launch, F = new Flight(tpl(rocket), {}, { ...siteOpts({ body: 'earth', id: L.site, name: L.siteName, lat: L.lat, lon: L.lon }, latLonToGame), t0: L.t, realPhase: true, incl: L.incl });
  MISSIONS.xfer = { name: 'Transfer', icon: '🪐', tpl: null, target: id, capture: true, blurb: '' }; const said = [];
  const D = new Director(F, 'xfer', { departT: pl.departT, say: m => said.push(m) }); let burnT = null, maxPhaseBurns = 0;
  for (let i = 0; i < maxF && D.active; i++) { D.tick(1 / 30); F.advance(1 / 30); if (burnT == null && D.phase === 'burn' && F.exec) burnT = F.tAbs; }
  const tooEarly = burnT == null ? NaN : (burnT - pl.departT) / 3600;
  console.log(`  ${id}: ${D.log.join('>')} · ${D.result} · corrections ${D.corrections} · departure ${isNaN(tooEarly) ? '?' : tooEarly.toFixed(1)} h from plan`);
  ok(D.log.includes('ascent') && D.log.includes('burn') && D.log.includes('capture'), `${id}: ascent, departure burn and capture flown`);
  ok(Math.abs(tooEarly) < 4, `${id}: departure burn within 4 h of the planned departure`);
  ok(D.ok && F.body === id && !F.flags.dead, `${id}: in orbit of ${P.BODIES[id].name} (${D.result})`);
  ok(D.corrections <= 3, `${id}: smooth, at most 3 course corrections (${D.corrections})`);
}
console.log(`xfer_auto: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

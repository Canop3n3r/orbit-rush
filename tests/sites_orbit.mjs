// fx-site: AUTO reaches the same ~185 km orbit from every Earth launch site (West Coast Pad / Steppe / Peninsula used to
// burn on to an escape orbit, the rest stopped at 152-163 km): a weak upper stage that circularizes low raises its apoapsis
// and circularizes again instead of burning forever under the target perigee.
import * as P from '../physics.js?v=site';
import { Flight } from '../flight.js?v=site';
import { SHOWROOM } from '../fun/showroom.js?v=site';
import { SITES, siteOpts } from '../sites.js?v=site';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  ✔' : 'FAIL', m); };
const d = SHOWROOM.find(r => r.id === 'swift').design;
const fly = opts => { const F = new Flight(JSON.parse(JSON.stringify(d)), {}, opts); F.stagePress(); F.setAuto(true, true);
  let early = false; for (let i = 0; i < 30 * 3000 && !F.flags.dead; i++) { const was = F.flags.orbit; F.advance(1 / 30); if (!was && F.flags.orbit && F.v.thrust > 0) early = true; const o = P.orbitOf(F.v); if (F.flags.orbit && F.v.guid === 'done') break; }
  return { F, o: P.orbitOf(F.v), early }; };
for (const s of [[null, 'default pad'], ...SITES.earth.map(x => [x, x[1]])]) {
  const { F, o, early } = fly(s[0] ? siteOpts({ body: 'earth', id: s[0][0], lat: s[0][2], lon: s[0][3], name: s[0][1] }) : {});
  ok(!early, `${s[1]}: the ORBIT call waits for the AUTO burn to end`);
  ok(!F.flags.dead && F.flags.orbit && F.v.guid === 'done' && o.ap > 175000 && o.ap < 200000 && o.pe > 145000, `${s[1]}: AUTO ends in a ${(o.ap / 1000).toFixed(0)} × ${(o.pe / 1000).toFixed(0)} km orbit (Ap ~185 km like the default pad)`);
}
console.log(`sites_orbit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

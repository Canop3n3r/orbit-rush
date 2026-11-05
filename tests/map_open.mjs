// Opening the map centers the vessel you are flying, every time.
// A coasting vessel and the planet you were looking at last are not the camera target.
import { Flight } from '../flight.js';
import * as P from '../physics.js';
import { SHOWROOM } from '../fun/showroom.js';
import { cloneDesign } from '../parts.js';
import { mapOpenAim, mapFocusAllowed } from '../mapaim.js';

let pass = 0, fail = 0;
const ok = (c, m, x = '') => { if (c) { pass++; console.log('  ✔', m, x); } else { fail++; console.log('  ✘', m, x); } };
const fit = far => 2.2 * far / Math.tan(0.4);
const design = () => { const d = cloneDesign(SHOWROOM.find(s => s.id === 'swift').design); d.model = 'heron-9'; return d; };
const T0 = P.tFromDate(Date.UTC(2026, 9, 19, 15));
const flight = () => new Flight(design(), { toast() {} }, { t0: T0 });

{
  const F = flight();
  F.placeInOrbit(300000);
  const low = mapOpenAim(F, fit);
  ok(low.focus === 'craft' && low.trans === null && low.pan.every(x => x === 0), 'opening the map aims at the craft, with no pan and no glide');
  ok(low.activeId === F.fleet.activeId && low.body === 'earth' && low.dist > P.BODIES.earth.R, 'the open aim is the flown vessel', `${low.activeId} dist ${Math.round(low.dist)}`);

  F.releasePayload();
  const sat = F.fleet.list.find(o => !o.origin);
  const r = 4.2e7, spd = Math.sqrt(P.BODIES.earth.mu / r);
  sat.r = [r, 0, 0]; sat.v = [0, spd, 0]; sat.t = F.tAbs;
  ok(F.switchTo(sat.id, true), 'switch to the high craft');
  const hi = mapOpenAim(F, fit);
  const parked = Math.hypot(...F.fleet.stateAt(F.fleet.get(F.originId), F.tAbs).r);
  ok(hi.activeId === sat.id && hi.activeId !== F.originId, 'open aim follows the active craft, not the launch stage');
  ok(hi.focus === 'craft' && hi.trans === null && hi.pan.every(x => x === 0), 'the last planet focus is not kept');
  ok(Math.hypot(...F.v.r) > 3e7 && parked < 1e7, 'the active craft and the parked rocket are apart', `active ${Math.round(Math.hypot(...F.v.r))} parked ${Math.round(parked)}`);
  ok(hi.dist > low.dist * 2, 'camera distance frames the active craft orbit, not the parked rocket', `${Math.round(low.dist)} → ${Math.round(hi.dist)}`);
  ok(hi.body === F.body, 'the open aim uses the body the active craft is flying', hi.body);
}

{
  const t = 10000;
  ok(mapFocusAllowed('craft', t, t + 10, false), 'the active craft is always an allowed focus');
  ok(!mapFocusAllowed('moon', t, t + 10, false), 'a ghost tap just after open cannot focus a planet');
  ok(mapFocusAllowed('moon', t, t + 10, true), 'a real press on the map can focus a planet immediately');
  ok(!mapFocusAllowed('earth', t, t + 499, false), 'the open lock lasts 500 ms');
  ok(mapFocusAllowed('moon', t, t + 500, false), 'after the open lock, planet focus works again');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

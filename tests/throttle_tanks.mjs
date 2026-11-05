// Fine full-travel throttle and the per-rocket tank list that replaces the S1/S2 bars.
import { thrFromY, throttleGesture, THUMB } from '../mobile.js';
import { rocketTanks } from '../fun/tankviz.js';
let p = 0, f = 0; const t = (c, m) => { if (c) { p++; console.log('  ✔ ' + m); } else { f++; console.log('  ✘ ' + m); } };
const box = (h, w = 48, top = 0, left = 0) => ({ getBoundingClientRect: () => ({ top, bottom: top + h, left, right: left + w, width: w, height: h, x: left, y: top }) });

const el = box(128);
t(THUMB >= 12, 'thumb has a real travel inset');
t(thrFromY(el, 128 - 1) === 0, 'bottom edge is cutoff ' + thrFromY(el, 127));
t(thrFromY(el, 1) === 1, 'top edge is full throttle ' + thrFromY(el, 1));
t(Math.abs(thrFromY(el, 64) - 0.5) < 0.015, 'midpoint of the track is half ' + thrFromY(el, 64));
// 1% above cutoff used to snap to 0 because of the end dead zone. Full travel keeps it.
t(Math.abs(thrFromY(el, 118.88) - 0.01) < 0.001, '1% above cutoff is not swallowed ' + thrFromY(el, 118.88));
const a = thrFromY(el, 40), b = thrFromY(el, 40.15);
t(a !== b && Math.abs(a - b) < 0.005, 'steps are finer than half a percent ' + a + ' vs ' + b);
const short = box(52);
t(Math.abs(thrFromY(short, 26) - 0.5) < 0.02, 'a short bar still travels the whole track ' + thrFromY(short, 26));

const mid = throttleGesture(el, { clientX: 24, clientY: 64 }, null);
const coarse = throttleGesture(el, { clientX: 24, clientY: 44 }, mid);
const armed = throttleGesture(el, { clientX: 120, clientY: 64 }, mid);
const fine = throttleGesture(el, { clientX: 120, clientY: 44 }, armed);
t(armed.fine && armed.out === mid.out, 'sliding off the track arms fine control without a jump');
t(Math.abs(fine.out - mid.out) < Math.abs(coarse.out - mid.out) * 0.55, 'the same upward drag is finer off to the side ' + fine.out + ' vs ' + coarse.out);
t(fine.out > mid.out && coarse.out > mid.out, 'both drags still open the throttle');

const ship = { cur: 0, stages: [
  { fuel: 80, fuelMax: 100, parts: [{ kind: 'tank', fuelCap: 60 }, { kind: 'engine', fuelCap: 0 }, { kind: 'tank', fuelCap: 40 }] },
  { fuel: 20, fuelMax: 20, radial: 2, parts: [{ kind: 'tank', fuelCap: 20 }] },
  { fuel: 9, fuelMax: 10, parts: [{ kind: 'tank', fuelCap: 10 }] },
  { fuel: 0, fuelMax: 0, parts: [{ kind: 'pod', fuelCap: 0 }] },
] };
const tanks = rocketTanks(ship);
t(tanks.filter(x => !x.radial).length === 3, 'each core tank, not one bar per stage ' + tanks.filter(x => !x.radial).length);
t(tanks.filter(x => x.radial && x.pair).length === 1, 'a radial stage is one booster pair');
t(tanks[0].stage === 0 && tanks[0].cap === 60 && tanks[1].cap === 40, 'tanks stay in aft-to-nose order');
t(tanks[0].frac === 0.8 && tanks[1].frac === 0.8 && tanks.find(x => x.stage === 2).frac === 0.9, 'tanks in a stage drain together from that stage');
t(!tanks.some(x => x.stage === 3), 'a stage with no tank is not a fuel bar');
ship.cur = 1; ship.stages[0].fuel = 0;
const staged = rocketTanks(ship);
t(staged.filter(x => x.stage === 0).every(x => x.spent) && staged.find(x => x.stage === 2).active === false, 'dropped tanks read spent');
const booster = { cur: 0, stages: [{ fuel: 12, fuelMax: 40, parts: [{ kind: 'tank', fuelCap: 40 }] }] };
const bt = rocketTanks(booster);
t(bt.length === 1 && bt[0].frac === 0.3 && !bt[0].radial, 'the booster graphic is only that rocket');
console.log(`throttle_tanks: ${p} passed, ${f} failed`);
process.exit(f ? 1 : 0);

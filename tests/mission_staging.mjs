// f5.4 (QA B3): mission AUTO stages an Earth-orbit flight with the same rule as normal AUTO (reusable booster keeps its landing fuel)
import assert from 'node:assert/strict';
import { Flight } from '../flight.js';
import { Director } from '../fun/director.js';
import { SHOWROOM } from '../fun/showroom.js';
const swift = SHOWROOM.find(r => r.id === 'swift').design, DT = 1 / 30;
const stageAt = (mission) => { const F = new Flight(swift, {}, {}); let D = null;
  if (mission) D = new Director(F, 'orbit'); else { F.stagePress(); F.setAuto(true, true); }
  for (let i = 0; i < 30 * 400; i++) { if (D) D.tick(DT); F.advance(DT); if (F.v.cur > 0) return { alt: F.alt, met: F.met }; if (F.flags.dead) break; } return null; };
const n = stageAt(false), m = stageAt(true);
console.log('normal', n && Math.round(n.alt), 'mission', m && Math.round(m.alt));
assert.ok(n && m, 'both stage'); assert.ok(Math.abs(n.alt - m.alt) < 8000, 'mission AUTO stages at the normal AUTO altitude');
const D2 = new Director(new Flight(swift, {}, {}), 'moon'); assert.equal(D2.F.autoStage, false, 'Moon keeps the whole booster');
console.log('mission_staging: ok');

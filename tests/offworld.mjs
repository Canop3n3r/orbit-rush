// f5.4 (QA f5.4b H): a flight launched from another world gets an end card once it coasts in orbit there
import assert from 'node:assert/strict';
import { Flight } from '../flight.js';
import { SHOWROOM } from '../fun/showroom.js';
import { siteOpts } from '../sites.js';
for (const [body, lat, lon] of [['moon', 0.7, 23.5], ['mars', 18.4, -133.8]]) {
  let ended = false; const F = new Flight(SHOWROOM.find(r => r.id === 'needle').design, { end: () => { ended = true; } }, siteOpts({ body, lat, lon }));
  F.stagePress(); F.setAuto(true, true);
  for (let i = 0; i < 30 * 1500 && !F.flags.dead && !ended; i++) F.advance(1 / 30);
  assert.ok(!F.flags.dead, body + ': ' + F.flags.dead); assert.ok((F.goals[body] || {}).orbit, body + ' orbit'); assert.ok(ended, body + ': end card queued');
}
console.log('offworld: ok');

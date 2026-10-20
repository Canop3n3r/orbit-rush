import assert from 'node:assert/strict';
import { stageReusable, designReusable } from '../vehicles/reusable.js';
import { Flight } from '../flight.js';
import { SHOWROOM } from '../fun/showroom.js';
for (const id of ['heron-9', 'heron-9-crew', 'heron-heavy', 'colossus-v3', 'colossus-v4', 'new-glendale']) assert.ok(stageReusable(id), id + ' booster reusable');
for (const id of ['sparrow-1', 'heron-9-v11', 'selene', 'ares', 'arion-5', 'jade-lantern-5b', 'polar-slinger', 'unknown']) assert.ok(!stageReusable(id), id + ' expendable');
assert.ok(!stageReusable('new-glendale', 1), 'glendale upper expended');
assert.equal(designReusable({ parts: [] }), true);
// an expendable rocket's booster drops as debris (no booster view); a reusable one becomes F.booster
const fly = d => { const ev = []; const F = new Flight(d, { stage: () => ev.push('stage'), drop: () => ev.push('drop') }, {});
  F.ignited = true; const m = Math.hypot(...F.v.r); F.v.r = F.v.r.map(x => x * (m + 60000) / m); F.stage(); return { ev, booster: F.booster }; };
const needle = SHOWROOM.find(r => r.id === 'needle'), swift = SHOWROOM.find(r => r.id === 'swift');
const e = fly(needle.design); assert.deepEqual(e.ev, ['drop']); assert.equal(e.booster, null);
const r = fly(swift.design); assert.deepEqual(r.ev, ['stage']); assert.ok(r.booster);
console.log('reusable: ok');

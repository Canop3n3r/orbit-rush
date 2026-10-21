// f5.4 (QA f5.4b C1/B5): a new player's orbit card offers the starter orbiter, and Pip on AUTO comes home under its chute
import assert from 'node:assert/strict';
import { cardChoice } from '../fun/mispick.js';
import { Flight } from '../flight.js';
import { SHOWROOM } from '../fun/showroom.js';
const starter = { key: 'o:needle', name: 'Needle', base: 'needle' };
const ch = cardChoice([{ key: 'o:heron', name: 'Heron-9 Crew', base: 'heron' }], { name: 'Pip', ok: true, sub: true }, true, () => true, starter);
assert.equal(ch.sel, 'o:needle', 'Needle preselected'); assert.ok(ch.list.some(r => r.mine), 'Pip still listed'); assert.ok(/can’t reach orbit/.test(ch.note), ch.note);
const hop = cardChoice([], { name: 'Pip', ok: true, sub: true }, false, () => true, starter); assert.equal(hop.sel, 'mine', 'hop keeps Pip');
const F = new Flight(SHOWROOM.find(r => r.id === 'pip').design, {}, {}); F.stagePress(); F.setAuto(true, true);
for (let i = 0; i < 30 * 2000 && !F.flags.dead && !F.flags.landed; i++) F.advance(1 / 30);
assert.ok(!F.flags.dead, 'Pip on AUTO does not crash: ' + F.flags.dead); assert.ok(F.flags.landed, 'Pip lands under its chute');
console.log('newplayer: ok');

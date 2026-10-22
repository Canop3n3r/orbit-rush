// fleet-1 (Aaron 10-22): Originals retired; hopper saved as Sandpiper under Spacey; default is Heron-9 (swift stack)
import { SHOWROOM, RETIRED, DEFAULT_ID } from '../fun/showroom.js';
import { pickerHTML } from '../fun/picker.js';
import { isHopper } from '../fun/director.js';
let f = 0; const ok = (c, m) => { if (!c) { f++; console.log('FAIL', m); } };
ok(['pip', 'selene', 'ares'].every(id => RETIRED.has(id)), 'pip/selene/ares retired');
ok(SHOWROOM.some(r => r.id === DEFAULT_ID) && !RETIRED.has(DEFAULT_ID), 'default is a live rocket');
const hop = SHOWROOM.find(r => r.id === 'hopper'); ok(hop.name === 'Sandpiper' && hop.house === 'spacey' && isHopper(hop.design), 'Sandpiper is a Spacey hopper');
const h = pickerHTML({ sets: { spacey: ['heron-9'] }, pinned: { spacey: [{ i: 8, name: 'Sandpiper', role: 'x' }] }, name: id => id });
ok(!/Originals/.test(h) && /Sandpiper/.test(h) && /data-i="8"/.test(h), 'picker: no Originals section, Sandpiper under Spacey');
console.log(`fleet_retire: ${f ? f + ' failed' : 'ok'}`); if (f) process.exit(1);

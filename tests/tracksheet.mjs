// OR-003: the map tracking sheet and the craft list stay usable with many craft.
// Before this, the map printed the last 12 Earth objects as one flat list (no groups, no filter,
// a tap anywhere toggled the pill) and the craft list was one full row per vessel.
import { loadRows, readCraftRows, filterRows, groupRows, chipsFor, cycleId, renderSheet, sheetVisible, familyOf, COLLAPSE_AT } from '../fun/tracksheet.js';
let pass = 0, fail = 0; const ok = (c, m, x = '') => { if (c) { pass++; console.log('  ✔', m, x); } else { fail++; console.log('FAIL', m, x); } };

const sat = (n, extra = {}) => ({ id: 's' + n, name: 'Constellation sat #' + n + ' of 12', type: 'leosat', cls: 'Satellite', body: 'earth', group: 'constellation', alt: 530000 + n * 10, active: false, ...extra });
const crowded = [
  ...Array.from({ length: 12 }, (_, i) => sat(i + 1)),
  { id: 'stage', name: 'Spent stage', type: 'stage', cls: 'Stage', body: 'earth', alt: 210000, active: true, origin: true, canFly: false },
  { id: 'probe', name: 'Science probe', type: 'probe', cls: 'Probe', body: 'moon', alt: 80000, active: false, canFly: true },
];

ok(familyOf('Constellation sat #12 of 21') === 'Constellation sat', 'a numbered batch shares one family name');
ok(familyOf('Cubesat 3 of 6') === 'Cubesat', 'a "k of n" name drops the counter');
ok(familyOf('Comm satellite') === 'Comm satellite', 'a name with no counter stays whole');
ok(COLLAPSE_AT === 6, 'a group of 6 or more starts closed');

ok(sheetVisible(crowded), '14 craft show the tracking sheet');
ok(sheetVisible([{ id: 'only', name: 'Rail', active: false }]), 'one rail object still shows the pill');
ok(!sheetVisible([{ id: 'me', name: 'Rocket', active: true }]), 'the flown rocket alone does not open a tracking sheet');
ok(!sheetVisible([]), 'no craft, no sheet');

{ const rows = readCraftRows({ vesselList() { throw new Error('fleet not ready'); } }, [{ id: 'o1', name: 'World sat', body: 'earth' }, { id: 'o2', name: 'World sat 2' }]);
  ok(rows.length === 2 && rows.every(r => r.source === 'rail') && rows.every(r => !r.canFly), 'a missing craft list falls back to rail satellites', rows.map(r => r.id).join(',')); }
{ const rows = readCraftRows({ vesselList: () => [{ id: 'v1', name: 'Rocket', type: 'stage', cls: 'Stage', body: 'earth', alt: 200000, active: true }, { id: 'v2', name: 'Cubesat 1 of 6', type: 'cubesat', cls: 'Cubesat', body: 'earth', alt: 400000, active: false }] }, [{ id: 'o9', name: 'stale' }]);
  ok(rows.length === 2 && rows[0].source === 'vessel' && rows[0].canFly === false && rows[1].canFly === true && !rows.some(r => r.id === 'o9'), 'two or more vessels win over the rail list'); }
{ const rows = readCraftRows({ vesselList: () => [{ id: 'v1', name: 'Rocket', cls: 'Stage', body: 'earth', active: true }] }, [{ id: 'o1', name: 'Left behind', body: 'earth' }]);
  ok(rows.length === 2 && rows[1].source === 'rail', 'a lone flown vessel still lists rail objects beside it'); }
ok(loadRows({ vessels: null, sats: [] }).length === 0, 'empty inputs stay empty');

const chips = chipsFor(crowded, 'earth');
ok(chips[0].id === 'all' && chips[0].n === 14, 'All counts every craft');
ok(chips.some(c => c.id === 'flying' && c.n === 1), 'Flying chip when one craft is flown');
ok(chips.some(c => c.id === 'here' && c.n === 13), 'Here chip when craft orbit more than one body');
ok(chips.some(c => c.id === 'Satellite' && c.n === 12), 'the biggest class gets a chip');
ok(chips.length <= 6, 'chips stay on one short row', chips.map(c => c.id).join(','));

ok(filterRows(crowded, { chip: 'here', here: 'earth' }).length === 13, 'Here drops the Moon probe');
ok(filterRows(crowded, { chip: 'flying' }).length === 1, 'Flying keeps the active craft');
ok(filterRows(crowded, { chip: 'Satellite' }).length === 12, 'a class chip keeps that class');
{ const hit = filterRows(crowded, { q: '#7' }); ok(hit.length === 1 && hit[0].id === 's7', 'a search finds one craft in the batch'); }
ok(filterRows(crowded, { q: 'zzz' }).length === 0, 'a search that misses shows nothing');

{ const closed = renderSheet(crowded, { q: '', chip: 'all', here: 'earth', force: {}, focusKey: null, open: false });
  const big = closed.sections.flatMap(s => s.groups).find(g => g.n >= 12);
  ok(big && !big.open && big.label === 'Constellation sat', '12 sats collapse to one family group', big && big.label);
  ok(!closed.html.includes('#7') && /Constellation sat · 12/.test(closed.html), 'the closed sheet does not print every name');
  ok((closed.html.match(/class="mtRow/g) || []).length === 2, 'only the stage and the probe stay listed while the batch is closed');
  ok(closed.html.includes('Tracking · 14') && closed.html.includes('▾'), 'the pill title counts every craft'); }
{ const opened = renderSheet(crowded, { q: '', chip: 'all', here: 'earth', force: {}, focusKey: 's7', open: true });
  ok(opened.html.includes('Constellation sat #7 of 12') && opened.html.includes('▴'), 'focusing a sat opens its group and the sheet');
  ok(opened.html.includes('data-act="fly" data-id="s7"'), 'Fly is offered on a craft you are not flying');
  ok(!opened.html.includes('data-act="fly" data-id="stage"') && opened.html.includes('Flying'), 'the flown craft has no Fly button'); }
{ const found = renderSheet(crowded, { q: '#7', chip: 'all', here: 'earth', force: {}, focusKey: null, open: true });
  ok((found.html.match(/class="mtRow/g) || []).length === 1 && found.html.includes('#7'), 'search results are a single row'); }
{ const moon = renderSheet(crowded, { q: '', chip: 'here', here: 'earth', force: {}, focusKey: null, open: true });
  ok(!moon.html.includes('Science probe') && moon.html.includes('Spent stage'), 'the Here chip hides other bodies'); }
ok(cycleId(crowded, 's12', 1) === 'stage', 'next craft walks the filtered order');
ok(cycleId(crowded, 'probe', 1) === 's1', 'next craft wraps');
ok(cycleId(crowded, null, -1) === 'probe', 'previous from nothing starts at the end');
{ const g = groupRows(crowded.slice(0, 5), { here: 'earth', force: {}, focusKey: null });
  ok(g[0].groups.every(x => x.open), 'five craft stay expanded'); }
{ const nasty = renderSheet([{ id: 'x', name: '<b>alert</b>', cls: 'Probe', body: 'earth', alt: 1000, active: false, canFly: true }], { open: true, force: {}, focusKey: null });
  ok(!nasty.html.includes('<b>alert</b>') && nasty.html.includes('&lt;b&gt;'), 'craft names are escaped'); }

console.log(fail ? `tracksheet: ${fail} FAIL` : `tracksheet: ${pass} ok`);
process.exit(fail ? 1 : 0);

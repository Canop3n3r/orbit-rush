// f5.2 (QA f5.1h): mission/rung card defaults and the picker (no duplicates, 1-word sections, locked folded)
import { cardChoice, qualifying } from '../fun/mispick.js?v=f5.3b5';
import { pickerHTML, HOUSES } from '../fun/picker.js?v=f5.3b5';
import { SHOWROOM } from '../fun/showroom.js?v=f5.3b5';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fail++; console.log('FAIL', m); } };
for (const id of ['orbit', 'moon', 'mars', 'venus']) { const q = qualifying(id, SHOWROOM, []);
  const pip = cardChoice(q, { name: 'Pip', ok: true, sub: true });
  ok(pip.sel === q[0].key && /Pip can’t reach orbit; using /.test(pip.note) && pip.list.some(r => r.mine), `${id}: Pip → ${q[0].name} preselected, note "${pip.note}", Pip still listed`);
  const own = cardChoice(q, { name: q[0].name, ok: true });
  ok(own.sel === 'mine' && !own.note, `${id}: a qualifying rocket stays selected`); }
const hop = cardChoice(qualifying('hop', SHOWROOM, []), { name: 'Grasshopper', ok: true }, false); ok(hop.sel === 'mine', 'hop: own Grasshopper kept');
const sets = { spacey: ['a', 'b', 'c'], arion: ['d', 'e'] }, names = { a: 'Heron', b: 'Heron Heavy', c: 'Other', d: 'D', e: 'E' };
const html = pickerHTML({ originals: [{ i: 0, name: 'Heron', role: 'x' }, { i: 1, name: 'Heron Heavy', role: 'y' }], sets, name: id => names[id], locked: id => id === 'e' || id === 'c' });
ok(!/data-m="a"|data-m="b"/.test(html), 'picker: rockets already in Originals are not repeated');
ok([...html.matchAll(/<h4>([^<]*)<\/h4>/g)].every(m => m[1].trim().split(/\s+/).length === 1), 'picker: one-word section names');
ok(/🔒 1 more locked/.test(html) && (html.match(/🔒 1 more locked/g) || []).length === 2, 'picker: locked cards fold into "N more locked" per section');
ok(HOUSES.length > 20, 'picker: houses present');
{ const q = qualifying('mars', SHOWROOM, [{ key: 'h:z', name: 'Zed', base: 'ares', model: 'z' }]); const lk = r => r.base === 'ares' && r.model !== 'z';
  const c = cardChoice(q, { name: 'Pip', ok: true, sub: true }, true, lk); ok(c.sel === 'h:z' && !c.list.some(r => r.base === 'ares' && r.model !== 'z'), 'locked rockets are never recommended; best unlocked qualifier picked');
  const c2 = cardChoice(q, { name: 'Pip', ok: true, sub: true }, true, () => true); ok(c2.sel === 'mine' && /unlocks/.test(c2.note), 'nothing unlocked qualifies: keep yours, say what unlocks'); }
import * as L from '../fun/ladder.js?v=f5.2';
{ const s = L.blank(); ok(L.isUnlocked(s, 'vehicles', 'needle'), 'fresh: first rung rocket unlocked'); for (const c of L.LADDER) { if (c.id === 'moon') break; s.done[c.id] = 1; }
  ok(L.isUnlocked(s, 'vehicles', 'selene'), 'reaching the Moon rung unlocks Selene'); ok(!L.isUnlocked(L.blank(), 'vehicles', 'ares'), 'fresh: Red Arrow still locked'); }
console.log(`card: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

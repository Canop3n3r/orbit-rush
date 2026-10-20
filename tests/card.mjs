// f5.2 (QA f5.1h): mission/rung card defaults and the picker (no duplicates, 1-word sections, locked folded)
import { cardChoice, qualifying } from '../fun/mispick.js?v=f5.2.1';
import { pickerHTML, HOUSES } from '../fun/picker.js?v=f5.2.1';
import { SHOWROOM } from '../fun/showroom.js?v=f5.2.1';
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
console.log(`card: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

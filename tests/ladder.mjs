import * as L from '../fun/ladder.js';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : (fail++, console.log('FAIL', m)); };
const mem = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)) }; };
const st = mem(); let s = L.load(st);
ok(L.next(s).id === 'hop', 'starts at hop'); ok(!L.isUnlocked(s, 'vehicles', 'swift'), 'F9 locked'); ok(L.isUnlocked(s, 'vehicles', 'swift', true), 'sandbox unlocks');
let o = L.record(s, { maxAlt: 5000 }); ok(o.earned.length === 0, 'low hop earns nothing');
o = L.record(s, { maxAlt: 200000, space: true, orbit: true }); ok(o.earned.map(c => c.id).join() === 'hop,karman,orbit', 'orbit earns 3 rungs');
ok(o.cash === 70 && o.sci === 22, 'rewards summed'); ok(L.isUnlocked(s, 'vehicles', 'swift'), 'F9 unlocked'); ok(o.next.id === 'booster', 'next booster');
o = L.record(s, { orbit: true, op: 'crew-dock', opOk: true }); ok(o.earned.length === 0, 'out of order rung not earned');
o = L.record(s, { boosterLanded: true, vehicle: 'swift', op: 'constellation-batch', opOk: true }); ok(o.earned.map(c => c.id).join() === 'booster,constellation-batch', 'booster + constellation');
L.save(st, s); const s2 = L.load(st); ok(s2.cash === s.cash && s2.done['constellation-batch'], 'persisted'); ok(L.isUnlocked(s2, 'vehicles', 'heron'), 'crew unlocked');
st.setItem(L.KEY, '{bad'); ok(L.load(st).cash === 0, 'corrupt -> blank');
ok(L.LADDER.every(c => L.ALL.vehicles.includes(c.vehicle)), 'vehicles known');
for (const c of L.LADDER) for (const k in c.unlock) for (const id of c.unlock[k]) ok(L.ALL[k].includes(id), 'unlock known ' + id);
ok(L.ALL.vehicles.every(v => L.START.vehicles.includes(v) || L.unlockedBy('vehicles', v)), 'every vehicle unlockable');
// v1 -> v2 save migration (old ids built from ROT13 so this file stays neutral)
{ const r13 = t => t.replace(/[a-z]/g, ch => String.fromCharCode(97 + (ch.charCodeAt(0) - 84) % 26)), OLD = { c: r13('fgneyvax'), i: r13('vff'), a: r13('fyp40'), b: r13('yp39n'), d: r13('fgneonfr') };
  const m = mem(); m.setItem(L.KEY, JSON.stringify({ v: 1, cash: 300, sci: 50, flights: 7, done: { hop: 1, karman: 2, orbit: 3, booster: 4, [OLD.c]: 5, [OLD.i]: 6 },
    unlocked: { vehicles: ['pip', 'swift', 'heron'], sites: ['atoll', OLD.a, 'lz1', OLD.b, OLD.d], parts: ['ion'], missions: ['hop', 'constellation-batch', 'crew-dock'] }, last: { t: 6, earned: [OLD.i] } }));
  const g = L.load(m); ok(g.v === L.VERSION && g.cash === 300 && g.done['constellation-batch'] === 5 && g.done['crew-dock'] === 6 && !(OLD.c in g.done) && !(OLD.i in g.done), 'migration: rung ids renamed, done times kept');
  ok(['cape-north', 'cape-heritage', 'gulf-port'].every(x => g.unlocked.sites.includes(x)) && ![OLD.a, OLD.b, OLD.d].some(x => g.unlocked.sites.includes(x)), 'migration: site unlocks renamed');
  ok(g.last.earned[0] === 'crew-dock' && L.next(g).id === 'heavy' && L.isUnlocked(g, 'sites', 'cape-heritage'), 'migration: last/next/isUnlocked use new ids');
  ok(JSON.stringify(L.migrate(L.migrate(JSON.parse(m.getItem(L.KEY))))) === JSON.stringify(L.migrate(JSON.parse(m.getItem(L.KEY)))), 'migration is idempotent');
  ok(L.LADDER.every(c => !Object.values(OLD).includes(c.id)) && L.ALL.sites.every(x => !Object.values(OLD).includes(x)), 'no old ids left in the ladder'); }
// placeholder vehicles: moon / mars / venus rungs stay locked until the models land
{ ok(Object.keys(L.PLACEHOLDER_VEHICLES).length === 0 && !L.LADDER.some(L.rungLocked), 'f5.1h: no placeholder vehicles; moon, mars, venus rungs open');
  const s3 = L.blank(); for (const c of L.LADDER) if (!['moon', 'mars', 'venus'].includes(c.id)) s3.done[c.id] = 1;
  const o3 = L.record(s3, { landed: 'moon', visited: ['moon', 'mars', 'venus'], vehicle: 'selene' }); ok(s3.done.moon && s3.done.mars && s3.done.venus, 'moon, mars, venus rungs can be earned'); }
{ // f5: the old showroom id still loads (save alias)
  const { migrate } = await import('../fun/ladder.js?v=f5.1e'); const r13 = t => t.replace(/[a-z]/g, ch => String.fromCharCode(97 + (ch.charCodeAt(0) - 84) % 26));
  const m = migrate({ v: 2, done: {}, unlocked: { vehicles: ['pip', r13('xrfgery')] } });
  if (m.unlocked.vehicles.includes('swift') && m.unlocked.vehicles.length === 2) { pass++; console.log('ok vehicle alias migrates'); } else { fail++; console.log('FAIL vehicle alias'); }
}
{ // f5.1e: a missed mission pays $0
  const s = L.blank(); const o = L.record(s, { maxAlt: 3e5, space: true, orbit: true, visited: ['earth', 'venus'], missed: true });
  if (o.cash === 0 && o.earned.length === 0 && s.cash === 0) { pass++; console.log('ok miss pays $0'); } else { fail++; console.log('FAIL miss pays'); }
}
{ // f5.1f: Next after Mars/Venus never drops back to an old skipped rung
  const s = L.blank(); for (const c of L.LADDER) if (c.id !== 'booster' && c.id !== 'venus') s.done[c.id] = 1;
  const a = L.nextAfter(s, 'mars'), b = L.nextAfter({ ...s, done: { ...s.done, venus: 1 } }, 'venus');
  if (a && a.id === 'venus' && b === null && L.next(s).id === 'booster') { pass++; console.log('ok nextAfter'); } else { fail++; console.log('FAIL nextAfter', a && a.id, b); }
}
console.log(`ladder: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);

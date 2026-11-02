// f5.9-18: bug reporter pure parts (queue, config, flush, shake detector)
import { DEFAULT_CFG, supaSend, supaRow, shotBytes, loadCfg, loadQueue, saveQueue, makeReport, flushQueue, shakeDetector, QMAX, CKEY, QKEY } from '../fun/bugreport.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const mem = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
globalThis.innerWidth = 390; globalThis.innerHeight = 844; globalThis.devicePixelRatio = 3;
{ const ls = mem(); ok(loadCfg(ls, null) === null, 'no cfg, no default → null'); ok(loadCfg(ls) === DEFAULT_CFG && DEFAULT_CFG.kind === 'supabase' && /^https:/.test(DEFAULT_CFG.url) && /^sb_publishable_/.test(DEFAULT_CFG.key), 'default = Supabase with the publishable key only');
  ls.setItem(CKEY, JSON.stringify({ url: 'http://evil.example/x' })); ok(loadCfg(ls, null) === null, 'plain http (non-localhost) refused');
  ls.setItem(CKEY, JSON.stringify({ url: 'https://x.example/rest/v1/bug_reports', headers: { apikey: 'pub' } })); const c = loadCfg(ls); ok(c && c.headers.apikey === 'pub', 'https cfg with headers');
  ls.setItem(CKEY, '{bad'); ok(loadCfg(ls, null) === null, 'bad JSON → null'); }
{ const ls = mem(); for (let i = 0; i < QMAX + 4; i++) { const q = loadQueue(ls); q.push({ id: i }); saveQueue(q, ls); } const q = loadQueue(ls); ok(q.length === QMAX && q[0].id === 4, `queue capped at ${QMAX}, oldest dropped`); }
{ let n = 0; const ls = { getItem: () => null, setItem: (k, v) => { if (v.length > 30) throw new Error('quota'); n++; } }; const kept = saveQueue([{ a: 'x'.repeat(50) }, { b: 1 }], ls); ok(kept === 1, 'quota → keeps what fits'); }
{ const r = makeReport({ note: 'n'.repeat(3000), build: 'f5.9-18', state: { rocket: 'R' }, shot: 'data:x', now: 0, ua: 'UA' }); ok(r.note.length === 2000 && r.build === 'f5.9-18' && r.viewport.w === 390 && r.viewport.dpr === 3 && r.state.rocket === 'R' && r.t === '1970-01-01T00:00:00.000Z', 'report fields'); }
{ const ls = mem(); saveQueue([{ id: 'a' }, { id: 'b' }, { id: 'c' }], ls); const seen = []; let k = 0;
  const f = async (u, o) => { seen.push(JSON.parse(o.body).id); ok(o.headers.apikey === 'pub' && o.headers['content-type'] === 'application/json', 'headers sent'); return { ok: ++k < 3, status: k < 3 ? 201 : 500 }; };
  const r = await flushQueue({ cfg: { url: 'https://x', headers: { apikey: 'pub' } }, ls, fetchFn: f }); ok(r.sent === 2 && r.left === 1 && loadQueue(ls)[0].id === 'c', 'flush stops at the first failure, keeps the rest');
  const r2 = await flushQueue({ cfg: null, ls, fetchFn: f }); ok(r2.sent === 0 && r2.left === 1, 'no cfg → nothing sent'); }
{ let s = 0; const d = shakeDetector(() => s++); d(0, 0, 9.8, 0); d(30, 0, 0, 100); d(30, 0, 0, 300); ok(s === 0, 'two jolts not a shake'); d(0, 30, 0, 500); ok(s === 1, 'three jolts in 1.2 s = shake'); d(30, 0, 0, 600); d(30, 0, 0, 700); d(30, 0, 0, 800); ok(s === 1, 'cool-down'); d(30, 0, 0, 4000); d(30, 0, 0, 4100); d(30, 0, 0, 5500); ok(s === 1, 'jolts spread over > 1.2 s not a shake'); }
{ const calls = []; const f = async (u, o) => { calls.push({ u, o }); return { ok: true, status: 201 }; };
  const png = 'data:image/jpeg;base64,' + Buffer.from('hello').toString('base64'); ok(shotBytes(png).bytes.length === 5 && shotBytes(png).ext === 'jpg' && shotBytes('data:text/html;base64,aa') === null, 'shotBytes: images only');
  await supaSend({ url: 'https://p.supabase.co', key: 'sb_publishable_x' }, { id: 'i', t: 'T', ua: 'U', note: 'n', build: 'b', viewport: { w: 1 }, state: { rocket: 'R' }, shot: png }, f);
  ok(calls.length === 2 && /\/storage\/v1\/object\/bug-shots\/[0-9a-f-]{36}\.jpg$/.test(calls[0].u) && calls[0].o.headers['content-type'] === 'image/jpeg', 'shot uploaded to bug-shots/<uuid>.jpg');
  const row = JSON.parse(calls[1].o.body); ok(/\/rest\/v1\/bug_reports$/.test(calls[1].u) && calls[1].o.headers.Prefer === 'return=minimal' && calls[1].o.headers.apikey === 'sb_publishable_x' && !calls[1].o.headers.Authorization, 'row inserted with return=minimal, apikey only');
  ok(row.message === 'n' && row.build === 'b' && row.viewport.w === 1 && row.state.rocket === 'R' && row.state.ua === 'U' && row.screenshot_path === calls[0].u.split('/').pop() && Object.keys(row).sort().join() === 'build,message,screenshot_path,state,viewport', 'row columns');
  calls.length = 0; await supaSend({ url: 'https://p', key: 'k' }, { note: 'x', shot: null }, f); ok(calls.length === 1 && JSON.parse(calls[0].o.body).screenshot_path === null, 'no shot → row only');
  let threw = false; try { await supaSend({ url: 'https://p', key: 'k' }, { note: 'x' }, async () => ({ ok: false, status: 401 })); } catch (e) { threw = true; } ok(threw, 'refused insert throws (report stays queued)'); }
console.log(`bugreport: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

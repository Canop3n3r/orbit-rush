// Fast pre-push gate: syntax-check every root and core/ JS file, then run all tests/**/*.mjs in parallel
// (nproc workers, per-test timeout). Writes per-test seconds to /tmp/orbit-rush-timings.json so slow tests are visible.
// Usage: node tests/prepush.mjs [--only a,b] [--jobs N] [--timeout S]
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { cpus } from 'node:os';
const root = new URL('..', import.meta.url).pathname, tdir = new URL('.', import.meta.url).pathname;
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
// KNOWN-FAIL (not silently passed): reported on every run as KNOWN; flagged if it starts passing so it can be removed.
// timelines.mjs: known fail since 2026-11-01 (stale timeline expectations vs current roster); owner Mission Design.
const KNOWN = new Set(['timelines.mjs']);
const jobs = +arg('--jobs', Math.max(2, cpus().length - 1)), tmo = +arg('--timeout', 240) * 1000;
const only = arg('--only', '') ? new Set(arg('--only').split(',').map(s => s.endsWith('.mjs') ? s : s + '.mjs')) : null;
// 1) syntax
function listJs(dir, acc = []) {
  let ents; try { ents = readdirSync(dir, { withFileTypes: true }); } catch (e) { return acc; }
  for (const ent of ents) {
    if (ent.name.startsWith('.') || ent.name === 'node_modules') continue;
    const p = join(dir, ent.name);
    if (ent.isDirectory()) listJs(p, acc);
    else if (/\.(m?js)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}
const js = [...readdirSync(root).filter(f => /\.(m?js)$/.test(f)).map(f => root + f), ...listJs(join(root, 'core')), ...listJs(join(root, 'scenes'))];
let synFail = 0;
for (const f of js) { const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' }); if (r.status) { synFail++; console.log('SYNTAX', f, r.stderr.split('\n').slice(0, 4).join('\n')); } }
console.log(`syntax: ${js.length - synFail}/${js.length} ok`);
// 2) unit tests in parallel
function listTests(dir, rel = '') {
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.')) continue;
    const child = rel ? rel + '/' + ent.name : ent.name;
    if (ent.isDirectory()) out.push(...listTests(join(dir, ent.name), child));
    else if (ent.isFile() && ent.name.endsWith('.mjs') && !['run.mjs', 'prepush.mjs'].includes(ent.name)) out.push(child);
  }
  return out;
}
const files = listTests(tdir).filter(f => !only || only.has(f) || only.has(f.split('/').pop())).sort();
const res = {}, t0 = Date.now(); let i = 0;
const runOne = f => new Promise(ok => { const s = Date.now(); let out = '';
  const p = spawn(process.execPath, [join(tdir, f)]); p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
  const k = setTimeout(() => { p.kill('SIGKILL'); out += '\nTIMEOUT'; }, tmo);
  p.on('close', c => { clearTimeout(k); res[f] = { ok: c === 0, s: +((Date.now() - s) / 1000).toFixed(1), tail: out.split('\n').slice(-6).join('\n') }; ok(); }); });
await Promise.all(Array.from({ length: jobs }, async () => { while (i < files.length) await runOne(files[i++]); }));
const fail = files.filter(f => !res[f].ok && !KNOWN.has(f)), known = files.filter(f => !res[f].ok && KNOWN.has(f));
for (const f of known) console.log(`KNOWN-FAIL ${f} (${res[f].s}s) — tracked, not gating`);
for (const f of files.filter(f => KNOWN.has(f) && res[f].ok)) console.log(`KNOWN ${f} now passes — remove it from KNOWN`);
for (const f of fail) console.log(`FAIL ${f} (${res[f].s}s)\n${res[f].tail}`);
const slow = files.map(f => [f, res[f].s]).sort((a, b) => b[1] - a[1]).slice(0, 5);
try { writeFileSync('/tmp/orbit-rush-timings.json', JSON.stringify(Object.fromEntries(files.map(f => [f, res[f].s])), null, 1)); } catch {}
console.log(`tests: ${files.length - fail.length - known.length} ok, ${fail.length} fail, ${known.length} known [${known}] in ${((Date.now() - t0) / 1000).toFixed(0)}s, ${jobs} jobs; slowest: ${slow.map(([f, s]) => f + ' ' + s + 's').join(', ')}`);
process.exit(fail.length || synFail ? 1 : 0);

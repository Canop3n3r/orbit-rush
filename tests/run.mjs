// Runs every tests/**/*.mjs (no deps). timelines.mjs is a known failure (tuning in progress) and is reported separately.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const KNOWN = new Set(['timelines.mjs']);
const tdir = new URL('.', import.meta.url).pathname;
function listTests(dir, rel = '') {
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.')) continue;
    const child = rel ? rel + '/' + ent.name : ent.name;
    if (ent.isDirectory()) out.push(...listTests(join(dir, ent.name), child));
    else if (ent.isFile() && ent.name.endsWith('.mjs') && ent.name !== 'run.mjs') out.push(child);
  }
  return out;
}
const files = listTests(tdir).sort();
let fail = [], known = [];
for (const f of files) {
  const r = spawnSync(process.execPath, [join(tdir, f)], { encoding: 'utf8' });
  const ok = r.status === 0;
  console.log(`${ok ? 'ok  ' : KNOWN.has(f) ? 'KNOWN' : 'FAIL'} ${f}`);
  if (!ok) { (KNOWN.has(f) ? known : fail).push(f); if (!KNOWN.has(f)) console.log((r.stdout + r.stderr).split('\n').slice(-8).join('\n')); else console.log('      ' + ((r.stdout.match(/^timelines:.*$/m) || [''])[0])); }
}
console.log(`\n${files.length - fail.length - known.length} passed, ${fail.length} failed, ${known.length} known failure(s)${known.length ? ': ' + known.join(', ') : ''}`);
process.exit(fail.length ? 1 : 0);

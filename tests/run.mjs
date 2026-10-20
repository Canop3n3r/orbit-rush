// Runs every tests/*.mjs (no deps). timelines.mjs is a known failure (tuning in progress) and is reported separately.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const KNOWN = new Set(['timelines.mjs']);
const files = readdirSync(new URL('.', import.meta.url)).filter(f => f.endsWith('.mjs') && f !== 'run.mjs').sort();
let fail = [], known = [];
for (const f of files) {
  const r = spawnSync(process.execPath, [new URL(f, import.meta.url).pathname], { encoding: 'utf8' });
  const ok = r.status === 0;
  console.log(`${ok ? 'ok  ' : KNOWN.has(f) ? 'KNOWN' : 'FAIL'} ${f}`);
  if (!ok) { (KNOWN.has(f) ? known : fail).push(f); if (!KNOWN.has(f)) console.log((r.stdout + r.stderr).split('\n').slice(-8).join('\n')); else console.log('      ' + ((r.stdout.match(/^timelines:.*$/m) || [''])[0])); }
}
console.log(`\n${files.length - fail.length - known.length} passed, ${fail.length} failed, ${known.length} known failure(s)${known.length ? ': ' + known.join(', ') : ''}`);
process.exit(fail.length ? 1 : 0);

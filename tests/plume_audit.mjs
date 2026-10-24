// plans/PLUME_AUDIT.md is generated (tools/plume_audit.mjs) from nozzles.js + the roster: fails when stale; every model has a row.
import { execFileSync } from 'child_process'; import fs from 'fs'; import { NOZZLES } from '../gfx/vehicles/nozzles.js';
import { fileURLToPath } from 'url'; const root = fileURLToPath(new URL('..', import.meta.url));
let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
let out = ''; try { out = execFileSync('node', ['tools/plume_audit.mjs', '--check'], { cwd: root }).toString(); } catch (e) { out = 'STALE'; }
ok(/up to date/.test(out), 'plans/PLUME_AUDIT.md is up to date (run: node tools/plume_audit.mjs)');
const md = fs.readFileSync(root + 'plans/PLUME_AUDIT.md', 'utf8'); const miss = Object.keys(NOZZLES).filter(id => !/^(catch-tower|payload-)/.test(id) && !md.includes('| ' + id + ' |'));
ok(miss.length === 0, 'every rocket has an audit row' + (miss.length ? ': ' + miss.join(',') : ''));
ok(Object.values(NOZZLES).some(o => Object.values(o).some(l => l.length > 30)), 'nozzle data includes the big clusters');
process.exit(bad ? 1 : 0);

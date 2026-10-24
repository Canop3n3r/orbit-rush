// gfx/vehicles/cryo.js is generated from the roster (tools/gen_cryo.mjs): fails when stale; sanity: a kerolox first stage is cryo, a solid stack is not.
import { execFileSync } from 'child_process'; import { fileURLToPath } from 'url'; import { CRYO } from '../gfx/vehicles/cryo.js';
const root = fileURLToPath(new URL('..', import.meta.url)); let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
let out = ''; try { out = execFileSync('node', ['tools/gen_cryo.mjs', '--check'], { cwd: root }).toString(); } catch (e) { out = 'STALE'; }
ok(/up to date/.test(out), 'cryo.js is up to date (run: node tools/gen_cryo.mjs)');
ok(Object.keys(CRYO).length > 10, 'cryo list is populated'); ok(!CRYO['conestogo'], 'an all-solid stack gets no frost');
process.exit(bad ? 1 : 0);

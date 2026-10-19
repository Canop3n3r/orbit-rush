// Touch wording: every hint/toast/lesson string in flight.js and academy.js, rewritten for touch, names no
// keyboard key; desktop wording is unchanged; Academy keycaps all have touch labels. (Layout/overlap and the
// touch-only flight are covered by the headless browser smoke, /tmp/mob.cjs in the handoff note.)
import { readFileSync } from 'node:fs';
import { localize, KEY_LEAK, KEY_TOUCH, keyLabel } from '../wording.js?v=f1u';
import { LESSONS } from '../academy.js?v=f1u';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const lits = f => [...readFileSync(new URL('../' + f, import.meta.url), 'utf8').matchAll(/'([^'\n]{6,})'|`([^`\n]{6,})`/g)].map(m => m[1] || m[2]);
const keyish = /\(([A-Z])\)|Shift|Ctrl|SPACE|Space (twice|again)|\b[Pp]ress [A-Z]\b|hold [WASDQE] |\bW\/S/;
let n = 0;
for (const f of ['flight.js', 'academy.js']) for (const s of lits(f)) {
  if (!keyish.test(s) || /^\s*(Space|Shift|Ctrl)\s*$/.test(s) || /officially|SPACE!/.test(s)) continue; n++;
  const t = localize(s, true); ok(!KEY_LEAK.test(t), `${f}: "${s}" → "${t}"`); ok(localize(s, false) === s, 'desktop unchanged: ' + s);
}
ok(n > 30, 'scanned key strings: ' + n);
// lesson step texts rendered from live functions too (sample with a stub context where they are strings)
for (const L of LESSONS) for (const st of L.steps) { if (typeof st.text === 'string') ok(!KEY_LEAK.test(localize(st.text, true)), `${L.id}: ${st.text}`); for (const k of st.keys || []) ok(keyLabel(k, true) !== k || /^(STAGE|AUTO)$/.test(k), `keycap ${k} has a touch label`); }
ok(localize('HIGH Q — throttle down (Ctrl)', true) === 'HIGH Q — throttle down (slide THR down)', 'high-Q wording');
ok(!/HIGH Q — throttle down \(S\)/.test(readFileSync(new URL('../flight.js', import.meta.url), 'utf8')), 'duplicate HIGH Q toast removed (one hint system)');
ok(localize('🌌 SPACE! Kármán line (100 km) +1000', true).includes('SPACE!'), 'space the place is not a key');
ok(Object.keys(KEY_TOUCH).length >= 20, 'keycap table');
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

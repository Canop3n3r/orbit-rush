// f2 leftovers: whole-phrase hints (no "…", ≤ 2 lines). Run: node tests/f2.mjs
import { readFileSync } from 'fs';
import { shortHint, HINT_MAX } from '../fun/compact.js?v=f5.1c';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fail++; console.log('  ✘', m); } };
const src = readFileSync(new URL('../flight.js', import.meta.url), 'utf8'), i0 = src.indexOf('hint('), body = src.slice(i0, i0 + 30000);
const lits = [...body.matchAll(/(['`])((?:(?!\1)[^\\\n]){24,})\1/g)].map(m => m[2].replace(/\$\{[^}]*\}/g, '12.3'));
const extra = ['AUTO on: gravity turn, Max-Q throttling, coast to apoapsis and circularize, then the director takes the next leg for you',
  'Press SPACE to light the engines — then hold W/S to pitch (or tap AUTO) and watch the navball', 'Landing burn in T−12.3 s; keep the retrograde marker in the reticle'];
const all = [...new Set([...lits, ...extra])];
ok(all.length >= 10, `collected ${all.length} hint strings from flight.js + samples`);
let bad = [];
for (const h of all) { const t = shortHint(h), norm = h.replace(/\s+/g, ' ').trim();
  if (t.includes('…') || t.length > HINT_MAX || !t.length || !norm.startsWith(t) || (norm.length > t.length && /\w/.test(norm[t.length]) && /\w/.test(t[t.length - 1]))) bad.push(h + ' → ' + t); }
ok(!bad.length, 'every hint becomes a whole phrase: no ellipsis, ≤ ' + HINT_MAX + ' chars, cut on a word boundary' + (bad.length ? '\n' + bad.slice(0, 5).join('\n') : ''));
ok(shortHint(extra[0]).startsWith('AUTO on: gravity turn, Max-Q throttling') && shortHint(extra[0]).length <= HINT_MAX, 'long AUTO hint keeps its leading clauses');
ok(shortHint('Stage now') === 'Stage now' && shortHint('') === '', 'short hints pass through');
console.log(`f2: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

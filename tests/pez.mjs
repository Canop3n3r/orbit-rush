// legs-fins-1: the big ship's slot deploy: door opens, satellites leave one at a time sideways, the stack steps down, door closes
import { pezState, PEZ } from '../gfx/vehicles/pez.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const n = 4, S = Array.from({ length: 201 }, (_, i) => ({ k: i / 200, ...pezState(i / 200, n) }));
ok(S[0].door === 0 && S[0].out.every(x => x === 0), 'closed and stowed at the start');
ok(S.find(s => s.k >= PEZ.open).door === 1, 'door fully open before the first satellite moves');
ok(S.filter(s => s.k < PEZ.open).every(s => s.out.every(x => x === 0)), 'nothing leaves while the door opens');
for (let i = 0; i < n; i++) { const t0 = S.find(s => s.out[i] > 0).k, t1 = S.find(s => s.out[i] >= 1).k; ok(t1 > t0, `sat ${i} slides out over time`);
  if (i) { const prev = S.find(s => s.out[i - 1] >= 1).k; ok(t0 >= prev, `sat ${i} starts only after sat ${i - 1} is out (one at a time)`); } }
ok(S.every(s => s.out.filter(x => x > 0 && x < 1).length <= 1), 'never two satellites in the slot at once');
ok(Math.abs(S[200].door) < 1e-9 && S[200].out.every(x => x === 1), 'door closed at the end, every satellite out');
ok(Math.abs(S[200].drop[3] - 3) < 1e-9 && S[200].drop[0] === 0, 'the stack stepped down one slot per departed satellite');
ok(S.every(s => s.out.every((x, i) => i === 0 || x <= s.out[i - 1] + 1e-12)), 'bottom satellite first');
console.log(`pez: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

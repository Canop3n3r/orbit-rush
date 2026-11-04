// legs-fins-1: Colossus ship flaps hinge flush to the hull (hinge line < 2 cm from the hull surface) and have real shapes;
// the slot-dispenser payload sits fully inside the hull radius until the deploy starts.
import { FLAP_SHAPE, FLAP_ROOT, shipHullR, flapHinge, hingeLine } from '../gfx/vehicles/flapgeom.js';
import { pezInZ, pezReach, pezState } from '../gfx/vehicles/pez.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const r = 4.5, nose = 16, L = 52.1, cyl = L - nose - 2;
for (const y0 of [-20, 0, 37]) { const ship = { r, yN: y0 + 2 + cyl, L: nose };
  for (const [kind, yb] of [['a', y0 + 1.5], ['f', y0 + 2 + cyl + 3.2]]) { const h = FLAP_ROOT[kind];
    for (const side of [-1, 1]) { let worst = 0; for (const [x, y] of hingeLine(yb, h, ship, side, 40)) worst = Math.max(worst, Math.abs(Math.abs(x) - shipHullR(y, ship)));
      ok(worst < 0.02, `${kind} side ${side} y0 ${y0}: hinge ${(worst * 100).toFixed(2)} cm off the hull`); }
    // flush at every angle: the hinge line is the rotation axis, so it does not move as the flap swings 0..90 deg; the root edge is on it
    ok(FLAP_SHAPE[kind][0][0] === 0 && FLAP_SHAPE[kind].at(-1)[0] === 0, `${kind} root edge on the hinge line`); } }
const span = (s, y) => { let m = 0, lo = 1e9; for (let i = 0; i < s.length; i++) { const [a, b] = [s[i], s[(i + 1) % s.length]]; if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) { const x = a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]); m = Math.max(m, x); lo = Math.min(lo, x); } } return m - lo; }; // chord width at height y
const F = FLAP_SHAPE.f, A = FLAP_SHAPE.a, hf = Math.max(...F.map(p => p[1])), ha = Math.max(...A.map(p => p[1]));
ok(span(F, hf * 0.85) / span(F, hf * 0.1) < 0.6, 'forward flap tapers'); ok(span(A, ha * 0.85) / span(A, ha * 0.1) > 0.95, 'aft flap squared off');
ok(hf < ha * 0.7 && Math.max(...F.map(p => p[0])) < Math.max(...A.map(p => p[0])), 'forward smaller than aft');
// payload inside before deploy
for (const w of [1.2, 2.0, 2.2]) { const z = pezInZ(r, w); ok(pezReach(z, w) < r, `sat w ${w}: reach ${pezReach(z, w).toFixed(2)} < hull ${r}`); }
const s0 = pezState(0, 4); ok(s0.door === 0 && s0.out.every(o => o === 0), 'door shut and every sat stowed at k=0');
console.log(`flap_flush: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);

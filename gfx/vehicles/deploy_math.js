// logos-deploy-1: deploy timing for payload appendages (pure, node-tested in tests/payload_deploy.mjs).
// k: 0 stowed .. 1 fully deployed (main.js drives it over ~4 s after the springs push the payload clear).
export const ease = e => { const x = Math.max(0, Math.min(1, e)); return x * x * (3 - 2 * x); };
export const phase = (k, a, b) => ease((k - a) / (b - a)); // 0 before a, 1 after b
export const FOLD = Math.PI * 0.985; // accordion fold between neighbouring panels (just short of flat so panels never z-fight)
// accordion wing: root hinge swings the stack out first, then each panel unfolds in turn from the root to the tip
export function wingAngles(k, n, side) { const root = -side * Math.PI / 2 * (1 - phase(k, 0, 0.3)), out = [root];
  for (let i = 1; i < n; i++) { const a = 0.22 + (i - 1) * 0.48 / Math.max(1, n - 2), s = (i % 2 ? 1 : -1) * side; out.push(s * FOLD * (1 - phase(k, a, a + 0.3))); } return out; }
// roll-out blanket: mast swings up, then the blanket unrolls from the drum (fraction 0.02 .. 1)
export const rollOut = k => ({ mast: -Math.PI / 2 * (1 - phase(k, 0, 0.25)), unroll: 0.02 + 0.98 * phase(k, 0.2, 0.95) });
// telescoping boom: fraction of full length out; hinged antenna: angle from folded
export const boomOut = k => 0.12 + 0.88 * phase(k, 0.45, 1);
export const hinge = (k, folded, a = 0.35, b = 0.8) => folded * (1 - phase(k, a, b));

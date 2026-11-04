// legs-fins-1: slot ("dispenser") deploy for ships that carry a stack of flat satellites in a payload bay: no nose or fairing opens.
// Pure schedule (node-testable): k 0..1 over the deploy -> the slot door opens, the satellites leave one at a time sideways through the slot
// (the stack drops one slot each time), then the door closes.
const ss = x => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
export const PEZ = { open: 0.1, close: 0.9 };
/** -> { door: 0..1 open, out: [0..1 per satellite, bottom first], drop: [slots each satellite has dropped] } */
export function pezState(k, n) {
  const { open, close } = PEZ, w = (close - open) / n, out = [], drop = [];
  for (let i = 0; i < n; i++) out.push(ss((k - open - i * w) / (w * 0.8)));
  for (let i = 0; i < n; i++) { let d = 0; for (let j = 0; j < i; j++) d += ss((k - open - j * w - w * 0.8) / (w * 0.2)); drop.push(d); } // the stack steps down after each one leaves
  const door = k < open ? ss(k / open) : k > close ? 1 - ss((k - close) / (1 - close)) : 1;
  return { door, out, drop };
}
/** legs-fins-1: where the stacked satellites sit before the slot opens: pushed toward the slot side but with every corner of a
 *  sat (half width w) inside 92% of the hull radius R, so nothing shows through the skin until the door opens. */
export function pezInZ(R, w, cz = 0) { return cz + Math.max(0, Math.sqrt(Math.max(0, (0.92 * R) ** 2 - w * w)) - w); }
/** max distance from the ship axis of a sat (half width w, centre z) */
export const pezReach = (z, w) => Math.hypot(w, Math.abs(z) + w);

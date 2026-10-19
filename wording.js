// One wording layer for hints, toasts and Academy steps: key names on desktop, touch-control names on phones
// and tablets. Pure (no DOM), so the tests can check that no keyboard key survives in touch wording.
const SAS_NAME = { 1: 'STABILITY', 2: 'PROGRADE', 3: 'RETROGRADE', 4: 'RADIAL OUT', 5: 'RADIAL IN', 6: 'NORMAL', 7: 'ANTI-NORMAL', 0: 'OFF' };
// single keys → the touch control that does the same thing (☰ = the overflow menu)
export const TOUCH_LABEL = { F: 'AUTO', G: '☰ ⏩ AP', O: '☰ HOME', P: 'CHUTE', M: 'MAP', V: '☰ SAS', X: 'THR 0', Z: 'THR max', C: '☰ RCS', Y: '☰ FLY BOOSTER',
  B: '☰ BOOSTER CAM', T: '☰ WARP', W: 'stick up', S: 'stick down', A: 'stick left', D: 'stick right', Q: 'ROLL left', E: 'ROLL right', U: '☰ FX', R: '☰ HANGAR' };
// Academy <kbd> keycaps
export const KEY_TOUCH = { Space: 'STAGE', Shift: 'THR ↑', Ctrl: 'THR ↓', Z: 'THR max', X: 'THR 0', W: 'STICK ↑', S: 'STICK ↓', A: 'STICK ←', D: 'STICK →', Q: 'ROLL ←', E: 'ROLL →',
  V: '☰ SAS', F: 'AUTO', P: 'CHUTE', M: 'MAP', G: '☰ ⏩ AP', O: '☰ HOME', C: '☰ RCS', 1: '☰ SAS', 2: '☰ SAS', 3: '☰ SAS', 4: '☰ SAS', 5: '☰ SAS', 6: '☰ SAS', 7: '☰ SAS', 0: '☰ SAS' };
export const keyLabel = (k, touch) => (touch ? KEY_TOUCH[k] || TOUCH_LABEL[k] || k : k);
const L = k => `⟦${TOUCH_LABEL[k] || k}⟧`;
const RULES = [
  [/\((SPACE|Space) twice\)/g, '(tap ⟦STAGE⟧ twice)'],
  [/\b([Pp])ress F for AUTO/g, (m, p) => (p === 'P' ? 'Tap' : 'tap') + ' ⟦AUTO⟧'],
  [/\b([Pp])ress (SPACE|Space) (twice|again)/g, (m, p, a, b) => (p === 'P' ? 'Tap' : 'tap') + ' ⟦STAGE⟧ ' + b],
  [/\b(SPACE|Space) (twice|again) to/g, (m, a, b) => 'tap ⟦STAGE⟧ ' + b + ' to'],
  [/\b([Pp])ress "/g, (m, p) => (p === 'P' ? 'Tap "' : 'tap "')],
  [/\bZ = full throttle/g, '⟦THR max⟧'],
  [/Shift ?\/ ?Ctrl( \(or ↑ ?\/ ?↓\))?( throttle)?/g, '⟦the THR slider⟧'],
  [/\bZ is full, X is cut/g, 'top is full, bottom is cut'],
  [/\(Ctrl or ↓\)|\(Ctrl\)/g, '(⟦slide THR down⟧)'],
  [/\(Shift\)/g, '(⟦slide THR up⟧)'],
  [/\b([Pp])ress SPACE\b/g, (m, p) => (p === 'P' ? 'Tap' : 'tap') + ' ⟦STAGE⟧'],
  [/\b(SPACE|Space) (twice|again)/g, (m, a, b) => '⟦STAGE⟧ ' + b],
  [/\((SPACE|Space)\)/g, '(⟦STAGE⟧)'],
  [/\bW\/S\/A\/D\b/g, '⟦the stick⟧'],
  [/hold W or S/g, 'push the stick up or down'], [/hold A or D/g, 'push the stick left or right'], [/hold Q or E/g, 'slide the ROLL bar'],
  [/\btap W( once)?/g, (m, o) => 'nudge the stick up' + (o || '')],
  [/\(W pitches toward the east\)/g, '(stick up pitches toward the east)'], [/\bwith W\b/g, 'with the stick (up)'],
  [/ \(and translation with I\/K J\/L H\/N\)/g, ''],
  [/\bZ\/X\/F\b/g, '⟦THR⟧ or ⟦AUTO⟧'],
  [/\bF \(AUTO\)/g, '⟦AUTO⟧'], [/\bZ \(full throttle\)/g, '⟦THR max⟧'], [/\+ Z\)/g, '+ ⟦THR max⟧)'],
  [/\(SAS (\d)\)/g, (m, d) => `(⟦☰ SAS ▸ ${SAS_NAME[d]}⟧)`],
  [/\bSAS (\d)\b/g, (m, d) => `⟦☰ SAS ▸ ${SAS_NAME[d]}⟧`],
  [/\((\d)\)/g, (m, d) => `(⟦☰ SAS ▸ ${SAS_NAME[d]}⟧)`],
  [/\(([A-Z])\)/g, (m, k) => `(${L(k)})`],
  [/\b([Pp])ress ([A-Z])\b(?![a-z])/g, (m, p, k) => (p === 'P' ? 'Tap ' : 'tap ') + L(k)],
  [/: ([A-Z])(?=[ .(]|$)/g, (m, k) => ': ' + L(k)],
  [/\b([A-Z]) = /g, (m, k) => L(k) + ' = '],
  [/\b([A-Z])\/([A-Z])\b(?= full\/cut)/g, (m, a, b) => L(a) + '/' + L(b)],
  [/\b(SPACE|Space)\b(?! officially)(?!!)/g, '⟦STAGE⟧'],
  [/\b([Pp])ress ⟦/g, (m, p) => (p === 'P' ? 'Tap ⟦' : 'tap ⟦')],
];
// Rewrite key mentions for touch; desktop text is returned unchanged.
export function localize(s, touch) {
  if (!touch || typeof s !== 'string' || !s) return s;
  for (const [re, to] of RULES) s = s.replace(re, to);
  return s.replace(/⟦|⟧/g, '');
}
// what must never appear in touch wording (the test scans every hint/step string against this)
export const KEY_LEAK = /\(([A-Z])\)|\bShift\b|\bCtrl\b|\b[Pp]ress\b|\bSPACE (twice|again)\b|\bW\/S|\bhold [WASDQE] /;

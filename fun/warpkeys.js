// Keyboard time warp. Codes match settings.js: Period is >, Comma is <, Slash is /.
// Glyphs cover the shifted US keys and the ISO < > key. quiet is for a flight that
// already took a warp from ?warp= or __cine.warp — those stay toast-free.

export function warpKeyAction(e = {}) {
  const code = e.code || '', key = e.key || '';
  if (code === 'Slash' || key === '/') return 'reset';
  if (code === 'Comma' || key === '<' || key === ',') return 'down';
  if (code === 'Period' || key === '>' || key === '.') return 'up';
  return null;
}

// One step of the shared warp ladder. limit is the current physics cap (×).
// reset always lands on the first step (×1) and drops auto-warp.
export function stepWarp(F, action, warps, opts = {}) {
  if (!F || (action !== 'up' && action !== 'down' && action !== 'reset')) return false;
  const quiet = !!opts.quiet;
  F.autoWarp = false;
  if (action === 'reset') { F.setWarp(0, quiet); return true; }
  const lim = opts.limit != null ? opts.limit : (F.warpLimit ? F.warpLimit()[0] : warps[warps.length - 1]);
  let maxI = 0;
  while (maxI + 1 < warps.length && warps[maxI + 1] <= lim + 1e-9) maxI++;
  const cur = Math.min(F.warpI | 0, maxI), n = cur + (action === 'up' ? 1 : -1);
  if (n < 0) return false;
  if (n > maxI) { if (!quiet) F.toast('Max warp ×' + lim + (opts.why ? ': ' + opts.why : ''), '#ffb35c'); return false; }
  F.setWarp(n, quiet);
  return true;
}

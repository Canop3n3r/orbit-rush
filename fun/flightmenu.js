// f5.6h (QA P1): ONE flight ☰ menu for phone and desktop. Big labelled buttons, no duplicates of the top bar
// (warp ◀◀ ▶▶ and MAP live there), booster items only while a booster flies, one Home.
export const MENU_ITEMS = [
  { k: 'Escape', l: '⏸ Pause' }, { k: 'KeyG', l: '⏩ Warp to Ap' }, { k: 'KeyP', l: '🪂 Chute' },
  { k: 'KeyY', l: '🎮 Fly booster', b: 1 }, { k: 'KeyB', l: '🎥 Booster cam', b: 1 },
  { k: 'KeyO', l: '↩ Return to pad', home: 1 }, { full: 1, l: '⛶ Full screen' }, { k: 'Backspace', l: '⛔ Abort', cls: 'abort' }, { k: 'KeyR', l: '🏠 Home' }];
export function menuHTML() { return MENU_ITEMS.map(i => `<button${i.k ? ` data-p="${i.k}"` : ''}${i.b ? ' data-b="1"' : ''}${i.home ? ' data-home="1"' : ''}${i.full ? ' data-full="1"' : ''}${i.cls ? ` class="${i.cls}"` : ''}>${i.l}</button>`).join(''); }
export const homeLabel = cancel => cancel ? '✕ Cancel return' : '↩ Return to pad';
// d: { booster: a booster is flying, ret: return-to-pad autopilot on }
export function menuUpdate(root, d) { if (!root) return; root.querySelectorAll('[data-b]').forEach(b => { b.hidden = !d.booster; }); const h = root.querySelector('[data-home]'); if (h) { const t = homeLabel(d.ret); if (h.textContent !== t) h.textContent = t; } }
export function toggleFull() { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen({ navigationUI: 'hide' }); } catch (e) { } }

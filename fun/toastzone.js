// fx-1: one toast area that never covers a telemetry card. DOM-free placement (tests/fx_fix.mjs) + a tiny DOM pass.
const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
// box {x,y,w,h} (where CSS put it), cards [{x,y,w,h}]. Push the box down past any card it overlaps; if that runs
// past maxY, slide it sideways to the free side of the overlapping cards instead. Returns { dx, dy }.
export function placeToast(box, cards, maxY, vw) {
  let y = box.y;
  for (let k = 0; k < 8; k++) { const c = cards.find(c => hit({ ...box, y }, c)); if (!c) break; y = c.y + c.h + 6; }
  if (y + box.h <= maxY) return { dx: 0, dy: y - box.y };
  // no room below: put it beside the cards at its original height (the wider free side)
  const over = cards.filter(c => hit({ x: -1e6, w: 2e6, y: box.y, h: box.h }, c)), L = Math.min(...over.map(c => c.x)), Rr = Math.max(...over.map(c => c.x + c.w));
  const x = vw - Rr >= L ? Rr + 6 : Math.max(0, L - 6 - box.w); return { dx: x - box.x, dy: 0 };
}
const rectOf = e => { if (!e) return null; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return null; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null; };
export function guardToasts(doc = document, ids = ['hintS', 'topStack'], cardSel = '#plain, .spCard, #nav, #engS') {
  const cards = [...doc.querySelectorAll(cardSel)].map(rectOf).filter(Boolean);
  for (const id of ids) { const e = doc.getElementById(id); if (!e) continue; e.style.translate = ''; const b = rectOf(e); if (!b) continue;
    const { dx, dy } = placeToast(b, cards, innerHeight * 0.75, innerWidth); if (dx || dy) e.style.translate = `${Math.round(dx)}px ${Math.round(dy)}px`; }
}

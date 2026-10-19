// Screen layout helpers for the 3D map (no DOM, no three.js: unit-tested in tests/qol.mjs).
// Node handles on screen: each at its projected 3D direction, pushed out to at least rMin px from the node; when
// any two would overlap (edge-on views, phones) or a direction is foreshortened, fall back to an even ring so
// every handle stays separate and finger-sized. Returns { key: { x, y, ux, uy } } (u = the drag direction).
const H_KEYS = ['pro', 'nrm', 'rad', 'ret', 'anti', 'radin'];
export function layoutHandles(c, proj, size, rMin) {
  const out = {}; let ok = true;
  for (const k of H_KEYS) { const p = proj(k); if (!p || p.z > 1) { ok = false; continue; } let ux = p.x - c.x, uy = p.y - c.y; const l = Math.hypot(ux, uy); if (l < 8) ok = false; ux /= l || 1; uy /= l || 1; const R = Math.max(l, rMin); out[k] = { x: c.x + ux * R, y: c.y + uy * R, ux, uy }; }
  if (ok) for (let i = 0; i < H_KEYS.length && ok; i++) for (let j = i + 1; j < H_KEYS.length; j++) { const a = out[H_KEYS[i]], b = out[H_KEYS[j]]; if (a && b && Math.hypot(a.x - b.x, a.y - b.y) < size * 1.15) { ok = false; break; } }
  if (ok) return out;
  // ring fallback, ordered so that opposite handles stay opposite; drag direction = projected axis if usable
  const R = rMin * 1.1;
  H_KEYS.forEach((k, i) => { const a = -Math.PI / 2 + i * Math.PI / 3, p = proj(k); let ux = Math.cos(a), uy = Math.sin(a);
    out[k] = { x: c.x + ux * R, y: c.y + uy * R, ux, uy };
    if (p && p.z <= 1) { const dx = p.x - c.x, dy = p.y - c.y, l = Math.hypot(dx, dy); if (l > 8) { out[k].ux = dx / l; out[k].uy = dy / l; } } });
  return out;
}

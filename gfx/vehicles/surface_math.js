// realism-1: pure helpers for surface.js / staged.js (no three import, unit-tested in node: tests/realism_surface.mjs)
// engine soot only on stages that fire near the ground or carry engines: none on fairings/payloads/crew, full on first-stage cores and boosters
// hand-tuned per hero rocket: reused kerolox boosters come back heavily sooted, hydrogen/methane and clean solid stacks stay lighter
export const SOOT_LOOK = { 'heron-9': 1.35, 'heron-9-v11': 1.2, 'heron-9-crew': 1.0, 'heron-heavy': 1.35, 'new-glendale': 0.55, 'electrino': 0.6, 'atlantean-v-551': 0.7, 'dark-dart': 0.8 };
export const sootOf = (st, all, id) => (/fairing|payload|capsule|crew|nose|ship|sat|cargo/i.test(st.key) || st.role === 'fairing' || st.role === 'payload' ? 0 : st === all[0] || st.role === 'strap' || st.role === 'solid' || /booster|core|srb|side/i.test(st.key) ? 1 : 0.35) * (SOOT_LOOK[id] ?? 1);
// height (red channel, tiling) -> tangent-space normal map; pure function, exported for the unit test
export function heightToNormal(h, w, hgt, k = 2.5) { const out = new Uint8ClampedArray(w * hgt * 4), at = (x, y) => h[(((y + hgt) % hgt) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < hgt; y++) for (let x = 0; x < w; x++) { const dx = (at(x + 1, y) - at(x - 1, y)) * k, dy = (at(x, y + 1) - at(x, y - 1)) * k, l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    out[i] = (-dx / l * 0.5 + 0.5) * 255; out[i + 1] = (dy / l * 0.5 + 0.5) * 255; out[i + 2] = (1 / l * 0.5 + 0.5) * 255; out[i + 3] = 255; } return out; }

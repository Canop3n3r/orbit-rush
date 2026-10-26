// Tier-B generator: builds a whole vehicle from a stage table (radius, length, engine count per stage, strap-on boosters, fairing)
// with per-family tweak hooks (ne/sideNe engine overrides, r1 per-stage taper, sideTop strap-on taper, liveries, bands, extra, post). Tables are emitted per company by the private rocketdb tool (dimensions + public ids only).
// Phone budget tier B: hi <= 12k, mid <= 4k, lo <= 2k tris. Stage groups: s1..sN, side0..sideN (strap-ons), payload.
import { stage, fairing, nose, PI, livery } from './co_gen.js?v=f5.9-9';
import { group, plume } from './co_civspace.js?v=f5.9-9';
// engine layouts (ring list for stage(): [n, ringR, re, L, a0])
export function engines(n, r, L) { const e = (k) => Math.min(r * 0.55, r * k);
  if (n <= 1) return [[1, 0, e(0.5), L]];
  if (n <= 4) return [[n, r * 0.45, e(0.3), L * 0.85, n === 2 ? 0 : PI / n]];
  if (n <= 6) return [[n - 1, r * 0.55, e(0.24), L * 0.8, PI / 4], [1, 0, e(0.24), L * 0.8]];
  return [[n - 1, r * 0.62, e(0.18), L * 0.75, 0], [1, 0, e(0.18), L * 0.75]]; }
// hook step: 1 for heavy clusters: build one Kit detail lower (hi->mid, mid->lo), mid caps 2 bells per stage, lo 1
const DOWN = { hi: 'mid', mid: 'lo', lo: 'lo' };
export function buildB(o, id, s, hk = {}) { const d = hk.step ? DOWN[o.detail] : o.detail, NE = n => !hk.step ? n : o.detail === 'lo' ? 1 : o.detail === 'mid' ? Math.min(n, 2) : n, /* mid: at most 2 bells per stage */ lo = livery(hk.lower ?? 0x7d8070), up = livery(hk.upper ?? 0xe6e6e0), kids = []; let y = hk.lift ?? 1.2, rPrev = 0;
  s.stages.forEach((t, i) => { const L1 = Math.max(0.6, Math.min(2.2, t.r * 1.0)), key = i === 0 || (hk.olive ?? 1) > i ? lo : up;
    const g = stage(d, 's' + (i + 1), { r: t.r, r1: hk.r1?.[i], h: t.L, y0: y, eng: o.detail !== 'hi' && hk.hideBells?.includes(i) ? [] /* hideBells: stage bells inside an interstage, hi only */ : engines(NE(hk.ne?.[i] ?? t.ne), t.r, i ? L1 * 0.7 : L1), drop: i ? L1 * 0.6 : 0, ext: i > 0, key, skirt: i === 0 ? t.r * 1.03 : (rPrev > t.r ? rPrev : 0),
      bands: [[0, Math.min(0.8, t.L * 0.08)], ...(hk.bands?.[i] || [])], decalY: i === 0 ? t.L * 0.5 : 0, extra: hk.extra ? k => hk.extra(k, i, t, y) : undefined });
    kids.push(g); y = g.userData.top; rPrev = hk.r1?.[i] ?? t.r; });
  (s.sides || []).forEach((b, i, A) => { const a = (b.a0 ?? PI / 4) + i * 2 * PI / A.length, off = s.stages[0].r + b.r + 0.08;
    const rs = b.r * (hk.sideTop ?? 1), sk = hk.sideKey != null ? livery(hk.sideKey) : lo, plain = !!hk.plainSides, /* plainSides: big strap-on rings are one-material shells (no band; mid/lo: no bell) */ g = stage(d, 'side' + i, { r: b.r, r1: rs, h: b.L, y0: hk.lift ?? 1.2, eng: plain && o.detail !== 'hi' ? [] : engines(NE(hk.sideNe ?? b.ne), b.r, 1.2), key: sk, bands: plain ? [] : [[0, 0.5]] }); const n = nose(d, 'n', { r: rs, L: rs * 2.4, y0: (hk.lift ?? 1.2) + b.L, key: plain ? sk : hk.sideKey != null ? livery(hk.sideKey) : 'paint:0,0' });
    if ((!hk.step || o.detail !== 'lo') && !(hk.sideNoseHi && o.detail !== 'hi')) g.add(...n.children.splice(0)); /* lo: tapered strap-ons end without a separate nose */ g.position.set(Math.cos(a) * off, 0, Math.sin(a) * off); kids.push(g); });
  const rt = s.stages.at(-1).r, f = s.fair && s.fair.L > 0.4 ? fairing(d, 'payload', { r: s.fair.r ?? rt, rb: rt, cyl: s.fair.L * 0.45, nose: s.fair.L * 0.55, y0: y, key: hk.fairKey ?? 'paint:0,0' })
    : nose(d, 'payload', { r: rt, L: rt * 1.6, y0: y });
  kids.push(f); const g = group(id, kids, f.userData.top); g.userData.displayName = hk.name; if (hk.post) hk.post(g, d);
  if (o.plume) g.add(plume(0, [[0, 0]], s.stages[0].r * 0.6, 40 * o.plume)); return g; }

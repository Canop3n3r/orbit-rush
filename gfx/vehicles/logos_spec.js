// logos-deploy-1: original logo marks and wordmarks for every launch house in the game (fun/picker.js HOUSES + the Originals set).
// Pure data (no DOM, no three): each mark is a few SVG path layers in a 64x64 box, built from simple geometry here. The same spec
// draws the runtime decal atlas (gfx/vehicles/logos.js via Path2D) and the shipped SVG files (tools/gen_logos.mjs -> brand/logos/*.svg).
// All marks are original geometric designs made for this game; none copies or imitates a real emblem, patch or badge.
const f = n => +n.toFixed(2);
export const circle = (cx, cy, r) => `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
export const ring = (cx, cy, r, w) => circle(cx, cy, r) + circle(cx, cy, r - w); // fill with evenodd
export const poly = pts => 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z';
export const star = (cx, cy, n, R, r, a0 = -Math.PI / 2) => poly(Array.from({ length: 2 * n }, (_, i) => { const a = a0 + i * Math.PI / n, q = i % 2 ? r : R; return [cx + Math.cos(a) * q, cy + Math.sin(a) * q]; }));
export const ngon = (cx, cy, n, R, a0 = -Math.PI / 2) => poly(Array.from({ length: n }, (_, i) => { const a = a0 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * R, cy + Math.sin(a) * R]; }));
const ellipseRing = (cx, cy, rx, ry, w, rot) => { const pts = (a, b) => Array.from({ length: 36 }, (_, i) => { const t = i / 36 * 2 * Math.PI, x = Math.cos(t) * a, y = Math.sin(t) * b; return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]; }); return poly(pts(rx, ry)) + poly(pts(rx - w, ry - w).reverse()); };
const rocket = (cx, by, h, w) => poly([[cx, by - h], [cx + w / 2, by - h * 0.62], [cx + w / 2, by - h * 0.18], [cx + w, by], [cx + w / 2, by - h * 0.08], [cx - w / 2, by - h * 0.08], [cx - w, by], [cx - w / 2, by - h * 0.18], [cx - w / 2, by - h * 0.62]]);
const chevron = (cx, cy, w, h, t) => poly([[cx - w / 2, cy + h / 2], [cx, cy - h / 2], [cx + w / 2, cy + h / 2], [cx + w / 2 - t, cy + h / 2], [cx, cy - h / 2 + t * 1.6], [cx - w / 2 + t, cy + h / 2]]);
const wave = (y, a, t) => { const top = Array.from({ length: 17 }, (_, i) => [4 + i * 3.5, y + Math.sin(i / 16 * Math.PI * 2) * a]); return poly([...top, ...top.slice().reverse().map(p => [p[0], p[1] + t])]); };
const bolt = poly([[36, 4], [16, 36], [30, 36], [24, 60], [48, 26], [34, 26], [42, 4]]);
// house id -> { word: wordmark text, c: [primary, secondary, ground], layers: [[path, colour index]], flag: country-stripe colours (top..bottom) }
// Wordmarks are the in-game short names (fun/picker.js SHORT); 'originals' is the game's own house.
export const LOGOS = {
  originals: { word: 'ORBIT RUSH', c: ['#f2a33a', '#e8ecf2', '#14181f'], layers: [[ellipseRing(32, 32, 28, 12, 4, -0.5), 0], [rocket(32, 50, 40, 6), 1]], flag: ['#f2a33a', '#14181f'] },
  spacey: { word: 'SPACEY', c: ['#e8ecf2', '#9aa4b2', '#101318'], layers: [[poly([[6, 50], [58, 10], [40, 50], [30, 42]]), 0], [circle(16, 18, 5), 1]], flag: ['#2a3f8f', '#f1f1f1', '#b8282e'] },
  civspace: { word: 'CIVIL SPACE', c: ['#ffffff', '#c8343b', '#1d3c8f'], layers: [[circle(32, 32, 28), 2], [ellipseRing(32, 34, 26, 9, 3, -0.35), 0], [chevron(32, 30, 34, 26, 7), 1], [star(46, 18, 5, 4, 1.7), 0]], flag: ['#2a3f8f', '#f1f1f1', '#b8282e'] },
  arion: { word: 'ARION', c: ['#1f5fbf', '#f0c419', '#ffffff'], layers: [[poly([[32, 4], [58, 58], [46, 58], [32, 28], [18, 58], [6, 58]]), 0], [star(32, 44, 4, 7, 2.5), 1]], flag: ['#1f4ea8', '#f0c419', '#1f4ea8'] },
  albion: { word: 'ALBION', c: ['#16336e', '#c22d34', '#ffffff'], layers: [[ngon(32, 32, 6, 28), 0], [chevron(32, 34, 30, 22, 7), 2], [poly([[29, 8], [35, 8], [35, 56], [29, 56]]), 1]], flag: ['#16336e', '#ffffff', '#c22d34'] },
  baltic: { word: 'BALTIC', c: ['#2c6e8f', '#d9e6ee', '#0e2433'], layers: [[circle(32, 32, 28), 0], [wave(24, 4, 6), 1], [wave(38, 4, 6), 1]], flag: ['#2c6e8f', '#0e2433', '#f1f1f1'] },
  bluehz: { word: 'HORIZON', c: ['#2a6fdb', '#9cc4ff', '#0b1426'], layers: [[poly([[4, 42], [60, 42], [60, 48], [4, 48]]), 0], [ring(32, 42, 20, 5), 1], [poly([[0, 42], [64, 42], [64, 64], [0, 64]]), 2]], flag: ['#2a3f8f', '#f1f1f1', '#b8282e'] },
  bolt: { word: 'BOLT', c: ['#ffd23f', '#1a1a1a', '#ffffff'], layers: [[circle(32, 32, 29), 1], [bolt, 0]], flag: ['#1a1a1a', '#ffffff', '#1a1a1a'] },
  cnfoll: { word: 'ORIENT', c: ['#d6362f', '#f5c518', '#ffffff'], layers: [[ring(32, 32, 28, 5), 0], [star(32, 32, 5, 16, 6.5), 1]], flag: ['#d6362f', '#f5c518', '#d6362f'] },
  convex: { word: 'CONVAR', c: ['#0f8a7a', '#e6eef0', '#0a1e22'], layers: [[poly([[8, 56], [32, 8], [56, 56]]), 0], [poly([[20, 50], [32, 26], [44, 50]]), 1]], flag: ['#2a3f8f', '#f1f1f1', '#b8282e'] },
  dougwing: { word: 'DOUG-WING', c: ['#2b2f6b', '#e9b949', '#ffffff'], layers: [[poly([[2, 36], [32, 18], [62, 36], [44, 34], [32, 46], [20, 34]]), 0], [circle(32, 30, 5), 1]], flag: ['#2a3f8f', '#f1f1f1', '#b8282e'] },
  expl: { word: 'EXPL', c: ['#ff6a3d', '#ffffff', '#1b1b22'], layers: [[star(32, 32, 8, 28, 10), 0], [circle(32, 32, 7), 1]], flag: ['#2a3f8f', '#f1f1f1', '#b8282e'] },
  galen: { word: 'GALEN', c: ['#7b3fbf', '#ffd166', '#ffffff'], layers: [[ring(32, 32, 26, 6), 0], [circle(50, 14, 7), 1]], flag: ['#d6362f', '#f5c518', '#d6362f'] },
  gaulois: { word: 'GAULOIS', c: ['#1a4b9c', '#e23b3b', '#ffffff'], layers: [[poly([[6, 56], [26, 8], [36, 8], [16, 56]]), 0], [poly([[28, 56], [48, 8], [58, 8], [38, 56]]), 1]], flag: ['#1a4b9c', '#ffffff', '#e23b3b'] },
  irg: { word: 'GUILD', c: ['#8a5a2b', '#e0c38c', '#1d140c'], layers: [[ngon(32, 32, 8, 28, Math.PI / 8), 0], [rocket(32, 54, 42, 7), 1]], flag: ['#2a3f8f', '#f1f1f1', '#b8282e'] },
  isra: { word: 'ISRA', c: ['#ff8c1a', '#138a36', '#1b2f6b'], layers: [[ellipseRing(32, 32, 28, 14, 4, 0), 2], [rocket(32, 56, 48, 7), 0], [circle(32, 32, 4), 1]], flag: ['#ff8c1a', '#ffffff', '#138a36'] },
  jade: { word: 'JADE SKY', c: ['#1f9e6e', '#c9f2df', '#08241a'], layers: [[ngon(32, 32, 4, 29, 0), 0], [ngon(32, 32, 4, 15, 0), 1]], flag: ['#d6362f', '#f5c518', '#d6362f'] },
  jaxo: { word: 'JAXO', c: ['#1d4fa8', '#e6372f', '#ffffff'], layers: [[ellipseRing(32, 32, 28, 16, 5, -0.6), 0], [circle(32, 32, 9), 1]], flag: ['#ffffff', '#e6372f', '#ffffff'] },
  krasnaya: { word: 'KRASNAYA', c: ['#c41e24', '#f2c14e', '#ffffff'], layers: [[star(32, 34, 5, 28, 11), 0], [ring(32, 34, 9, 3), 1]], flag: ['#ffffff', '#2a4fa0', '#c41e24'] },
  krunov: { word: 'KRUNOV', c: ['#3c4a5c', '#e6e9ee', '#c41e24'], layers: [[ngon(32, 32, 6, 28, 0), 0], [poly([[18, 14], [26, 14], [26, 30], [40, 14], [50, 14], [34, 32], [50, 50], [40, 50], [26, 34], [26, 50], [18, 50]]), 1]], flag: ['#ffffff', '#2a4fa0', '#c41e24'] },
  levant: { word: 'LEVANT', c: ['#0d6fb8', '#ffffff', '#0a2340'], layers: [[circle(32, 32, 28), 0], [poly([[14, 44], [32, 14], [50, 44], [44, 44], [32, 24], [20, 44]]), 1], [poly([[14, 48], [50, 48], [50, 52], [14, 52]]), 1]], flag: ['#0d6fb8', '#ffffff', '#0d6fb8'] },
  lingvolt: { word: 'LING-VOLT', c: ['#e0402f', '#2f2f37', '#ffffff'], layers: [[poly([[4, 8], [60, 8], [60, 56], [4, 56]]), 1], [chevron(32, 30, 40, 24, 8), 0], [chevron(32, 44, 40, 18, 6), 2]], flag: ['#d6362f', '#f5c518', '#d6362f'] },
  martell: { word: 'MARTELL', c: ['#23364f', '#c9d3df', '#ffffff'], layers: [[poly([[10, 8], [54, 8], [54, 20], [38, 20], [38, 58], [26, 58], [26, 20], [10, 20]]), 0], [circle(32, 44, 5), 1]], flag: ['#2a3f8f', '#f1f1f1', '#b8282e'] },
  orbitron: { word: 'ORBITRON', c: ['#00a3c4', '#ffffff', '#062a33'], layers: [[circle(32, 32, 10), 0], [ellipseRing(32, 32, 28, 10, 3, 0.6), 0], [ellipseRing(32, 32, 28, 10, 3, -0.6), 1]], flag: ['#2a3f8f', '#f1f1f1', '#b8282e'] },
  rocketwell: { word: 'ROCKETWELL', c: ['#e8ecf2', '#d84a2b', '#0d0f13'], layers: [[ring(32, 32, 28, 4), 0], [rocket(32, 54, 44, 8), 0], [poly([[8, 46], [56, 30], [56, 34], [8, 50]]), 1]], flag: ['#2a3f8f', '#f1f1f1', '#b8282e'] },
  skyland: { word: 'SKYLAND', c: ['#3fa9f5', '#ffffff', '#0d2b45'], layers: [[poly([[4, 52], [22, 22], [32, 36], [42, 18], [60, 52]]), 0], [circle(46, 14, 6), 1]], flag: ['#d6362f', '#ffffff', '#1e4fa0'] },
  southstar: { word: 'SOUTHSTAR', c: ['#f2c94c', '#1c3d6e', '#ffffff'], layers: [[circle(32, 32, 29), 1], [star(32, 32, 4, 26, 6), 0], [star(32, 32, 4, 12, 3, -Math.PI / 4), 2]], flag: ['#1c63b7', '#f2c94c'] },
  unilift: { word: 'UNILIFT', c: ['#2b59c3', '#f2f4f8', '#14213d'], layers: [[poly([[10, 10], [22, 10], [22, 40], [42, 40], [42, 10], [54, 10], [54, 52], [10, 52]]), 0], [poly([[28, 4], [36, 4], [36, 30], [28, 30]]), 1]], flag: ['#2a3f8f', '#f1f1f1', '#b8282e'] },
};
export const HOUSE_IDS = Object.keys(LOGOS);
// atlas: 1024 x 1024 on hi, 512 x 512 on phones. 2 columns x 16 rows of 512 x 64 cells; each cell = [mark 64][wordmark 384][stripe 64]
export const ATLAS = { size: 1024, cols: 2, rows: 16, cw: 512, ch: 64, mark: [0, 64], word: [64, 384], flag: [448, 64] };
export function cellOf(house) { const i = HOUSE_IDS.indexOf(house); if (i < 0) return null; const col = i % ATLAS.cols, row = (i / ATLAS.cols) | 0; return { x: col * ATLAS.cw, y: row * ATLAS.ch }; }
// uv rect [u0, v0, u1, v1] (v up, three.js flipY) of one part of a house's cell
export function uvRect(house, part) { const c = cellOf(house); if (!c) return null; const [x0, w] = ATLAS[part], S = ATLAS.size; return [(c.x + x0) / S, 1 - (c.y + ATLAS.ch) / S, (c.x + x0 + w) / S, 1 - c.y / S]; }
// a full SVG document for one house: mark + wordmark + country stripe on a 512 x 64 canvas
export function svgOf(house) { const L = LOGOS[house], esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const marks = L.layers.map(([d, ci]) => `<path d="${d}" fill="${L.c[ci]}" fill-rule="evenodd"/>`).join('');
  const flag = L.flag.map((c, i) => `<rect x="456" y="${8 + i * 48 / L.flag.length}" width="48" height="${48 / L.flag.length}" fill="${c}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="64" viewBox="0 0 512 64"><g>${marks}</g><text x="72" y="46" font-family="Arial Black, Helvetica, sans-serif" font-weight="900" font-size="38" textLength="${Math.min(376, L.word.length * 30)}" lengthAdjust="spacingAndGlyphs" fill="${L.c[0]}" stroke="${L.c[2]}" stroke-width="1.5" paint-order="stroke">${esc(L.word)}</text>${flag}</svg>\n`; }

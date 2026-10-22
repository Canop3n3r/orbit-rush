// flight-ground-1 regression: in flight, bodies other than Earth must use their licensed map (Moon/Mars: the world
// surface materials with distance-faded detail + haze), not the old one-colour procedural crater canvas.
import { readFileSync } from 'node:fs';
const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8'), surf = readFileSync(new URL('../gfx/world/surfaces.js', import.meta.url), 'utf8');
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
ok(/function bodyMaterialOf\(id\)/.test(main), 'bodyMaterialOf exists');
ok(/id === 'moon' \|\| id === 'mars'/.test(main) && /w1Moon\(/.test(main) && /w1Mars\(/.test(main), 'Moon/Mars use the world surface materials');
ok(/material: bodyMaterialOf\(bodyCur\)/.test(main), 'LOD chunks use the body material');
ok(/bodySph\.material = bodyGround\.material = bodyMaterialOf\(id\)/.test(main), 'sphere + ground disc share it');
ok(/U\.rot\.value\.set\(1, 0, 0, 0, 0, 1, 0, -1, 0\)/.test(main), 'Z-up game frame mapped to the Y-up map');
ok(/U\.center\.value\.set\(-O\[0\], -O\[1\], -O\[2\]\)\.multiplyScalar\(0\.001\)/.test(main), 'surface centre follows the floating origin (km)');
ok(/anisotropy = TOUCH \? 4 : 8/.test(main), 'anisotropic filtering on body maps');
ok(/logarithmicDepthBuffer: true/.test(main), 'log depth buffer on');
ok(/const mapDir = /.test(surf) && (surf.match(/dirUV\(mapDir\(U, d\)\)/g) || []).length >= 2, 'surfaces honour U.rot');
process.exit(bad ? 1 : 0);

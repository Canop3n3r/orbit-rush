// Ghost half-cone regression (rockets-pass-1): a ship / capsule stack has no shell group, so fairing separation must split nothing.
import { sepShells } from '../fun/fairing.js';
let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
const shell = { name: 'physics-shell' }, a = { name: 'hero-fairing' };
ok(sepShells({ hero: true, heroShells: [], physShell: shell }).length === 0, 'hero without a shell group (ship): physics shell is NOT split into halves');
ok(sepShells({ hero: true, heroShells: [a], physShell: shell }).join() === [a].join(), 'hero with a fairing group: only the hero shell splits');
ok(sepShells({ hero: false, heroShells: [], physShell: shell })[0] === shell, 'no hero (custom design): the physics shell splits');
ok(sepShells({ hero: false, heroShells: [], physShell: null }).length === 0, 'no hero and no shell: nothing');
process.exit(bad ? 1 : 0);

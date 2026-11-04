// legs-fins-1: the Blender hull lathe keeps every spec silhouette point (Heron Heavy's upper stage rendered as a cone when a 4 cm step ring was deduped away)
import { spawnSync } from 'node:child_process';
const r = spawnSync('python3', [new URL('./py/hull_profile.py', import.meta.url).pathname], { encoding: 'utf8' });
console.log((r.stdout + r.stderr).trim()); process.exit(r.status === 0 ? 0 : 1);

// legs-fins-1: deployed leg feet sit 1-2 m below the engine exits (Blender kit leg_deploy), checked on every legged stage spec
import { spawnSync } from 'node:child_process';
const r = spawnSync('python3', [new URL('./py/leg_feet.py', import.meta.url).pathname], { encoding: 'utf8' });
console.log((r.stdout + r.stderr).trim()); process.exit(r.status === 0 ? 0 : 1);

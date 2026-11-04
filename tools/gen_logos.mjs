// logos-deploy-1: writes brand/logos/<house>.svg from gfx/vehicles/logos_spec.js (run: node tools/gen_logos.mjs). Original marks only.
import { writeFileSync, mkdirSync } from 'node:fs';
import { HOUSE_IDS, svgOf } from '../gfx/vehicles/logos_spec.js';
const dir = new URL('../brand/logos/', import.meta.url); mkdirSync(dir, { recursive: true });
for (const h of HOUSE_IDS) writeFileSync(new URL(h + '.svg', dir), svgOf(h));
console.log('wrote', HOUSE_IDS.length, 'logos');

// gfx/vehicles/nozzles.js is generated from the hero models (tools/gen_nozzles.cjs). Fails when it is stale.
// Needs the art server on :8771 + playwright-core (skips with exit 0 without playwright).
try { require(process.env.PWT || '/workspace/pwt/node_modules/playwright-core'); } catch { console.log('nozzles: skipped (no playwright)'); process.exit(0); }
process.argv[2] = '--check'; require('../tools/gen_nozzles.cjs');

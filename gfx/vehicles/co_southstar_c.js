// Southstar Design Bureau, tier B (stage-table generator + hooks): Partial Orbiter, three-chamber silo core with a single-engine upper stage. Olive drab and grey.
import { buildB } from './gen_b.js?v=f5.9-8';
// display names: the only place they live (cheap to rename later)
export const NAMES = {'partial-orbiter': 'Partial Orbiter'};
// stage tables (generated): r, L in m, ne = engines; sides = strap-ons; fair = payload fairing length
export const SPEC = {
  'partial-orbiter': { h: 35.0, stages: [{'r': 1.5, 'L': 18.8, 'ne': 3}, {'r': 1.5, 'L': 9.4, 'ne': 1}], sides: [], fair: { L: 5.6 } },
};
// per-family tweak hooks (hand-edited): livery, bands, extra details
export const HOOKS = {
  'partial-orbiter': { lower: 0x6f7560, upper: 0x9a9c94, olive: 1 },
};
export const CO_SOUTHSTAR_C = {
  'partial-orbiter': { name: NAMES['partial-orbiter'], height: 35.0, build: o => buildB(o, 'partial-orbiter', SPEC['partial-orbiter'], { name: NAMES['partial-orbiter'], ...HOOKS['partial-orbiter'] }), src: 'rocketdb partial-orbiter stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
};

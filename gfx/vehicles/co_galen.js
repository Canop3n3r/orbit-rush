// Galen Space, tier B (stage-table generator + hooks): Millstone-1 and Millstone-2 four-stage solid launchers. White, grey upper.
import { buildB } from './gen_b.js?v=f5.9-8';
// display names: the only place they live (cheap to rename later)
export const NAMES = {'millstone-1': 'Millstone-1', 'millstone-2': 'Millstone-2'};
// stage tables (generated): r, L in m, ne = engines; sides = strap-ons; fair = payload fairing length
export const SPEC = {
  'millstone-1': { h: 20.0, stages: [{'r': 0.7, 'L': 7.8, 'ne': 1}, {'r': 0.7, 'L': 4.4, 'ne': 1}, {'r': 0.7, 'L': 3.4, 'ne': 1}, {'r': 0.6, 'L': 2.0, 'ne': 1}], sides: [], fair: { L: 1.2 } },
  'millstone-2': { h: 26.0, stages: [{'r': 1.175, 'L': 8.5, 'ne': 1}, {'r': 1.175, 'L': 5.0, 'ne': 1}, {'r': 0.95, 'L': 3.5, 'ne': 1}, {'r': 0.6, 'L': 2.0, 'ne': 1}], sides: [], fair: { L: 5.8 } },
};
// per-family tweak hooks (hand-edited): livery, bands, extra details
export const HOOKS = {
  'millstone-1': { lower: 0xeeeeea, upper: 0xcfd1d3 },
  'millstone-2': { lower: 0xeeeeea, upper: 0xcfd1d3 },
};
export const CO_GALEN = {
  'millstone-1': { name: NAMES['millstone-1'], height: 20.0, build: o => buildB(o, 'millstone-1', SPEC['millstone-1'], { name: NAMES['millstone-1'], ...HOOKS['millstone-1'] }), src: 'rocketdb millstone-1 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'millstone-2': { name: NAMES['millstone-2'], height: 26.0, build: o => buildB(o, 'millstone-2', SPEC['millstone-2'], { name: NAMES['millstone-2'], ...HOOKS['millstone-2'] }), src: 'rocketdb millstone-2 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
};

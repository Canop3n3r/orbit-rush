// Krunov, tier B (stage-table generator + hooks): Gulok and Kopyo-M, slim three-stage silo-derived launchers. White and pale grey.
import { buildB } from './gen_b.js?v=f5.8w';
// display names: the only place they live (cheap to rename later)
export const NAMES = {'gulok': 'Gulok', 'kopyo-m': 'Kopyo-M'};
// stage tables (generated): r, L in m, ne = engines; sides = strap-ons; fair = payload fairing length
export const SPEC = {
  'gulok': { h: 29.0, stages: [{'r': 1.25, 'L': 17.2, 'ne': 4}, {'r': 1.25, 'L': 3.9, 'ne': 1}, {'r': 1.0, 'L': 2.5, 'ne': 1}], sides: [], fair: { L: 4.2 } },
  'kopyo-m': { h: 29.2, stages: [{'r': 1.25, 'L': 17.2, 'ne': 4}, {'r': 1.25, 'L': 3.9, 'ne': 1}, {'r': 1.2, 'L': 1.3, 'ne': 1}], sides: [], fair: { L: 5.6 } },
};
// per-family tweak hooks (hand-edited): livery, bands, extra details
export const HOOKS = {
  'gulok': { lower: 0xe9e9e4, upper: 0xe9e9e4 },
  'kopyo-m': { lower: 0xd9dbd6, upper: 0xe9e9e4 },
};
export const CO_KRUNOV_B = {
  'gulok': { name: NAMES['gulok'], height: 29.0, build: o => buildB(o, 'gulok', SPEC['gulok'], { name: NAMES['gulok'], ...HOOKS['gulok'] }), src: 'rocketdb gulok stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'kopyo-m': { name: NAMES['kopyo-m'], height: 29.2, build: o => buildB(o, 'kopyo-m', SPEC['kopyo-m'], { name: NAMES['kopyo-m'], ...HOOKS['kopyo-m'] }), src: 'rocketdb kopyo-m stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
};

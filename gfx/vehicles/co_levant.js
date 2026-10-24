// Levant Aerospace, tier B (stage-table generator + hooks): Negev Dart three-stage solid launcher. White.
import { buildB } from './gen_b.js?v=f5.8r';
// display names: the only place they live (cheap to rename later)
export const NAMES = {'negev-dart': 'Negev Dart'};
// stage tables (generated): r, L in m, ne = engines; sides = strap-ons; fair = payload fairing length
export const SPEC = {
  'negev-dart': { h: 18.0, stages: [{'r': 0.675, 'L': 7.5, 'ne': 1}, {'r': 0.675, 'L': 5.3, 'ne': 1}, {'r': 0.675, 'L': 2.6, 'ne': 1}], sides: [], fair: { L: 1.4 } },
};
// per-family tweak hooks (hand-edited): livery, bands, extra details
export const HOOKS = {
  'negev-dart': { lower: 0xeeeeea, upper: 0xeeeeea, sideKey: 0xeeeeea },
};
export const CO_LEVANT = {
  'negev-dart': { name: NAMES['negev-dart'], height: 18.0, build: o => buildB(o, 'negev-dart', SPEC['negev-dart'], { name: NAMES['negev-dart'], ...HOOKS['negev-dart'] }), src: 'rocketdb negev-dart stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
};

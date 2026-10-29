// Convex Astronautics, tier B (stage-table generator + hooks): Atlantean-Centaurus, stage-and-a-half balloon-tank core under a high-energy upper stage. Steel silver, white upper.
import { buildB } from './gen_b.js?v=f5.9-12';
// display names: the only place they live (cheap to rename later)
export const NAMES = {'atlantean-centaurus': 'Atlantean-Centaurus'};
// stage tables (generated): r, L in m, ne = engines; sides = strap-ons; fair = payload fairing length
export const SPEC = {
  'atlantean-centaurus': { h: 47.4, stages: [{'r': 1.525, 'L': 29.4, 'ne': 3}, {'r': 1.525, 'L': 10.1, 'ne': 2}], sides: [], fair: { L: 6.7, r: 2.1 } /* hand-edited: the 4.5 m booster section is the core's jettisoned engine skirt, not a strap-on; 3 bells = 2 booster + sustainer; fairing 6.7 m to fit 47.4 m */ },
};
// per-family tweak hooks (hand-edited): livery, bands, extra details
export const HOOKS = {
  'atlantean-centaurus': { lower: 0xc9ccd0, upper: 0xeeeeea, olive: 1, bands: [[[28.6, 0.5]], [[0, 0.4]]] },
};
export const CO_CONVEX_B = {
  'atlantean-centaurus': { name: NAMES['atlantean-centaurus'], height: 47.4, build: o => buildB(o, 'atlantean-centaurus', SPEC['atlantean-centaurus'], { name: NAMES['atlantean-centaurus'], ...HOOKS['atlantean-centaurus'] }), src: 'rocketdb atlantean-centaurus stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
};

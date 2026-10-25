// Skyland Space, tier B (stage-table generator + hooks): Ember Finch-2, 2E and 3. Steel grey lower, white upper.
import { buildB } from './gen_b.js?v=f5.9-3';
// display names: the only place they live (cheap to rename later)
export const NAMES = {'ember-finch-2': 'Ember Finch-2', 'ember-finch-2e': 'Ember Finch-2E', 'ember-finch-3': 'Ember Finch-3'};
// stage tables (generated): r, L in m, ne = engines; sides = strap-ons; fair = payload fairing length
export const SPEC = {
  'ember-finch-2': { h: 49.5, stages: [{'r': 1.675, 'L': 34.0, 'ne': 4}, {'r': 1.675, 'L': 12.0, 'ne': 1}], sides: [], fair: { L: 2.3 } },
  'ember-finch-2e': { h: 55.9, stages: [{'r': 1.675, 'L': 38.8, 'ne': 4}, {'r': 1.675, 'L': 13.8, 'ne': 1}], sides: [], fair: { L: 2.1 } },
  'ember-finch-3': { h: 66.1, stages: [{'r': 2.25, 'L': 39.0, 'ne': 9}, {'r': 2.25, 'L': 14.5, 'ne': 1}], sides: [], fair: { L: 11.4 } },
};
// per-family tweak hooks (hand-edited): livery, bands, extra details
export const HOOKS = {
  'ember-finch-2': { lower: 0xa7abb0, upper: 0xeeeeea, olive: 1 },
  'ember-finch-2e': { lower: 0xa7abb0, upper: 0xeeeeea, olive: 1 },
  'ember-finch-3': { step: 1, lower: 0xa7abb0, upper: 0xeeeeea, olive: 1 },
};
export const CO_SKYLAND = {
  'ember-finch-2': { name: NAMES['ember-finch-2'], height: 49.5, build: o => buildB(o, 'ember-finch-2', SPEC['ember-finch-2'], { name: NAMES['ember-finch-2'], ...HOOKS['ember-finch-2'] }), src: 'rocketdb ember-finch-2 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'ember-finch-2e': { name: NAMES['ember-finch-2e'], height: 55.9, build: o => buildB(o, 'ember-finch-2e', SPEC['ember-finch-2e'], { name: NAMES['ember-finch-2e'], ...HOOKS['ember-finch-2e'] }), src: 'rocketdb ember-finch-2e stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'ember-finch-3': { name: NAMES['ember-finch-3'], height: 66.1, build: o => buildB(o, 'ember-finch-3', SPEC['ember-finch-3'], { name: NAMES['ember-finch-3'], ...HOOKS['ember-finch-3'] }), src: 'rocketdb ember-finch-3 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
};

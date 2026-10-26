// Expl Space, tier B (stage-table generator + hooks): Swiftlet, Wayfarer and Ember Finch small solid launchers. White with dark interstages.
import { buildB } from './gen_b.js?v=f5.9-9';
// display names: the only place they live (cheap to rename later)
export const NAMES = {'swiftlet-1': 'Swiftlet-1', 'swiftlet-1a': 'Swiftlet-1A', 'swiftlet-11': 'Swiftlet-11', 'wayfarer-1': 'Wayfarer-1', 'wayfarer-2': 'Wayfarer-2', 'ember-finch-1': 'Ember Finch-1'};
// stage tables (generated): r, L in m, ne = engines; sides = strap-ons; fair = payload fairing length
export const SPEC = {
  'swiftlet-1': { h: 20.0, stages: [{'r': 0.675, 'L': 6.0, 'ne': 1}, {'r': 0.675, 'L': 4.0, 'ne': 1}, {'r': 0.6, 'L': 2.0, 'ne': 1}, {'r': 0.55, 'L': 1.5, 'ne': 1}], sides: [], fair: { L: 5.3 } },
  'swiftlet-1a': { h: 20.0, stages: [{'r': 0.675, 'L': 6.0, 'ne': 1}, {'r': 0.675, 'L': 4.0, 'ne': 1}, {'r': 0.6, 'L': 2.0, 'ne': 1}, {'r': 0.55, 'L': 1.5, 'ne': 1}], sides: [], fair: { L: 5.3 } },
  'swiftlet-11': { h: 25.3, stages: [{'r': 1.1, 'L': 12.16, 'ne': 1}, {'r': 1.1, 'L': 6.08, 'ne': 1}, {'r': 1.1, 'L': 3.04, 'ne': 1}], sides: [], fair: { L: 0.00 } },
  'wayfarer-1': { h: 11.0, stages: [{'r': 0.675, 'L': 4.58, 'ne': 1}, {'r': 0.675, 'L': 3.05, 'ne': 1}, {'r': 0.6, 'L': 1.53, 'ne': 1}, {'r': 0.325, 'L': 0.92, 'ne': 1}], sides: [], fair: { L: 0.00 } },
  'wayfarer-2': { h: 20.0, stages: [{'r': 1.0, 'L': 8.0, 'ne': 1}, {'r': 1.0, 'L': 4.0, 'ne': 1}, {'r': 1.0, 'L': 2.0, 'ne': 1}], sides: [], fair: { L: 4.8 } },
  'ember-finch-1': { h: 19.0, stages: [{'r': 0.675, 'L': 6.0, 'ne': 1}, {'r': 0.675, 'L': 6.0, 'ne': 1}, {'r': 0.675, 'L': 2.0, 'ne': 1}], sides: [], fair: { L: 3.8 } },
};
// per-family tweak hooks (hand-edited): livery, bands, extra details
export const HOOKS = {
  'swiftlet-1': { lower: 0xeeeeea, upper: 0xeeeeea },
  'swiftlet-1a': { lower: 0xeeeeea, upper: 0xeeeeea },
  'swiftlet-11': { lower: 0xeeeeea, upper: 0xeeeeea },
  'wayfarer-1': { lower: 0xe2e4e6, upper: 0xeeeeea },
  'wayfarer-2': { lower: 0xe2e4e6, upper: 0xeeeeea },
  'ember-finch-1': { lower: 0xd8d2c6, upper: 0xeeeeea },
};
export const CO_EXPL = {
  'swiftlet-1': { name: NAMES['swiftlet-1'], height: 20.0, build: o => buildB(o, 'swiftlet-1', SPEC['swiftlet-1'], { name: NAMES['swiftlet-1'], ...HOOKS['swiftlet-1'] }), src: 'rocketdb swiftlet-1 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'swiftlet-1a': { name: NAMES['swiftlet-1a'], height: 20.0, build: o => buildB(o, 'swiftlet-1a', SPEC['swiftlet-1a'], { name: NAMES['swiftlet-1a'], ...HOOKS['swiftlet-1a'] }), src: 'rocketdb swiftlet-1a stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'swiftlet-11': { name: NAMES['swiftlet-11'], height: 25.3, build: o => buildB(o, 'swiftlet-11', SPEC['swiftlet-11'], { name: NAMES['swiftlet-11'], ...HOOKS['swiftlet-11'] }), src: 'rocketdb swiftlet-11 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'wayfarer-1': { name: NAMES['wayfarer-1'], height: 11.0, build: o => buildB(o, 'wayfarer-1', SPEC['wayfarer-1'], { name: NAMES['wayfarer-1'], ...HOOKS['wayfarer-1'] }), src: 'rocketdb wayfarer-1 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'wayfarer-2': { name: NAMES['wayfarer-2'], height: 20.0, build: o => buildB(o, 'wayfarer-2', SPEC['wayfarer-2'], { name: NAMES['wayfarer-2'], ...HOOKS['wayfarer-2'] }), src: 'rocketdb wayfarer-2 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'ember-finch-1': { name: NAMES['ember-finch-1'], height: 19.0, build: o => buildB(o, 'ember-finch-1', SPEC['ember-finch-1'], { name: NAMES['ember-finch-1'], ...HOOKS['ember-finch-1'] }), src: 'rocketdb ember-finch-1 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
};

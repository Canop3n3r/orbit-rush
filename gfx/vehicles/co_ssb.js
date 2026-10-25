// Southstar Design Bureau — tier B (generated from rocketdb stage tables + hooks): Cosmo-Kart family, Whirligig-2/3, Riverbend Silo-Hopper.
// Olive-grey military finish on the lower stages, white upper stages.
import { buildB } from './gen_b.js?v=f5.8w';
// display names: the only place they live (cheap to rename later)
export const NAMES = {'cosmokart-1': 'Cosmo-Kart', 'cosmokart-1b': 'Cosmo-Kart 1', 'cosmokart-2': 'Cosmo-Kart 2', 'cosmokart-3m': 'Cosmo-Kart 3M', 'whirligig-2': 'Whirligig-2', 'whirligig-3': 'Whirligig-3', 'riverbend': 'Riverbend Silo-Hopper'};
// stage tables (generated): r, L in m, ne = engines; sides = strap-ons; fair = payload fairing length
export const SPEC = {
  'cosmokart-1': { h: 31.5, stages: [{'r': 0.825, 'L': 18.0, 'ne': 1}, {'r': 0.825, 'L': 7.8, 'ne': 1}], sides: [], fair: { L: 4.5 } },
  'cosmokart-1b': { h: 31.5, stages: [{'r': 0.825, 'L': 18.0, 'ne': 1}, {'r': 0.825, 'L': 7.8, 'ne': 1}], sides: [], fair: { L: 4.5 } },
  'cosmokart-2': { h: 32.4, stages: [{'r': 1.2, 'L': 22.4, 'ne': 1}, {'r': 1.2, 'L': 6.0, 'ne': 1}], sides: [], fair: { L: 2.8 } },
  'cosmokart-3m': { h: 32.4, stages: [{'r': 1.2, 'L': 22.4, 'ne': 1}, {'r': 1.2, 'L': 6.0, 'ne': 1}], sides: [], fair: { L: 2.8 } },
  'whirligig-2': { h: 39.7, stages: [{'r': 1.5, 'L': 18.8, 'ne': 3}, {'r': 1.5, 'L': 9.4, 'ne': 1}], sides: [], fair: { L: 10.3 } },
  'whirligig-3': { h: 39.3, stages: [{'r': 1.5, 'L': 18.8, 'ne': 3}, {'r': 1.5, 'L': 10.1, 'ne': 1}, {'r': 1.1, 'L': 2.8, 'ne': 1}], sides: [], fair: { L: 6.4 } },
  'riverbend': { h: 34.3, stages: [{'r': 1.5, 'L': 22.3, 'ne': 3}, {'r': 1.5, 'L': 5.7, 'ne': 1}, {'r': 1.5, 'L': 1.0, 'ne': 1}], sides: [], fair: { L: 4.1 } },
};
// per-family tweak hooks (hand-edited): livery, bands, extra details
const OL = 0x6f7560, GR = 0x4d5448; // olive-grey / dark silo green
export const HOOKS = {
  'cosmokart-1': { lower: OL, upper: OL, bands: [[[17.2, 0.4]]] }, 'cosmokart-1b': { lower: OL, upper: 0xe6e6e0 },
  'cosmokart-2': { lower: OL, upper: OL }, 'cosmokart-3m': { lower: OL, upper: 0xe6e6e0, bands: [[[21.4, 0.5]], [[5.4, 0.3]]] },
  'whirligig-2': { lower: OL, upper: OL, olive: 2 }, 'whirligig-3': { lower: OL, upper: 0xe6e6e0, bands: [[[9.0, 0.5]]] },
  'riverbend': { lower: GR, upper: GR, olive: 3, fairKey: 'dark' },
};
export const CO_SOUTHSTAR_B = {
  'cosmokart-1': { name: NAMES['cosmokart-1'], height: 31.5, build: o => buildB(o, 'cosmokart-1', SPEC['cosmokart-1'], { name: NAMES['cosmokart-1'], ...HOOKS['cosmokart-1'] }), src: 'rocketdb cosmokart-1 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'cosmokart-1b': { name: NAMES['cosmokart-1b'], height: 31.5, build: o => buildB(o, 'cosmokart-1b', SPEC['cosmokart-1b'], { name: NAMES['cosmokart-1b'], ...HOOKS['cosmokart-1b'] }), src: 'rocketdb cosmokart-1b stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'cosmokart-2': { name: NAMES['cosmokart-2'], height: 32.4, build: o => buildB(o, 'cosmokart-2', SPEC['cosmokart-2'], { name: NAMES['cosmokart-2'], ...HOOKS['cosmokart-2'] }), src: 'rocketdb cosmokart-2 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'cosmokart-3m': { name: NAMES['cosmokart-3m'], height: 32.4, build: o => buildB(o, 'cosmokart-3m', SPEC['cosmokart-3m'], { name: NAMES['cosmokart-3m'], ...HOOKS['cosmokart-3m'] }), src: 'rocketdb cosmokart-3m stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'whirligig-2': { name: NAMES['whirligig-2'], height: 39.7, build: o => buildB(o, 'whirligig-2', SPEC['whirligig-2'], { name: NAMES['whirligig-2'], ...HOOKS['whirligig-2'] }), src: 'rocketdb whirligig-2 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'whirligig-3': { name: NAMES['whirligig-3'], height: 39.3, build: o => buildB(o, 'whirligig-3', SPEC['whirligig-3'], { name: NAMES['whirligig-3'], ...HOOKS['whirligig-3'] }), src: 'rocketdb whirligig-3 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'riverbend': { name: NAMES['riverbend'], height: 34.3, build: o => buildB(o, 'riverbend', SPEC['riverbend'], { name: NAMES['riverbend'], ...HOOKS['riverbend'] }), src: 'rocketdb riverbend stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
};

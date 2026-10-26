// Jade Sky Academy, tier B (stage-table generator + hooks): the Jade Lantern 1-12 families and Gale Runner-1. Off-white bodies.
import { buildB } from './gen_b.js?v=f5.9-9';
// display names: the only place they live (cheap to rename later)
export const NAMES = {'jade-lantern-1': 'Jade Lantern 1', 'jade-lantern-2': 'Jade Lantern 2', 'jade-lantern-2c': 'Jade Lantern 2C', 'jade-lantern-2d': 'Jade Lantern 2D', 'jade-lantern-2e': 'Jade Lantern 2E', 'jade-lantern-4': 'Jade Lantern 4', 'jade-lantern-6': 'Jade Lantern 6', 'jade-lantern-7': 'Jade Lantern 7', 'jade-lantern-8': 'Jade Lantern 8', 'jade-lantern-11': 'Jade Lantern 11', 'jade-lantern-12': 'Jade Lantern 12', 'gale-runner-1': 'Gale Runner-1'};
// stage tables (generated): r, L in m, ne = engines; sides = strap-ons; fair = payload fairing length
export const SPEC = {
  'jade-lantern-1': { h: 29.5, stages: [{'r': 1.125, 'L': 18.0, 'ne': 4}, {'r': 1.125, 'L': 5.4, 'ne': 1}, {'r': 0.385, 'L': 3.9, 'ne': 1}], sides: [], fair: { L: 1.0 } },
  'jade-lantern-2': { h: 31.2, stages: [{'r': 1.675, 'L': 20.5, 'ne': 4}, {'r': 1.675, 'L': 7.5, 'ne': 1}], sides: [], fair: { L: 2.0 } },
  'jade-lantern-2c': { h: 41.9, stages: [{'r': 1.675, 'L': 27.3, 'ne': 4}, {'r': 1.675, 'L': 11.3, 'ne': 1}], sides: [], fair: { L: 2.1 } },
  'jade-lantern-2d': { h: 38.3, stages: [{'r': 1.675, 'L': 24.7, 'ne': 4}, {'r': 1.675, 'L': 10.4, 'ne': 1}], sides: [], fair: { L: 2.0 } },
  'jade-lantern-2e': { h: 51.2, stages: [{'r': 1.675, 'L': 23.7, 'ne': 4}, {'r': 1.675, 'L': 15.5, 'ne': 1}], sides: [{'r': 1.125, 'L': 15.3, 'ne': 1}, {'r': 1.125, 'L': 15.3, 'ne': 1}, {'r': 1.125, 'L': 15.3, 'ne': 1}, {'r': 1.125, 'L': 15.3, 'ne': 1}], fair: { L: 10.8 } },
  'jade-lantern-4': { h: 43.1, stages: [{'r': 1.675, 'L': 24.7, 'ne': 4}, {'r': 1.675, 'L': 10.4, 'ne': 1}, {'r': 1.45, 'L': 1.9, 'ne': 1}], sides: [], fair: { L: 4.9 } },
  'jade-lantern-6': { h: 50.0, stages: [{'r': 1.675, 'L': 20.0, 'ne': 2}, {'r': 1.675, 'L': 11.5, 'ne': 1}], sides: [{'r': 1.0, 'L': 10.0, 'ne': 1}, {'r': 1.0, 'L': 10.0, 'ne': 1}, {'r': 1.0, 'L': 10.0, 'ne': 1}, {'r': 1.0, 'L': 10.0, 'ne': 1}], fair: { L: 17.3 } },
  'jade-lantern-7': { h: 55.0, stages: [{'r': 1.675, 'L': 26.0, 'ne': 2}, {'r': 1.675, 'L': 11.5, 'ne': 4}, {'r': 1.5, 'L': 12.4, 'ne': 2}], sides: [{'r': 1.125, 'L': 26.5, 'ne': 1}, {'r': 1.125, 'L': 26.5, 'ne': 1}, {'r': 1.125, 'L': 26.5, 'ne': 1}, {'r': 1.125, 'L': 26.5, 'ne': 1}], fair: { L: 3.9 } },
  'jade-lantern-8': { h: 53.1, stages: [{'r': 1.675, 'L': 26.0, 'ne': 2}, {'r': 1.5, 'L': 12.4, 'ne': 2}], sides: [{'r': 1.125, 'L': 26.5, 'ne': 1}, {'r': 1.125, 'L': 26.5, 'ne': 1}], fair: { L: 13.5 } },
  'jade-lantern-11': { h: 20.0, stages: [{'r': 1.0, 'L': 6.0, 'ne': 1}, {'r': 1.0, 'L': 6.0, 'ne': 1}, {'r': 0.9, 'L': 2.0, 'ne': 1}, {'r': 0.75, 'L': 1.5, 'ne': 1}], sides: [], fair: { L: 3.3 } },
  'jade-lantern-12': { h: 72.0, stages: [{'r': 2.185, 'L': 39.0, 'ne': 9}, {'r': 2.185, 'L': 10.0, 'ne': 1}], sides: [], fair: { L: 21.8 } },
  'gale-runner-1': { h: 32.6, stages: [{'r': 1.675, 'L': 20.2, 'ne': 4}, {'r': 1.675, 'L': 7.5, 'ne': 1}], sides: [], fair: { L: 3.7 } },
};
// per-family tweak hooks (hand-edited): livery, bands, extra details
export const HOOKS = {
  'jade-lantern-1': { lower: 0xf0efe8, upper: 0xf0efe8, sideKey: 0xf0efe8 },
  'jade-lantern-2': { lower: 0xf0efe8, upper: 0xf0efe8, sideKey: 0xf0efe8 },
  'jade-lantern-2c': { lower: 0xf0efe8, upper: 0xf0efe8, sideKey: 0xf0efe8 },
  'jade-lantern-2d': { lower: 0xf0efe8, upper: 0xf0efe8, sideKey: 0xf0efe8 },
  'jade-lantern-2e': { step: 1, lower: 0xf0efe8, upper: 0xf0efe8, sideKey: 0xf0efe8 },
  'jade-lantern-4': { lower: 0xf0efe8, upper: 0xf0efe8, sideKey: 0xf0efe8 },
  'jade-lantern-6': { step: 1, lower: 0xf0efe8, upper: 0xf0efe8, sideKey: 0xf0efe8 },
  'jade-lantern-7': { step: 1, lower: 0xf0efe8, upper: 0xf0efe8, sideKey: 0xf0efe8 },
  'jade-lantern-8': { step: 1, lower: 0xf0efe8, upper: 0xf0efe8, sideKey: 0xf0efe8 },
  'jade-lantern-11': { lower: 0xf0efe8, upper: 0xf0efe8, sideKey: 0xf0efe8 },
  'jade-lantern-12': { step: 1, lower: 0xf0efe8, upper: 0xf0efe8, sideKey: 0xf0efe8 },
  'gale-runner-1': { lower: 0xf0efe8, upper: 0xf0efe8, sideKey: 0xf0efe8 },
};
export const CO_JADE_B = {
  'jade-lantern-1': { name: NAMES['jade-lantern-1'], height: 29.5, build: o => buildB(o, 'jade-lantern-1', SPEC['jade-lantern-1'], { name: NAMES['jade-lantern-1'], ...HOOKS['jade-lantern-1'] }), src: 'rocketdb jade-lantern-1 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'jade-lantern-2': { name: NAMES['jade-lantern-2'], height: 31.2, build: o => buildB(o, 'jade-lantern-2', SPEC['jade-lantern-2'], { name: NAMES['jade-lantern-2'], ...HOOKS['jade-lantern-2'] }), src: 'rocketdb jade-lantern-2 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'jade-lantern-2c': { name: NAMES['jade-lantern-2c'], height: 41.9, build: o => buildB(o, 'jade-lantern-2c', SPEC['jade-lantern-2c'], { name: NAMES['jade-lantern-2c'], ...HOOKS['jade-lantern-2c'] }), src: 'rocketdb jade-lantern-2c stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'jade-lantern-2d': { name: NAMES['jade-lantern-2d'], height: 38.3, build: o => buildB(o, 'jade-lantern-2d', SPEC['jade-lantern-2d'], { name: NAMES['jade-lantern-2d'], ...HOOKS['jade-lantern-2d'] }), src: 'rocketdb jade-lantern-2d stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'jade-lantern-2e': { name: NAMES['jade-lantern-2e'], height: 51.2, build: o => buildB(o, 'jade-lantern-2e', SPEC['jade-lantern-2e'], { name: NAMES['jade-lantern-2e'], ...HOOKS['jade-lantern-2e'] }), src: 'rocketdb jade-lantern-2e stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'jade-lantern-4': { name: NAMES['jade-lantern-4'], height: 43.1, build: o => buildB(o, 'jade-lantern-4', SPEC['jade-lantern-4'], { name: NAMES['jade-lantern-4'], ...HOOKS['jade-lantern-4'] }), src: 'rocketdb jade-lantern-4 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'jade-lantern-6': { name: NAMES['jade-lantern-6'], height: 50.0, build: o => buildB(o, 'jade-lantern-6', SPEC['jade-lantern-6'], { name: NAMES['jade-lantern-6'], ...HOOKS['jade-lantern-6'] }), src: 'rocketdb jade-lantern-6 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'jade-lantern-7': { name: NAMES['jade-lantern-7'], height: 55.0, build: o => buildB(o, 'jade-lantern-7', SPEC['jade-lantern-7'], { name: NAMES['jade-lantern-7'], ...HOOKS['jade-lantern-7'] }), src: 'rocketdb jade-lantern-7 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'jade-lantern-8': { name: NAMES['jade-lantern-8'], height: 53.1, build: o => buildB(o, 'jade-lantern-8', SPEC['jade-lantern-8'], { name: NAMES['jade-lantern-8'], ...HOOKS['jade-lantern-8'] }), src: 'rocketdb jade-lantern-8 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'jade-lantern-11': { name: NAMES['jade-lantern-11'], height: 20.0, build: o => buildB(o, 'jade-lantern-11', SPEC['jade-lantern-11'], { name: NAMES['jade-lantern-11'], ...HOOKS['jade-lantern-11'] }), src: 'rocketdb jade-lantern-11 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'jade-lantern-12': { name: NAMES['jade-lantern-12'], height: 72.0, build: o => buildB(o, 'jade-lantern-12', SPEC['jade-lantern-12'], { name: NAMES['jade-lantern-12'], ...HOOKS['jade-lantern-12'] }), src: 'rocketdb jade-lantern-12 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'gale-runner-1': { name: NAMES['gale-runner-1'], height: 32.6, build: o => buildB(o, 'gale-runner-1', SPEC['gale-runner-1'], { name: NAMES['gale-runner-1'], ...HOOKS['gale-runner-1'] }), src: 'rocketdb gale-runner-1 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
};

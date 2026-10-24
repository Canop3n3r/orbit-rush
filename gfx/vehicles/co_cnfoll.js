// Orient Commercial Launch Collective, tier B (stage-table generator + hooks): Kite-1/3, Ballast-1, Granite-2, Lifttop-1, OneStep-M1, Parabolica-1. White bodies.
import { buildB } from './gen_b.js?v=f5.8r';
// display names: the only place they live (cheap to rename later)
export const NAMES = {'kite-1': 'Kite-1', 'kite-3': 'Kite-3', 'ballast-1': 'Ballast-1', 'granite-2': 'Granite-2', 'lifttop-1': 'Lifttop-1', 'onestep-m1': 'OneStep-M1', 'parabolica-1': 'Parabolica-1'};
// stage tables (generated): r, L in m, ne = engines; sides = strap-ons; fair = payload fairing length
export const SPEC = {
  'kite-1': { h: 19.5, stages: [{'r': 0.6, 'L': 7.0, 'ne': 1}, {'r': 0.6, 'L': 7.0, 'ne': 1}, {'r': 0.6, 'L': 2.0, 'ne': 1}, {'r': 0.6, 'L': 2.0, 'ne': 1}], sides: [], fair: { L: 0.3 } },
  'kite-3': { h: 31.0, stages: [{'r': 1.325, 'L': 12.30, 'ne': 1}, {'r': 1.325, 'L': 9.23, 'ne': 1}, {'r': 1.0, 'L': 6.15, 'ne': 1}, {'r': 0.6, 'L': 1.54, 'ne': 1}], sides: [], fair: { L: 0.00 } },
  'ballast-1': { h: 29.0, stages: [{'r': 1.325, 'L': 12.0, 'ne': 1}, {'r': 1.325, 'L': 10.0, 'ne': 1}, {'r': 1.0, 'L': 2.0, 'ne': 1}], sides: [{'r': 1.325, 'L': 12.0, 'ne': 1}, {'r': 1.325, 'L': 12.0, 'ne': 1}, {'r': 1.325, 'L': 12.0, 'ne': 1}, {'r': 1.325, 'L': 12.0, 'ne': 1}], fair: { L: 3.8 } },
  'granite-2': { h: 56.0, stages: [{'r': 1.675, 'L': 26.0, 'ne': 9}, {'r': 1.675, 'L': 13.0, 'ne': 1}], sides: [], fair: { L: 15.8 } },
  'lifttop-1': { h: 30.0, stages: [{'r': 1.325, 'L': 9.56, 'ne': 1}, {'r': 1.325, 'L': 7.17, 'ne': 1}, {'r': 1.0, 'L': 4.78, 'ne': 1}, {'r': 0.6, 'L': 1.20, 'ne': 1}], sides: [], fair: { L: 6.45 } },
  'onestep-m1': { h: 19.0, stages: [{'r': 0.44, 'L': 7.4, 'ne': 1}, {'r': 0.44, 'L': 7.4, 'ne': 1}, {'r': 0.3, 'L': 5.0, 'ne': 1}, {'r': 0.25, 'L': 1.0, 'ne': 1}], sides: [], fair: { L: 0 } },
  'parabolica-1': { h: 24.0, stages: [{'r': 0.7, 'L': 8.7, 'ne': 1}, {'r': 0.7, 'L': 6.7, 'ne': 1}, {'r': 0.7, 'L': 2.6, 'ne': 1}, {'r': 0.7, 'L': 1.9, 'ne': 1}], sides: [], fair: { L: 2.9 } },
};
// per-family tweak hooks (hand-edited): livery, bands, extra details
export const HOOKS = {
  'kite-1': { lower: 0xeeeeea, upper: 0xeeeeea, sideKey: 0xeeeeea },
  'kite-3': { lower: 0xeeeeea, upper: 0xeeeeea, sideKey: 0xeeeeea },
  'granite-2': { lower: 0xeeeeea, upper: 0xeeeeea, sideKey: 0xeeeeea },
  'lifttop-1': { lower: 0xeeeeea, upper: 0xeeeeea, sideKey: 0xeeeeea },
  'onestep-m1': { lower: 0xeeeeea, upper: 0xeeeeea, sideKey: 0xeeeeea },
  'parabolica-1': { lower: 0xeeeeea, upper: 0xeeeeea, sideKey: 0xeeeeea },
  'ballast-1': { step: 1, plainSides: 1, lower: 0xeeeeea, upper: 0xeeeeea, sideKey: 0xeeeeea },
};
export const CO_CNFOLL = {
  'kite-1': { name: NAMES['kite-1'], height: 19.5, build: o => buildB(o, 'kite-1', SPEC['kite-1'], { name: NAMES['kite-1'], ...HOOKS['kite-1'] }), src: 'rocketdb kite-1 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'kite-3': { name: NAMES['kite-3'], height: 31.0, build: o => buildB(o, 'kite-3', SPEC['kite-3'], { name: NAMES['kite-3'], ...HOOKS['kite-3'] }), src: 'rocketdb kite-3 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'ballast-1': { name: NAMES['ballast-1'], height: 29.0, build: o => buildB(o, 'ballast-1', SPEC['ballast-1'], { name: NAMES['ballast-1'], ...HOOKS['ballast-1'] }), src: 'rocketdb ballast-1 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'granite-2': { name: NAMES['granite-2'], height: 56.0, build: o => buildB(o, 'granite-2', SPEC['granite-2'], { name: NAMES['granite-2'], ...HOOKS['granite-2'] }), src: 'rocketdb granite-2 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'lifttop-1': { name: NAMES['lifttop-1'], height: 30.0, build: o => buildB(o, 'lifttop-1', SPEC['lifttop-1'], { name: NAMES['lifttop-1'], ...HOOKS['lifttop-1'] }), src: 'rocketdb lifttop-1 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'onestep-m1': { name: NAMES['onestep-m1'], height: 19.0, build: o => buildB(o, 'onestep-m1', SPEC['onestep-m1'], { name: NAMES['onestep-m1'], ...HOOKS['onestep-m1'] }), src: 'rocketdb onestep-m1 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'parabolica-1': { name: NAMES['parabolica-1'], height: 24.0, build: o => buildB(o, 'parabolica-1', SPEC['parabolica-1'], { name: NAMES['parabolica-1'], ...HOOKS['parabolica-1'] }), src: 'rocketdb parabolica-1 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
};

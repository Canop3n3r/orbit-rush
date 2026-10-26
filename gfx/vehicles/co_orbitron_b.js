// Orbitron Sciences, tier B (stage-table generator + hooks): Conestogo, Minotaurus I/II, Minotaurus IV/V, Taurox. White with grey bands.
import { buildB } from './gen_b.js?v=f5.9-7';
// display names: the only place they live (cheap to rename later)
export const NAMES = {'conestogo': 'Conestogo', 'minotaurus-1': 'Minotaurus I/II', 'minotaurus-4': 'Minotaurus IV/V', 'taurox': 'Taurox'};
// stage tables (generated): r, L in m, ne = engines; sides = strap-ons; fair = payload fairing length
export const SPEC = {
  'conestogo': { h: 15.2, stages: [{'r': 0.51, 'L': 6.31, 'ne': 1}, {'r': 0.51, 'L': 6.31, 'ne': 1}, {'r': 0.61, 'L': 1.43, 'ne': 1}], sides: [{'r': 0.51, 'L': 6.31, 'ne': 1}, {'r': 0.51, 'L': 6.31, 'ne': 1}, {'r': 0.51, 'L': 6.31, 'ne': 1}, {'r': 0.51, 'L': 6.31, 'ne': 1}], fair: { L: 0.00 } },
  'minotaurus-1': { h: 19.2, stages: [{'r': 0.84, 'L': 7.5, 'ne': 1}, {'r': 0.66, 'L': 4.1, 'ne': 1}, {'r': 0.635, 'L': 3.7, 'ne': 1}, {'r': 0.485, 'L': 1.3, 'ne': 1}], sides: [], fair: { L: 1.4 } },
  'minotaurus-4': { h: 23.9, stages: [{'r': 1.175, 'L': 8.4, 'ne': 1}, {'r': 1.175, 'L': 5.3, 'ne': 1}, {'r': 1.175, 'L': 2.3, 'ne': 1}, {'r': 1.175, 'L': 2.1, 'ne': 1}, {'r': 0.5, 'L': 0.8, 'ne': 3}], sides: [], fair: { L: 3.8 } },
  'taurox': { h: 31.6, stages: [{'r': 1.15, 'L': 10.7, 'ne': 1}, {'r': 0.635, 'L': 10.0, 'ne': 1}, {'r': 0.635, 'L': 3.7, 'ne': 1}, {'r': 0.485, 'L': 1.3, 'ne': 1}], sides: [], fair: { L: 4.7 } },
};
// per-family tweak hooks (hand-edited): livery, bands, extra details
export const HOOKS = {
  'conestogo': { step: 1, plainSides: 1, lower: 0xeeeeea, upper: 0xeeeeea, sideKey: 0xeeeeea },
  'minotaurus-1': { lower: 0xeeeeea, upper: 0xeeeeea, sideKey: 0xeeeeea },
  'minotaurus-4': { step: 1, lower: 0xeeeeea, upper: 0xeeeeea, sideKey: 0xeeeeea },
  'taurox': { lower: 0xeeeeea, upper: 0xeeeeea, sideKey: 0xeeeeea },
};
export const CO_ORBITRON_B = {
  'conestogo': { name: NAMES['conestogo'], height: 15.2, build: o => buildB(o, 'conestogo', SPEC['conestogo'], { name: NAMES['conestogo'], ...HOOKS['conestogo'] }), src: 'rocketdb conestogo stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'minotaurus-1': { name: NAMES['minotaurus-1'], height: 19.2, build: o => buildB(o, 'minotaurus-1', SPEC['minotaurus-1'], { name: NAMES['minotaurus-1'], ...HOOKS['minotaurus-1'] }), src: 'rocketdb minotaurus-1 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'minotaurus-4': { name: NAMES['minotaurus-4'], height: 23.9, build: o => buildB(o, 'minotaurus-4', SPEC['minotaurus-4'], { name: NAMES['minotaurus-4'], ...HOOKS['minotaurus-4'] }), src: 'rocketdb minotaurus-4 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'taurox': { name: NAMES['taurox'], height: 31.6, build: o => buildB(o, 'taurox', SPEC['taurox'], { name: NAMES['taurox'], ...HOOKS['taurox'] }), src: 'rocketdb taurox stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
};

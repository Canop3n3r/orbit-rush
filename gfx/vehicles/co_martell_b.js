// Martell Aerospace, tier B (stage-table generator + hooks): Titanus III with its twin solid boosters, Athenix solid stack.
import { buildB } from './gen_b.js?v=f5.9-5';
// display names: the only place they live (cheap to rename later)
export const NAMES = {'titanus-3': 'Titanus III', 'athenix': 'Athenix'};
// stage tables (generated): r, L in m, ne = engines; sides = strap-ons; fair = payload fairing length
export const SPEC = {
  'titanus-3': { h: 48.8, stages: [{'r': 1.525, 'L': 23.8, 'ne': 2}, {'r': 1.525, 'L': 9.6, 'ne': 1}, {'r': 1.525, 'L': 9.6, 'ne': 2}], sides: [{'r': 1.555, 'L': 25.9, 'ne': 1}, {'r': 1.555, 'L': 25.9, 'ne': 1}], fair: { L: 4.6 } },
  'athenix': { h: 28.2, stages: [{'r': 1.15, 'L': 10.7, 'ne': 1}, {'r': 1.15, 'L': 10.7, 'ne': 1}, {'r': 1.15, 'L': 3.0, 'ne': 1}, {'r': 1.15, 'L': 1.0, 'ne': 4}], sides: [], fair: { L: 1.6 } },
};
// per-family tweak hooks (hand-edited): livery, bands, extra details
export const HOOKS = {
  'titanus-3': { step: 1, lower: 0x6f7378, upper: 0x6f7378, sideKey: 0xe8e6df, olive: 3, hideBells: [2] },
  'athenix': { step: 1, lower: 0xdedcd4, upper: 0xdedcd4, hideBells: [3] },
};
export const CO_MARTELL_B = {
  'titanus-3': { name: NAMES['titanus-3'], height: 48.8, build: o => buildB(o, 'titanus-3', SPEC['titanus-3'], { name: NAMES['titanus-3'], ...HOOKS['titanus-3'] }), src: 'rocketdb titanus-3 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'athenix': { name: NAMES['athenix'], height: 28.2, build: o => buildB(o, 'athenix', SPEC['athenix'], { name: NAMES['athenix'], ...HOOKS['athenix'] }), src: 'rocketdb athenix stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
};

// ISRA, tier B (stage-table generator + hooks): Geo Sat-Slinger, Sat-Slinger Mini, Sat-Slinger Mk3. White core, brown strap-ons.
import { buildB } from './gen_b.js?v=f5.8y';
// display names: the only place they live (cheap to rename later)
export const NAMES = {'geo-slinger': 'Geo Sat-Slinger', 'slinger-mini': 'Sat-Slinger Mini', 'slinger-mk3': 'Sat-Slinger Mk3'};
// stage tables (generated): r, L in m, ne = engines; sides = strap-ons; fair = payload fairing length
export const SPEC = {
  'geo-slinger': { h: 50.1, stages: [{'r': 1.4, 'L': 20.0, 'ne': 1}, {'r': 1.4, 'L': 11.6, 'ne': 1}, {'r': 1.4, 'L': 8.7, 'ne': 1}], sides: [{'r': 1.05, 'L': 19.7, 'ne': 1}, {'r': 1.05, 'L': 19.7, 'ne': 1}, {'r': 1.05, 'L': 19.7, 'ne': 1}, {'r': 1.05, 'L': 19.7, 'ne': 1}], fair: { L: 8.6 } },
  'slinger-mini': { h: 34.0, stages: [{'r': 1.0, 'L': 22.5, 'ne': 1}, {'r': 1.0, 'L': 3.2, 'ne': 1}, {'r': 0.85, 'L': 2.8, 'ne': 1}, {'r': 0.85, 'L': 1.0, 'ne': 12}], sides: [], fair: { L: 3.3 } },
  'slinger-mk3': { h: 23.6, stages: [{'r': 0.5, 'L': 9.8, 'ne': 1}, {'r': 0.4, 'L': 6.4, 'ne': 1}, {'r': 0.4, 'L': 2.4, 'ne': 1}, {'r': 0.33, 'L': 1.5, 'ne': 1}], sides: [], fair: { L: 2.3 } },
};
// per-family tweak hooks (hand-edited): livery, bands, extra details
export const HOOKS = {
  'geo-slinger': { step: 1, plainSides: 1, lower: 0xeeeeea, upper: 0xeeeeea, sideKey: 0x8a6a4a },
  'slinger-mini': { step: 1, hideBells: [3], lower: 0xeeeeea, upper: 0xeeeeea, sideKey: 0xeeeeea },
  'slinger-mk3': { lower: 0xeeeeea, upper: 0xeeeeea, sideKey: 0xeeeeea },
};
export const CO_ISRA_B = {
  'geo-slinger': { name: NAMES['geo-slinger'], height: 50.1, build: o => buildB(o, 'geo-slinger', SPEC['geo-slinger'], { name: NAMES['geo-slinger'], ...HOOKS['geo-slinger'] }), src: 'rocketdb geo-slinger stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'slinger-mini': { name: NAMES['slinger-mini'], height: 34.0, build: o => buildB(o, 'slinger-mini', SPEC['slinger-mini'], { name: NAMES['slinger-mini'], ...HOOKS['slinger-mini'] }), src: 'rocketdb slinger-mini stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'slinger-mk3': { name: NAMES['slinger-mk3'], height: 23.6, build: o => buildB(o, 'slinger-mk3', SPEC['slinger-mk3'], { name: NAMES['slinger-mk3'], ...HOOKS['slinger-mk3'] }), src: 'rocketdb slinger-mk3 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
};

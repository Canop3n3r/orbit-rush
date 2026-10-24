// Krasnaya Orbita Bureau, tier B (stage-table generator + hooks): Kometa, four tapered strap-ons with four-chamber engines, waisted core, crew fairing. Pale grey-green.
import { buildB } from './gen_b.js?v=f5.8u';
// display names: the only place they live (cheap to rename later)
export const NAMES = {'kometa': 'Kometa'};
// stage tables (generated): r, L in m, ne = engines; sides = strap-ons; fair = payload fairing length
export const SPEC = {
  'kometa': { h: 44.0, stages: [{'r': 1.475, 'L': 28.0, 'ne': 1}, {'r': 1.33, 'L': 6.7, 'ne': 1}], sides: [{'r': 1.35, 'L': 19.0, 'ne': 1}, {'r': 1.35, 'L': 19.0, 'ne': 1}, {'r': 1.35, 'L': 19.0, 'ne': 1}, {'r': 1.35, 'L': 19.0, 'ne': 1}], fair: { L: 8.1 } },
};
// per-family tweak hooks (hand-edited): livery, bands, extra details
export const HOOKS = {
  'kometa': { step: 1, lower: 0xa9b3a2, upper: 0xa9b3a2, olive: 3, ne: [4, 1], sideNe: 4, sideTop: 0.28, sideKey: 0xd8dbd4, r1: [1.3, 1.33], bands: [[[26.8, 0.6]], [[0, 0.5]]] },
};
export const CO_KOMETA = {
  'kometa': { name: NAMES['kometa'], height: 44.0, build: o => buildB(o, 'kometa', SPEC['kometa'], { name: NAMES['kometa'], ...HOOKS['kometa'] }), src: 'rocketdb kometa stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
};

// Doug-Wing Aerospace, tier B (stage-table generator + hooks): Thorin family and early Deltoid. Teal first stage, white uppers.
import { buildB } from './gen_b.js?v=f5.9-1';
// display names: the only place they live (cheap to rename later)
export const NAMES = {'thorin': 'Thorin', 'thorin-agenta': 'Thorin-Agenta', 'thorin-capable': 'Thorin-Capable', 'thorin-capablestar': 'Thorin-Capable Star', 'thorin-toaster': 'Thorin-Toaster', 'deltoid': 'Deltoid', 'deltoid-3': 'Deltoid III'};
// stage tables (generated): r, L in m, ne = engines; sides = strap-ons; fair = payload fairing length
export const SPEC = {
  'thorin': { h: 23.0, stages: [{'r': 1.22, 'L': 18.6, 'ne': 1}, {'r': 0.47, 'L': 1.7, 'ne': 1}], sides: [], fair: { L: 1.5 } },
  'thorin-agenta': { h: 32.9, stages: [{'r': 1.22, 'L': 21.0, 'ne': 1}, {'r': 0.76, 'L': 6.2, 'ne': 1}], sides: [{'r': 0.395, 'L': 6.0, 'ne': 1}, {'r': 0.395, 'L': 6.0, 'ne': 1}, {'r': 0.395, 'L': 6.0, 'ne': 1}], fair: { L: 4.5 } },
  'thorin-capable': { h: 27.8, stages: [{'r': 1.22, 'L': 18.6, 'ne': 1}, {'r': 0.405, 'L': 5.8, 'ne': 1}, {'r': 0.23, 'L': 1.8, 'ne': 1}], sides: [], fair: { L: 0.4 } },
  'thorin-capablestar': { h: 23.8, stages: [{'r': 1.22, 'L': 17.1, 'ne': 1}, {'r': 0.695, 'L': 4.5, 'ne': 1}], sides: [], fair: { L: 1.0 } },
  'thorin-toaster': { h: 23.0, stages: [{'r': 1.22, 'L': 18.6, 'ne': 1}, {'r': 0.23, 'L': 1.5, 'ne': 1}], sides: [], fair: { L: 1.7 } },
  'deltoid': { h: 36.0, stages: [{'r': 1.22, 'L': 22.4, 'ne': 1}, {'r': 0.875, 'L': 6.0, 'ne': 1}, {'r': 0.61, 'L': 2.0, 'ne': 1}], sides: [{'r': 0.51, 'L': 9.7, 'ne': 1}, {'r': 0.51, 'L': 9.7, 'ne': 1}, {'r': 0.51, 'L': 9.7, 'ne': 1}, {'r': 0.51, 'L': 9.7, 'ne': 1}, {'r': 0.51, 'L': 9.7, 'ne': 1}, {'r': 0.51, 'L': 9.7, 'ne': 1}, {'r': 0.51, 'L': 9.7, 'ne': 1}, {'r': 0.51, 'L': 9.7, 'ne': 1}, {'r': 0.51, 'L': 9.7, 'ne': 1}], fair: { L: 4.4 } },
  'deltoid-3': { h: 39.1, stages: [{'r': 1.22, 'L': 20.0, 'ne': 1}, {'r': 2.0, 'L': 8.8, 'ne': 1}], sides: [{'r': 0.585, 'L': 14.7, 'ne': 1}, {'r': 0.585, 'L': 14.7, 'ne': 1}, {'r': 0.585, 'L': 14.7, 'ne': 1}, {'r': 0.585, 'L': 14.7, 'ne': 1}, {'r': 0.585, 'L': 14.7, 'ne': 1}, {'r': 0.585, 'L': 14.7, 'ne': 1}, {'r': 0.585, 'L': 14.7, 'ne': 1}, {'r': 0.585, 'L': 14.7, 'ne': 1}, {'r': 0.585, 'L': 14.7, 'ne': 1}], fair: { L: 9.1 } },
};
// per-family tweak hooks (hand-edited): livery, bands, extra details
export const HOOKS = {
  'thorin': { lower: 0x3f8f8a, upper: 0xe6e6e0, sideKey: 0xe6e6e0, olive: 1 },
  'thorin-capable': { lower: 0x3f8f8a, upper: 0xe6e6e0, sideKey: 0xe6e6e0, olive: 1 },
  'thorin-capablestar': { lower: 0x3f8f8a, upper: 0xe6e6e0, sideKey: 0xe6e6e0, olive: 1 },
  'thorin-toaster': { lower: 0x3f8f8a, upper: 0xe6e6e0, sideKey: 0xe6e6e0, olive: 1 },
  'thorin-agenta': { step: 1, lower: 0x3f8f8a, upper: 0xe6e6e0, sideKey: 0xe6e6e0, olive: 1 },
  'deltoid': { step: 1, hideBells: [1, 2], sideNoseHi: 1, plainSides: 1, sideTop: 0.9, lower: 0x3f8f8a, upper: 0xe6e6e0, sideKey: 0xe6e6e0, olive: 1 },
  'deltoid-3': { step: 1, plainSides: 1, sideTop: 0.9, lower: 0x3f8f8a, upper: 0xe6e6e0, sideKey: 0xe6e6e0, olive: 1 },
};
export const CO_DOUGWING_B = {
  'thorin': { name: NAMES['thorin'], height: 23.0, build: o => buildB(o, 'thorin', SPEC['thorin'], { name: NAMES['thorin'], ...HOOKS['thorin'] }), src: 'rocketdb thorin stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'thorin-agenta': { name: NAMES['thorin-agenta'], height: 32.9, build: o => buildB(o, 'thorin-agenta', SPEC['thorin-agenta'], { name: NAMES['thorin-agenta'], ...HOOKS['thorin-agenta'] }), src: 'rocketdb thorin-agenta stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'thorin-capable': { name: NAMES['thorin-capable'], height: 27.8, build: o => buildB(o, 'thorin-capable', SPEC['thorin-capable'], { name: NAMES['thorin-capable'], ...HOOKS['thorin-capable'] }), src: 'rocketdb thorin-capable stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'thorin-capablestar': { name: NAMES['thorin-capablestar'], height: 23.8, build: o => buildB(o, 'thorin-capablestar', SPEC['thorin-capablestar'], { name: NAMES['thorin-capablestar'], ...HOOKS['thorin-capablestar'] }), src: 'rocketdb thorin-capablestar stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'thorin-toaster': { name: NAMES['thorin-toaster'], height: 23.0, build: o => buildB(o, 'thorin-toaster', SPEC['thorin-toaster'], { name: NAMES['thorin-toaster'], ...HOOKS['thorin-toaster'] }), src: 'rocketdb thorin-toaster stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'deltoid': { name: NAMES['deltoid'], height: 36.0, build: o => buildB(o, 'deltoid', SPEC['deltoid'], { name: NAMES['deltoid'], ...HOOKS['deltoid'] }), src: 'rocketdb deltoid stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'deltoid-3': { name: NAMES['deltoid-3'], height: 39.1, build: o => buildB(o, 'deltoid-3', SPEC['deltoid-3'], { name: NAMES['deltoid-3'], ...HOOKS['deltoid-3'] }), src: 'rocketdb deltoid-3 stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
};

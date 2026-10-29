// JAXO, tier B (stage-table generator + hooks): Epsilonix, Hoshi-M/V, Kago Sounder, Kawasemi, Mejiro, Samba-4S, Uguisu. White bodies, nine-strap-on rings on the Kawasemi/Uguisu cores.
import { buildB } from './gen_b.js?v=f5.9-12';
// display names: the only place they live (cheap to rename later)
export const NAMES = {'epsilonix': 'Epsilonix', 'hoshi-m': 'Hoshi-M', 'hoshi-v': 'Hoshi-V', 'kago-sounder': 'Kago Sounder', 'kawasemi': 'Kawasemi', 'mejiro': 'Mejiro', 'samba-4s': 'Samba-4S', 'uguisu': 'Uguisu'};
// stage tables (generated): r, L in m, ne = engines; sides = strap-ons; fair = payload fairing length
export const SPEC = {
  'epsilonix': { h: 26.0, stages: [{'r': 1.3, 'L': 11.7, 'ne': 1}, {'r': 1.3, 'L': 4.0, 'ne': 1}, {'r': 0.7, 'L': 2.2, 'ne': 1}], sides: [], fair: { L: 6.9 } },
  'hoshi-m': { h: 27.8, stages: [{'r': 0.705, 'L': 14.8, 'ne': 1}, {'r': 0.705, 'L': 6.2, 'ne': 1}, {'r': 0.75, 'L': 2.7, 'ne': 1}], sides: [{'r': 0.37, 'L': 9.1, 'ne': 1}, {'r': 0.37, 'L': 9.1, 'ne': 1}], fair: { L: 2.9 } },
  'hoshi-v': { h: 30.7, stages: [{'r': 1.255, 'L': 14.1, 'ne': 1}, {'r': 1.255, 'L': 6.6, 'ne': 1}, {'r': 1.1, 'L': 3.4, 'ne': 1}], sides: [], fair: { L: 5.4 } },
  'kago-sounder': { h: 9.7, stages: [{'r': 0.26, 'L': 5.9, 'ne': 1}, {'r': 0.26, 'L': 1.7, 'ne': 1}], sides: [], fair: { L: 0.9 } },
  'kawasemi': { h: 42.0, stages: [{'r': 1.22, 'L': 22.4, 'ne': 1}, {'r': 1.22, 'L': 9.3, 'ne': 1}], sides: [{'r': 0.395, 'L': 6.0, 'ne': 1}, {'r': 0.395, 'L': 6.0, 'ne': 1}, {'r': 0.395, 'L': 6.0, 'ne': 1}, {'r': 0.395, 'L': 6.0, 'ne': 1}, {'r': 0.395, 'L': 6.0, 'ne': 1}, {'r': 0.395, 'L': 6.0, 'ne': 1}, {'r': 0.395, 'L': 6.0, 'ne': 1}, {'r': 0.395, 'L': 6.0, 'ne': 1}, {'r': 0.395, 'L': 6.0, 'ne': 1}], fair: { L: 9.1 } },
  'mejiro': { h: 33.0, stages: [{'r': 1.22, 'L': 20.3, 'ne': 1}, {'r': 0.81, 'L': 5.4, 'ne': 1}, {'r': 0.47, 'L': 1.7, 'ne': 1}], sides: [{'r': 0.395, 'L': 6.0, 'ne': 1}, {'r': 0.395, 'L': 6.0, 'ne': 1}, {'r': 0.395, 'L': 6.0, 'ne': 1}], fair: { L: 4.4 } },
  'samba-4s': { h: 16.5, stages: [{'r': 0.37, 'L': 8.4, 'ne': 1}, {'r': 0.37, 'L': 3.9, 'ne': 1}, {'r': 0.25, 'L': 2.5, 'ne': 1}, {'r': 0.24, 'L': 0.5, 'ne': 1}], sides: [{'r': 0.155, 'L': 5.8, 'ne': 1}, {'r': 0.155, 'L': 5.8, 'ne': 1}], fair: { L: 0 } },
  'uguisu': { h: 35.0, stages: [{'r': 1.22, 'L': 22.4, 'ne': 1}, {'r': 0.875, 'L': 6.3, 'ne': 1}, {'r': 0.47, 'L': 1.7, 'ne': 1}], sides: [{'r': 0.395, 'L': 6.0, 'ne': 1}, {'r': 0.395, 'L': 6.0, 'ne': 1}, {'r': 0.395, 'L': 6.0, 'ne': 1}, {'r': 0.395, 'L': 6.0, 'ne': 1}, {'r': 0.395, 'L': 6.0, 'ne': 1}, {'r': 0.395, 'L': 6.0, 'ne': 1}, {'r': 0.395, 'L': 6.0, 'ne': 1}, {'r': 0.395, 'L': 6.0, 'ne': 1}, {'r': 0.395, 'L': 6.0, 'ne': 1}], fair: { L: 3.4 } },
};
// per-family tweak hooks (hand-edited): livery, bands, extra details
export const HOOKS = {
  'epsilonix': { lower: 0xeeeeea, upper: 0xeeeeea, sideKey: 0xeeeeea },
  'hoshi-m': { step: 1, lower: 0xeeeeea, upper: 0xeeeeea, sideKey: 0xeeeeea },
  'hoshi-v': { lower: 0xeeeeea, upper: 0xeeeeea, sideKey: 0xeeeeea },
  'kago-sounder': { lower: 0xeeeeea, upper: 0xeeeeea, sideKey: 0xeeeeea },
  'mejiro': { step: 1, plainSides: 1, lower: 0xeeeeea, upper: 0xeeeeea, sideKey: 0xeeeeea },
  'samba-4s': { step: 1, lower: 0xeeeeea, upper: 0xeeeeea, sideKey: 0xeeeeea },
  'kawasemi': { step: 1, plainSides: 1, sideNoseHi: 1, lower: 0xeeeeea, upper: 0xeeeeea, sideKey: 0xeeeeea },
  'uguisu': { step: 1, plainSides: 1, sideNoseHi: 1, lower: 0xeeeeea, upper: 0xeeeeea, sideKey: 0xeeeeea },
};
export const CO_JAXO_B = {
  'epsilonix': { name: NAMES['epsilonix'], height: 26.0, build: o => buildB(o, 'epsilonix', SPEC['epsilonix'], { name: NAMES['epsilonix'], ...HOOKS['epsilonix'] }), src: 'rocketdb epsilonix stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'hoshi-m': { name: NAMES['hoshi-m'], height: 27.8, build: o => buildB(o, 'hoshi-m', SPEC['hoshi-m'], { name: NAMES['hoshi-m'], ...HOOKS['hoshi-m'] }), src: 'rocketdb hoshi-m stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'hoshi-v': { name: NAMES['hoshi-v'], height: 30.7, build: o => buildB(o, 'hoshi-v', SPEC['hoshi-v'], { name: NAMES['hoshi-v'], ...HOOKS['hoshi-v'] }), src: 'rocketdb hoshi-v stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'kago-sounder': { name: NAMES['kago-sounder'], height: 9.7, build: o => buildB(o, 'kago-sounder', SPEC['kago-sounder'], { name: NAMES['kago-sounder'], ...HOOKS['kago-sounder'] }), src: 'rocketdb kago-sounder stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'kawasemi': { name: NAMES['kawasemi'], height: 42.0, build: o => buildB(o, 'kawasemi', SPEC['kawasemi'], { name: NAMES['kawasemi'], ...HOOKS['kawasemi'] }), src: 'rocketdb kawasemi stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'mejiro': { name: NAMES['mejiro'], height: 33.0, build: o => buildB(o, 'mejiro', SPEC['mejiro'], { name: NAMES['mejiro'], ...HOOKS['mejiro'] }), src: 'rocketdb mejiro stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'samba-4s': { name: NAMES['samba-4s'], height: 16.5, build: o => buildB(o, 'samba-4s', SPEC['samba-4s'], { name: NAMES['samba-4s'], ...HOOKS['samba-4s'] }), src: 'rocketdb samba-4s stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
  'uguisu': { name: NAMES['uguisu'], height: 35.0, build: o => buildB(o, 'uguisu', SPEC['uguisu'], { name: NAMES['uguisu'], ...HOOKS['uguisu'] }), src: 'rocketdb uguisu stage table (tier-B generator)', est: ['fairing shape', 'engine layout'] },
};

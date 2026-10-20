// Constellation batch: a medium reusable launcher lofts a flat-packed stack of broadband satellites to low
// orbit, drops the fairing, releases the stack and dispenses the satellites in a staggered sequence while
// the booster flies back to the droneship.
// TODO(specs/): replace `real` with Vehicle Specs Bot's sheet. Placeholders: ~60 sats × ~800 kg ≈ 17 t
// (incl. ~1 t dispenser hardware) to a ~280 km insertion orbit, raised later by the sats' own thrusters.
export default {
  id: 'constellation-batch', name: 'Constellation batch',
  blurb: 'Loft a stack of broadband satellites and dispense them one by one, then bring the booster home.',
  vehicle: { template: 'Recommended', role: 'medium-reusable-launcher', payloadPart: 'sat',
    gameMassT: 3.0 }, // game scale: the in-game rockets are ~1/10 size; 3 t stands in for the ~17 t real stack
  real: { satCount: 60 /* TODO */, satMassKg: 800 /* TODO */, stackMassT: 17.4 /* TODO ≈60×0.8 + dispenser */, insertionAltKm: 280 /* TODO */ },
  deploy: [
    { kind: 'fairing-sep' },
    { kind: 'stack-release', delayS: 30 },
    { kind: 'dispense', count: 60, intervalS: 2, label: 'broadband-sat' },
    { kind: 'booster-return', mode: 'droneship' },
  ],
  objectives: [
    { id: 'orbit', kind: 'orbit', label: 'Reach orbit', points: 0, required: true },
    { id: 'pe', kind: 'pe-min', m: 140000, label: 'Periapsis above 140 km', points: 500, required: true },
    { id: 'fairing', kind: 'fairing-sep', label: 'Fairing separation', points: 250, required: true },
    { id: 'release', kind: 'stack-release', label: 'Release the stack', points: 250, required: true },
    { id: 'dispense', kind: 'dispensed', count: 60, label: 'Dispense all 60 satellites', points: 2000, required: true },
    { id: 'booster', kind: 'booster-landed', label: 'Booster lands on the droneship', points: 1500, required: false },
  ],
  scoring: { base: 'flight' },
};

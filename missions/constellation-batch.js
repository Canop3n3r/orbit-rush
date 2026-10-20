// Constellation batch: a medium reusable launcher lofts a flat-packed stack of broadband satellites to low
// orbit, drops the fairing, releases the stack and dispenses the satellites in a staggered sequence while
// the booster flies back to the droneship.
// Real figures from specs/ (Vehicle Specs Bot): sat = v2 mini bus F9-2 "up to 800 kg" (specs/starlink.md, row
// v2 mini); stack = heaviest flown F9 Starlink stack 17.4 t, which is also the ASDS-recovered LEO limit
// (specs/falcon9.md, LEO row). Sats per launch: sheet gives 21–29 v2 mini as ESTIMATE/unsourced; 21 × 800 kg ≈ 16.8 t.
export default {
  id: 'constellation-batch', name: 'Constellation batch',
  blurb: 'Loft a stack of broadband satellites and dispense them one by one, then bring the booster home.',
  vehicle: { template: 'Recommended', role: 'medium-reusable-launcher', payloadPart: 'sat',
    gameMassT: 3.0 }, // game scale: the in-game rockets are ~1/10 size; 3 t stands in for the 17.4 t real stack
  real: { satVersion: 'v2 mini', satMassKg: 800 /* specs/starlink.md v2 mini */, satCount: 21 /* ESTIMATE specs/starlink.md per-launch note */,
    stackMassT: 17.4 /* specs/falcon9.md LEO row */, recovery: 'ASDS droneship' /* specs/falcon9.md Recovery row */, insertionAltKm: 280 /* ESTIMATE, not in sheet */ },
  deploy: [
    { kind: 'fairing-sep' },
    { kind: 'stack-release', delayS: 30 },
    { kind: 'dispense', count: 21, intervalS: 5, label: 'broadband-sat' },
    { kind: 'booster-return', mode: 'droneship' },
  ],
  objectives: [
    { id: 'orbit', kind: 'orbit', label: 'Reach orbit', points: 0, required: true },
    { id: 'pe', kind: 'pe-min', m: 140000, label: 'Periapsis above 140 km', points: 500, required: true },
    { id: 'fairing', kind: 'fairing-sep', label: 'Fairing separation', points: 250, required: true },
    { id: 'release', kind: 'stack-release', label: 'Release the stack', points: 250, required: true },
    { id: 'dispense', kind: 'dispensed', count: 21, label: 'Dispense all 21 satellites', points: 2000, required: true },
    { id: 'booster', kind: 'booster-landed', label: 'Booster lands on the droneship', points: 1500, required: false },
  ],
  scoring: { base: 'flight' },
};

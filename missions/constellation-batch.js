// Constellation batch: a medium reusable launcher lofts a flat-packed stack of broadband satellites to low
// orbit, drops the fairing, releases the stack and dispenses the satellites in a staggered sequence while
// the booster flies back to the droneship.
// Real figures from the specs sheet (Vehicle Specs Bot): sat = gen-2 compact bus, "up to 800 kg" (constellation
// satellite sheet, gen-2 compact row); stack = heaviest flown constellation stack 17.4 t, which is also the
// booster-recovered LEO limit of vehicle 'heron-9' (vehicles/catalog.js payloadLEOReuse; specs LEO row).
// Sats per launch: the sheet gives 21–29 gen-2 compact sats as ESTIMATE/unsourced; 21 × 800 kg ≈ 16.8 t.
export default {
  id: 'constellation-batch', name: 'Constellation batch',
  blurb: 'Loft a stack of broadband satellites and dispense them one by one, then bring the booster home.',
  vehicle: { template: 'Recommended', role: 'medium-reusable-launcher', vehicleId: 'heron-9', payloadPart: 'sat',
    gameMassT: 3.0 }, // game scale: the in-game rockets are ~1/10 size; 3 t stands in for the 17.4 t real stack
  real: { satVersion: 'gen-2 compact', satMassKg: 800 /* specs: constellation sat sheet, gen-2 compact row */, satCount: 21 /* ESTIMATE: sheet per-launch note */,
    stackMassT: 17.4 /* heron-9 payloadLEOReuse */, recovery: 'droneship' /* heron-9 sheet, Recovery row */, insertionAltKm: 280 /* ESTIMATE, not in sheet */ },
  deploy: [
    { kind: 'fairing-sep' },
    { kind: 'booster-return', mode: 'droneship' },
    { kind: 'transfer', apM: 215000, peM: 210000, label: 'Raise to the 210 km insertion shell' },
    { kind: 'stack-release', delayS: 30 },
    { kind: 'dispense', count: 21, intervalS: 5, label: 'broadband-sat' },
  ],
  objectives: [
    { id: 'orbit', kind: 'orbit', label: 'Reach orbit', points: 0, required: true },
    { id: 'shell', kind: 'band', apM: 215000, peM: 210000, tolM: 8000, label: 'Insertion shell 210–215 km (± 8 km)', points: 750, required: true },
    { id: 'fairing', kind: 'fairing-sep', label: 'Fairing separation', points: 250, required: true },
    { id: 'release', kind: 'stack-release', label: 'Release the stack', points: 250, required: true },
    { id: 'dispense', kind: 'dispensed', count: 21, label: 'Dispense all 21 satellites', points: 2000, required: true },
    { id: 'booster', kind: 'booster-landed', label: 'Booster lands on the droneship', points: 1500, required: false },
  ],
  scoring: { base: 'flight' },
};

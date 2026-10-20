// Rideshare: several customers' payloads share one launch; drop the fairing, release the dispenser and
// deploy each customer group in its slot, spaced apart so they do not collide.
// Real: launcher capacity vehicle 'heron-9' payloadLEOReuse (17.4 t, booster recovered). Manifest masses are not in the sheet:
// ESTIMATE ( 12 cubesats ~10 kg, 4 smallsats ~150 kg, 1 ~500 kg
// microsat ≈ 1.2 t + ~0.8 t dispenser ≈ 2 t real; game-scale below).
export default {
  id: 'rideshare', name: 'Rideshare',
  blurb: 'One rocket, many customers: deploy every payload group in order.',
  vehicle: { template: 'Recommended', role: 'medium-reusable-launcher', vehicleId: 'heron-9', payloadPart: 'sat', gameMassT: 2.0 },
  real: { manifest: [ { label: 'cubesat', n: 12, kg: 10 }, { label: 'smallsat', n: 4, kg: 150 }, { label: 'microsat', n: 1, kg: 500 } ] /* ESTIMATE */, leoRecoveredT: 17.4 /* heron-9 payloadLEOReuse */ },
  deploy: [
    { kind: 'fairing-sep' }, { kind: 'booster-return', mode: 'droneship' },
    { kind: 'transfer', apM: 300000, peM: 280000, label: 'Climb to the 280 × 300 km drop-off orbit' },
    { kind: 'stack-release', delayS: 15 },
    { kind: 'dispense', count: 1, intervalS: 10, label: 'microsat' },
    { kind: 'coast', s: 30 },
    { kind: 'dispense', count: 4, intervalS: 8, label: 'smallsat' },
    { kind: 'coast', s: 30 },
    { kind: 'dispense', count: 12, intervalS: 3, label: 'cubesat' },
  ],
  objectives: [
    { id: 'orbit', kind: 'orbit', label: 'Reach orbit', points: 0, required: true },
    { id: 'dropoff', kind: 'band', apM: 300000, peM: 280000, tolM: 10000, label: 'Drop-off orbit 280 × 300 km (± 10 km)', points: 750, required: true },
    { id: 'release', kind: 'stack-release', label: 'Release the dispenser', points: 250, required: true },
    { id: 'all', kind: 'dispensed', count: 17, label: 'Deploy all 17 customer payloads', points: 2500, required: true },
    { id: 'booster', kind: 'booster-landed', label: 'Booster lands', points: 1000, required: false },
  ],
  scoring: { base: 'flight' },
};

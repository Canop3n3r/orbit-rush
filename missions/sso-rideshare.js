// Sun-synchronous rideshare: launch north-south (AUTO holds a near-polar 90° plane), then the player flies the
// plane-change burn at the node to the sun-synchronous 97.6°, and the dispenser deploys three customer groups.
// SSO inclination ~97.4–97.8° at 500–600 km: ESTIMATE (standard orbital mechanics, not in the specs sheet).
// Vehicle heron-9 (spec:heron-9, LEO row); manifest masses ESTIMATE.
export default {
  id: 'sso-rideshare', name: 'Polar rideshare',
  blurb: 'Go polar, swing the plane to sun-synchronous, and drop every customer.',
  vehicle: { template: 'Recommended', role: 'medium-reusable-launcher', vehicleId: 'heron-9', payloadPart: 'sat', gameMassT: 1.5, inclDeg: 97.6 },
  real: { inclDeg: 97.6 /* ESTIMATE */, manifest: [ { label: 'cubesat', n: 24 }, { label: 'smallsat', n: 6 }, { label: 'microsat', n: 2 } ] /* ESTIMATE */ },
  deploy: [ { kind: 'fairing-sep' }, { kind: 'booster-return', mode: 'droneship' },
    { kind: 'plane-change', inclDeg: 97.6, burns: 3, label: 'Plane change to 97.6° (three node burns)' },
    { kind: 'transfer', apM: 190000, peM: 180000, label: 'Trim to the 180 × 190 km drop orbit' },
    { kind: 'stack-release', delayS: 10 },
    { kind: 'dispense', count: 2, intervalS: 10, label: 'microsat' }, { kind: 'coast', s: 20 },
    { kind: 'dispense', count: 6, intervalS: 6, label: 'smallsat' }, { kind: 'coast', s: 20 },
    { kind: 'dispense', count: 24, intervalS: 2, label: 'cubesat' } ],
  objectives: [
    { id: 'orbit', kind: 'orbit', label: 'Reach orbit', points: 0, required: true },
    { id: 'drop', kind: 'band', apM: 190000, peM: 180000, tolM: 10000, label: 'Drop orbit 180 × 190 km (± 10 km)', points: 500, required: true },
    { id: 'sso', kind: 'incl', deg: 97.6, tol: 0.3, label: 'Sun-synchronous plane 97.6° (± 0.3°)', points: 1500, required: true },
    { id: 'release', kind: 'stack-release', label: 'Release the dispenser', points: 250, required: true },
    { id: 'all', kind: 'dispensed', count: 32, label: 'Deploy all 32 customer payloads', points: 2500, required: true },
    { id: 'booster', kind: 'booster-landed', label: 'Booster lands', points: 1000, required: false },
  ],
  scoring: { base: 'flight' },
};

// Tower catch: fly a payload to orbit on the medium reusable launcher, then bring the booster back to
// within a tight radius of the recovery point at low speed, standing in for a catch by tower arms.
// The game currently lands boosters on a droneship deck; the catch is scored by miss distance and
// touchdown speed against that same point. TODO(main.js/gfx): a real tower + arms visual and its own site.
// TODO(specs/): real catch-tower tolerances and booster return mass from Vehicle Specs Bot's sheet.
export default {
  id: 'tower-catch', name: 'Tower catch',
  blurb: 'Deliver the payload, then bring the booster back slow and dead-centre so the tower arms can catch it.',
  vehicle: { template: 'Recommended', role: 'medium-reusable-launcher', payloadPart: 'sat', gameMassT: 2.0 },
  real: { catchRadiusM: 10 /* TODO: real arm span ~ booster diameter + margin */, maxCatchSpeed: 2 /* TODO m/s */, boosterDryT: 25 /* TODO placeholder */ },
  deploy: [ { kind: 'fairing-sep' }, { kind: 'stack-release', delayS: 20 }, { kind: 'booster-return', mode: 'catch', catchRadiusM: 35, maxSpeed: 10 } ],
  objectives: [
    { id: 'orbit', kind: 'orbit', label: 'Reach orbit', points: 0, required: true },
    { id: 'release', kind: 'stack-release', label: 'Release the payload', points: 250, required: true },
    { id: 'landed', kind: 'booster-landed', label: 'Booster returns intact', points: 1000, required: true },
    // FINDING: flight.js AUTO booster return currently touches down ~1.6 km from the recovery point (it never
    // gets onto the deck), so the precise catch is a bonus AUTO cannot earn yet; the required step is the zone.
    // TODO(flight.js, Game bot): booster terminal guidance toward the recovery point, then make 'catch' required.
    { id: 'zone', kind: 'booster-catch', radiusM: 2500, maxSpeed: 10, label: 'Back in the catch zone (< 2.5 km, < 10 m/s)', points: 1500, required: true },
    { id: 'catch', kind: 'booster-catch', radiusM: 35, maxSpeed: 10, label: 'Caught by the arms (< 35 m, < 10 m/s)', points: 3000, required: false },
  ],
  scoring: { base: 'flight' },
};

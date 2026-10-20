// Tower catch: fly a payload to orbit on the medium reusable launcher, then bring the booster back to
// within a tight radius of the recovery point at low speed, standing in for a catch by tower arms.
// The game currently lands boosters on a droneship deck; the catch is scored by miss distance and
// touchdown speed against that same point. TODO(main.js/gfx): a real tower + arms visual and its own site.
// Real figures: vehicle 'colossus-v3' (specs super-heavy sheet: booster dry mass row; Recovery row: boostback +
// tower catch by the arms, first 2024-10-13). Catch tolerances are not in the sheet: ESTIMATE.
export default {
  id: 'tower-catch', name: 'Tower catch',
  blurb: 'Deliver the payload, then bring the booster back slow and dead-centre so the tower arms can catch it.',
  vehicle: { template: 'Recommended', role: 'medium-reusable-launcher', vehicleId: 'colossus-v3', payloadPart: 'sat', gameMassT: 2.0 },
  real: { boosterDryT: 275 /* colossus-v3 sheet, Booster dry mass */, catchRadiusM: 10 /* ESTIMATE */, maxCatchSpeed: 2 /* ESTIMATE m/s */ },
  deploy: [ { kind: 'fairing-sep' }, { kind: 'booster-return', mode: 'catch', catchRadiusM: 35, maxSpeed: 10 },
    { kind: 'transfer', apM: 165000, peM: 160000, label: 'Lower to the 160 km drop orbit' }, { kind: 'stack-release', delayS: 20 } ],
  objectives: [
    { id: 'orbit', kind: 'orbit', label: 'Reach orbit', points: 0, required: true },
    { id: 'drop', kind: 'band', apM: 165000, peM: 160000, tolM: 8000, label: 'Drop orbit 160–165 km (± 8 km)', points: 500, required: true },
    { id: 'release', kind: 'stack-release', label: 'Release the payload', points: 250, required: true },
    { id: 'landed', kind: 'booster-landed', label: 'Booster returns intact', points: 1000, required: true },
    // f4: AUTO terminal guidance lands within metres, so the 35 m catch is required.
    { id: 'zone', kind: 'booster-catch', radiusM: 2500, maxSpeed: 10, label: 'Land near the tower (< 2.5 km, < 10 m/s)', points: 1500, required: true },
    { id: 'catch', kind: 'booster-catch', radiusM: 35, maxSpeed: 10, label: 'Caught by the arms (< 35 m, < 10 m/s)', points: 3000, required: true },
  ],
  scoring: { base: 'flight' },
};

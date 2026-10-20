// Super-heavy tower catch: a wide-body two-stage stack (game stand-in for vehicle titan-ss-v3) stages with a
// landing reserve, and the player flies the booster back by hand to the arms (35 m, < 8 m/s).
// Real: booster prop 3,650 t, ship prop 1,600 t, payload 100 t reusable (spec:titan-ss#v3); booster dry 275 t
// ESTIMATE-adjacent (infobox value, per-block masses ESTIMATE); tower-catch reserve 3–5 % ESTIMATE
// (missions_data titan-ss rows). Game reserve comes from planBuild (the auto-landing minimum).
export default {
  id: 'super-heavy-catch', name: 'Super-heavy catch',
  blurb: 'The biggest stack yet: send the ship up, then fly the booster into the arms.',
  vehicle: { role: 'super-heavy-launcher', vehicleId: 'titan-ss-v3', payloadPart: 'sat', gameMassT: 2.0, recovery: { stage0: 'catch-pilot' },
    parts: [ { id: 'fairing' }, { id: 'sat' }, { id: 'probe' }, { id: 'tank-l' }, { id: 'tank-m' }, { id: 'mule', n: 2 }, { id: 'dec' }, { id: 'tank-w' }, { id: 'tank-xl' }, { id: 'bison', n: 2 }, { id: 'fins' } ] },
  real: { boosterPropT: 3650, shipPropT: 1600, payloadT: 100 /* spec:titan-ss#v3 */, boosterDryT: 275 /* spec:titan-ss dry row */, catchReserve: 0.04 /* ESTIMATE 3–5 % */ },
  deploy: [ { kind: 'fairing-sep' }, { kind: 'booster-return', mode: 'catch' } ],
  objectives: [
    { id: 'orbit', kind: 'orbit', label: 'Ship reaches orbit', points: 0, required: true },
    { id: 'landed', kind: 'booster-landed', label: 'Booster returns intact', points: 1000, required: true },
    { id: 'catch', kind: 'booster-catch', radiusM: 35, maxSpeed: 8, label: 'Caught by the arms (< 35 m, < 8 m/s)', points: 4000, required: true },
  ],
  scoring: { base: 'flight' },
};

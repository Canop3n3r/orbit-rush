// Demo payload to a Mars-crossing heliocentric orbit (spec:roadster-payload: ~1,300 kg; flown 2018-02-06 on
// heron-heavy). The ejection burn comes from physics/patched.js planInterplanetary (Lambert-optimal
// departure near the Hohmann window); success = leaving Earth's SOI with aphelion beyond ~1.4 AU.
// Game stand-in: the 'Mars explorer' transfer stack with the payload mass on the probe core.
export default {
  id: 'roadster-helio', name: 'Demo payload to Mars-crossing orbit',
  blurb: 'Throw a demo payload out of Earth orbit onto a Mars-crossing path around the Sun.',
  epochUTC: '2026-10-19T15:00:00Z',
  vehicle: { template: 'Mars explorer', role: 'heavy-launcher', vehicleId: 'heron-heavy', specId: 'roadster-payload', payloadPart: 'probe', gameMassT: 1.3 /* spec:roadster-payload 1,300 kg */ },
  real: { payloadKg: 1300 /* spec:roadster-payload */, withUpperStageKg: 5900 /* spec:roadster-payload */ },
  maxFrames: 2e6,
  deploy: [ { kind: 'fairing-sep' }, { kind: 'interplanetary', target: 'mars' } ],
  objectives: [
    { id: 'helio', kind: 'helio', aphMinAU: 1.4, label: 'Heliocentric orbit reaching past 1.4 AU', points: 5000, required: true },
  ],
  scoring: { base: 'flight' },
};

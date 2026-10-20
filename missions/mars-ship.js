// Mars ship (vehicle colossus-mars): wait for the window, burn for Mars, correct, and capture into Mars orbit
// with the one-tap mission autopilot. Real: >100 t to the Mars surface after orbital refill (spec:colossus-mars).
// Game stand-in: the 'Mars explorer' stack. Mars surface landing for the ship: TODO (Game bot).
export default {
  id: 'mars-ship', name: 'Ship to Mars',
  blurb: 'Fly the ship across the solar system and capture into Mars orbit.',
  epochUTC: '2026-10-19T15:00:00Z',
  vehicle: { template: 'Mars explorer', role: 'mars-ship', vehicleId: 'colossus-v3', specId: 'colossus-mars' },
  real: { surfacePayloadT: 100 /* spec:colossus-mars (>100 t) */ },
  maxFrames: 3e6,
  deploy: [ { kind: 'fairing-sep' }, { kind: 'director', dest: 'mars' } ],
  objectives: [
    { id: 'mars', kind: 'orbiting', body: 'mars', label: 'Captured into Mars orbit', points: 16000, required: true /* capstone: must out-score crew-dock */ },
  ],
  scoring: { base: 'flight' },
};

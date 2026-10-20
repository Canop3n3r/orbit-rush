// Crewed lunar landing with the ship (vehicle titan-ss-lunar): the one-tap mission autopilot (fun/director.js)
// flies the transfer, capture and powered landing on the real physics. Real: payload to the surface ~100 t
// ESTIMATE; dry mass 85–100 t ESTIMATE; launch mass after refill 1,300–1,400 t ESTIMATE (spec:titan-ss-lunar).
// Game stand-in: the 'Moon lander' stack; crew is carried as mission data (the lander core has no crew pod).
export default {
  id: 'lunar-landing', name: 'Crewed Moon landing',
  blurb: 'Take the crew ship from Earth orbit to a landing on the Moon.',
  epochUTC: '2026-10-19T15:00:00Z', crew: 2,
  vehicle: { template: 'Moon lander', role: 'lunar-ship', vehicleId: 'titan-ss-v3', specId: 'titan-ss-lunar' },
  real: { surfacePayloadT: 100 /* ESTIMATE */, dryT: 92 /* ESTIMATE 85–100 */ },
  maxFrames: 2e6,
  deploy: [ { kind: 'fairing-sep' }, { kind: 'director', dest: 'moon' } ],
  objectives: [
    { id: 'land', kind: 'landed-on', body: 'moon', label: 'Land on the Moon', points: 14000, required: true /* capstone: must out-score crew-dock */ },
  ],
  scoring: { base: 'flight' },
};

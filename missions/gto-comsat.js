// GTO comsat on the heavy launcher (vehicle heron-heavy): side boosters stage with an RTLS reserve and fly
// back to the launch site, the center core stages later with a droneship reserve, the upper stage raises
// apoapsis to geostationary height and releases the comsat.
// Real: GTO 26,700 kg expendable (spec:heron-heavy GTO row); side boosters recovered + core expended
// 16–18 t ESTIMATE; fully reusable ~8 t ESTIMATE; RTLS reserve 10–15 % ESTIMATE; core droneship 5–7 %
// ESTIMATE (missions_data heron-heavy rows). Side boosters have flown RTLS; a side-booster droneship landing
// has never flown (ESTIMATE row). Game: the 'Side boosters' template; reserves are game-scaled (the game
// core needs ~20 % to survive entry at ~3.3 km/s). The recovery layer flies both returns (missions/layers/recovery.js).
export default {
  id: 'gto-comsat', name: 'Comsat to GTO',
  blurb: 'Heavy launcher: side boosters back to the pad, core on the droneship, comsat to geostationary transfer.',
  vehicle: { template: 'Side boosters', role: 'heavy-launcher', vehicleId: 'heron-heavy', payloadPart: 'sat', gameMassT: 3.0,
    recovery: { side: 'rtls', core: 'droneship', sideReserveFrac: 0.12, coreReserveFrac: 0.2 } },
  real: { gtoExpendableKg: 26700 /* spec:heron-heavy GTO */, gtoReusableKg: 8000 /* ESTIMATE */, sideRtlsReserve: 0.12 /* ESTIMATE 10–15 % */, coreDroneshipReserve: 0.06 /* ESTIMATE 5–7 % */ },
  deploy: [ { kind: 'fairing-sep' }, { kind: 'raise-ap', apM: 35786000, label: 'Transfer burn to GTO (35,786 km)' }, { kind: 'stack-release', delayS: 30 } ],
  objectives: [
    { id: 'orbit', kind: 'orbit', label: 'Reach parking orbit', points: 0, required: true },
    { id: 'gto', kind: 'ap-min', m: 35000000, label: 'Apoapsis at geostationary height (> 35,000 km)', points: 2500, required: true },
    { id: 'release', kind: 'stack-release', label: 'Release the comsat', points: 500, required: true },
    { id: 'side', kind: 'recovered', which: 'side', mode: 'rtls', maxDistM: 2000, label: 'Side boosters land back at the site (< 2 km)', points: 1500, required: true },
    { id: 'core', kind: 'recovered', which: 'core', mode: 'droneship', label: 'Center core lands on the droneship', points: 1500, required: false },
  ],
  scoring: { base: 'flight' },
};

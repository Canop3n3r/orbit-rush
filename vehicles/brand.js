// Display-name lookup keyed by neutral vehicle/engine id. The public repo stays neutral (TEAM.md rule 4):
// branded names live only in the private brand pack repo, which can call setBrandPack(map) at load.
// No brand pack exists in this repo, so this is a minimal stand-in with neutral defaults.
export const NEUTRAL_NAMES = {
  'sparrow-1': 'Sparrow-1 Smallsat Launcher', 'heron-9': 'Heron-9', 'heron-9-v10': 'Heron-9 (Mk I)', 'heron-9-v11': 'Heron-9 (Mk II)',
  'heron-9-crew': 'Heron-9 Crew', 'heron-heavy': 'Heron Heavy', 'colossus-v3': 'Colossus (Mk III)', 'colossus-v4': 'Colossus (Mk IV)', 'colossus-v3': 'Colossus (Mk III)', 'colossus-v4': 'Colossus (Mk IV)',
  'kero-a': 'KR-A', 'kero-c': 'KR-C', 'kero-d': 'KR-D', 'kero-cv': 'KR-C Vac', 'kero-dv': 'KR-D Vac', 'kero-p': 'KR-P (pressure-fed)',
  'meth-3': 'MX-3', 'meth-3v': 'MX-3 Vac', 'capsule-2': 'Skylark Crew Capsule',
  'colossus-tanker': 'Colossus Tanker', 'colossus-depot': 'Colossus Depot', 'colossus-lunar': 'Colossus Lunar Lander', 'colossus-mars': 'Colossus Mars Ship',
  'roadster-payload': 'Demo Car Payload',
};
let pack = {};
export function setBrandPack(map) { pack = { ...(map || {}) }; }
export const displayName = id => pack[id] || NEUTRAL_NAMES[id] || id;

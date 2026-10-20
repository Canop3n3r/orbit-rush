// Brand lookup. Public builds show neutral names only. Game bot owns brand/default.js (public) and a private
// brand pack in a separate private repo. FALLBACK: brand/default.js was not on main when this was written,
// so this module ships a tiny built-in neutral table and lets a pack be installed at runtime:
//   import { setBrandPack } from './missions/brand.js'; setBrandPack(pack)   // pack: { names: { key: 'Label' } }
// Keys: mission ids ('constellation-batch') and vehicle roles ('medium-reusable-launcher').
const NEUTRAL = {
  'constellation-batch': 'Constellation batch', 'tower-catch': 'Tower catch', 'crew-dock': 'Crew to station',
  'refuel': 'Orbital refuel', 'rideshare': 'Rideshare',
  'medium-reusable-launcher': 'medium reusable launcher', 'crew-capsule-launcher': 'crew capsule launcher',
  'broadband-sat': 'broadband satellite', 'station': 'orbital station', 'tanker': 'propellant tanker', 'catch-tower': 'catch tower',
};
let pack = null;
export function setBrandPack(p) { pack = p && p.names ? p : null; }
export function brandName(key, fallback) { return (pack && pack.names[key]) || NEUTRAL[key] || fallback || key; }

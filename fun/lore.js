// Orbit Rush f1 — exploration: the Planetary Atlas and points of interest. All lore is original writing for
// Orbit Rush (fictional survey notes), with real physical numbers pulled from physics/solar.js at runtime.
export const ATLAS = {
  earth: { tag: 'Home', blurb: 'A blue world with a thin, busy sky. Its spin hands every eastbound launch 465 m/s for free.', tip: 'Launch east. Orbit costs about 9.4 km/s.' },
  moon: { tag: 'First stop', blurb: 'Grey, silent and close: three days away on a good transfer. No air, so every landing is a powered one.', tip: 'Capture low, then a suicide burn — the director flies it if you ask.' },
  mars: { tag: 'The red frontier', blurb: 'Dusty, cold, with an atmosphere just thick enough to be trouble. Windows open about every 26 months.', tip: 'Wait for the transfer window; the planner shows it.' },
  venus: { tag: 'Morning star', blurb: 'Bright, veiled and crushing: a surface hotter than an oven under 90 atmospheres.', tip: 'Flybys are cheap; landings are not.' },
  mercury: { tag: 'Sun-scorched', blurb: 'Small and fast, hard to reach because falling toward the Sun takes more Δv than escaping it.', tip: 'Bring a lot of Δv.' },
  jupiter: { tag: 'King of planets', blurb: 'A storm the size of worlds and a family of moons. Its gravity well is enormous.', tip: 'Aim for a moon to steal speed.' },
  saturn: { tag: 'The ringed one', blurb: 'Rings of ice so wide and thin they vanish edge-on.', tip: 'Long cruise — warp ×10,000,000 is your friend.' },
  io: { tag: 'Volcanic', blurb: 'The most volcanic place known, squeezed by Jupiter’s tides.', tip: '' }, europa: { tag: 'Ice shell', blurb: 'A cracked white crust over a hidden ocean.', tip: '' },
  ganymede: { tag: 'Giant moon', blurb: 'Bigger than Mercury, with its own magnetic field.', tip: '' }, callisto: { tag: 'Cratered', blurb: 'Battered, ancient and quiet at the edge of Jupiter’s family.', tip: '' },
  titan: { tag: 'Hazy', blurb: 'Thick orange air, methane lakes: a parachute world.', tip: '' }, uranus: { tag: 'Tilted', blurb: 'Rolls around the Sun on its side.', tip: '' },
  neptune: { tag: 'Windy', blurb: 'The fastest winds in the system, far from the Sun.', tip: '' }, triton: { tag: 'Backwards', blurb: 'Orbits the wrong way round; a captured wanderer.', tip: '' },
  pluto: { tag: 'Far away', blurb: 'A heart of nitrogen ice at the edge of the map.', tip: '' }, sun: { tag: 'Star', blurb: 'Everything falls around it.', tip: 'Do not fly into it.' },
};
// Points of interest (lat/lon deg). Original, fictional survey sites for Orbit Rush.
export const POIS = [
  { id: 'pad', body: 'earth', lat: 0, lon: 0, name: 'Equator Launch Complex', lore: 'Where every flight begins. The flame trench is older than the rockets.' },
  { id: 'deck', body: 'earth', lat: 0, lon: 4, name: 'Droneship Holding Area', lore: 'A painted X on a rolling deck, waiting downrange.' },
  { id: 'tranq', body: 'moon', lat: 0.7, lon: 23.5, name: 'Quiet Sea Plain', lore: 'Flat, dark basalt — the friendliest place to put down a first lander.' },
  { id: 'southrim', body: 'moon', lat: -89.5, lon: 0, name: 'Shadow Rim', lore: 'Crater floors here have not seen sunlight in a very long time. Survey teams suspect ice.' },
  { id: 'farside', body: 'moon', lat: 10, lon: 180, name: 'Far Side Radio Basin', lore: 'Shielded from Earth’s chatter by the whole Moon. Perfectly quiet.' },
  { id: 'gale', body: 'mars', lat: -5.4, lon: 137.8, name: 'Layered Crater', lore: 'A mountain of stacked sediment: pages of an old wet history.' },
  { id: 'olympus', body: 'mars', lat: 18.6, lon: -133.8, name: 'The Tall Volcano', lore: 'So broad its summit sits over the horizon from its own base.' },
  { id: 'valles', body: 'mars', lat: -13.9, lon: -59.2, name: 'The Great Rift', lore: 'A canyon long enough to cross a continent back home.' },
  { id: 'maxwell', body: 'venus', lat: 65, lon: 3, name: 'High Ridges', lore: 'The cool, high country of Venus — still hot enough to melt lead.' },
  { id: 'redspot', body: 'jupiter', lat: -22, lon: 0, name: 'The Old Storm', lore: 'A storm that has turned for centuries.' },
  { id: 'cracks', body: 'europa', lat: 0, lon: 0, name: 'Line Fields', lore: 'Cracks in the ice that open and close with every orbit.' },
];
export const poisOf = body => POIS.filter(p => p.body === body);
// great-circle distance on a body of radius R (m)
export function gcDist(R, lat1, lon1, lat2, lon2) { const d = Math.PI / 180, a = Math.sin((lat2 - lat1) * d / 2) ** 2 + Math.cos(lat1 * d) * Math.cos(lat2 * d) * Math.sin((lon2 - lon1) * d / 2) ** 2; return 2 * R * Math.asin(Math.min(1, Math.sqrt(a))); }
export function nearestPoi(body, R, lat, lon) { let best = null; for (const p of poisOf(body)) { const dd = gcDist(R, lat, lon, p.lat, p.lon); if (!best || dd < best.d) best = { poi: p, d: dd }; } return best; }

// f5.4 sandbox: launch from any world. Bodies with a surface, preset bases (lat°, lon°) and a lat/lon → body-fixed unit vector.
// Earth sites use the game's Earth frame (the main pad sits at [1,0,0]) via latLonToGame; other worlds use plain body-fixed lat/lon.
export const GAS = new Set(['sun', 'jupiter', 'saturn', 'uranus', 'neptune']); // no surface to stand on
// [id, name, lat, lon, art site id (gfx/sites/site_<id>.js; 'generic' = the plain sandbox complex), landing zone (lat, lon) or null]
export const SITES = {
  earth: [['cape', 'Heritage Complex', 28.6084, -80.6043, 'cape-heritage', [28.4858, -80.5428]], ['capen', 'North Coast Complex', 28.5619, -80.5772, 'cape-north', [28.4858, -80.5428]],
    ['coast36', 'Coast Pad 36', 28.4711, -80.5378, 'generic', [28.4858, -80.5428]], ['gulf', 'Bay Starport', 25.9972, -97.1566, 'gulf-port', null], ['atoll', 'Atoll Range', 9.0477, 167.7433, 'atoll', null],
    ['vandy', 'West Coast Pad', 34.632, -120.611], ['equator', 'Equator Port', 5.239, -52.768],
    ['baikal', 'Steppe Cosmodrome', 45.965, 63.305], ['tanega', 'Island Center', 30.400, 130.970], ['palm', 'Palm Coast', 19.614, 110.951], ['peninsula', 'Peninsula Pad', -39.262, 177.865]],
  moon: [['tranq', 'Moon Base Pad', 0.7, 23.5, 'moon'], ['shackle', 'South Pole Rim', -89.5, 0], ['copern', 'Copernicus', 9.62, -20.08]],
  mars: [['gale', 'Mars Base Pad (Gale)', -5.4, 137.8, 'mars'], ['jezero', 'Jezero Crater', 18.38, 77.58], ['olympus', 'Olympus Mons Foot', 18.65, -133.8], ['hellas', 'Hellas Basin', -42.4, 70.5]],
  mercury: [['caloris', 'Caloris Basin', 30.5, 170.2]], venus: [['maxwell', 'Maxwell Montes', 65.2, 3.3]],
  phobos: [['stick', 'Stickney', 1, -49]], deimos: [['voltaire', 'Voltaire', 22, 3.5]],
  io: [['loki', 'Loki Patera', 12.6, -51.1]], europa: [['conamara', 'Conamara Chaos', 9.7, -86.6]], ganymede: [['uruk', 'Uruk Sulcus', 0, 160]], callisto: [['valhalla', 'Valhalla', 14.7, -56]],
  enceladus: [['tiger', 'Tiger Stripes', -82, 0]], triton: [['plains', 'Cantaloupe Plains', 20, 340]],
  pluto: [['heart', 'Sputnik Planitia', 25, 175]], charon: [['mordor', 'North Cap', 80, 0]],
};
// Saturn's hazy moon: keyed by data (the Saturn moon with an atmosphere) so its preset sits with the others
import { BODIES as _B } from './physics/solar.js?v=f5.9-10';
{ const hazy = Object.values(_B).find(b => b.parent === 'saturn' && b.atm); if (hazy) SITES[hazy.id] = [['dunes', 'Equatorial Dunes', -10.6, 192.3, 'generic']]; }
export const geoEf = (lat, lon) => { const a = lat * Math.PI / 180, b = lon * Math.PI / 180; return [Math.cos(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.sin(a)]; };
export function siteEf(body, lat, lon, earthMap) { return body === 'earth' && earthMap ? earthMap(lat, lon) : geoEf(lat, lon); }
export function launchBodies(BODIES) { return Object.values(BODIES).filter(b => !GAS.has(b.id)).map(b => b.id); }
// Flight options for a picked site { body, lat, lon, name }
export function siteOpts(s, earthMap) { if (!s || !s.body) return {}; const o = { body: s.body, siteEf: siteEf(s.body, s.lat, s.lon, earthMap), sandbox: true, siteName: s.name };
  const pre = (SITES[s.body] || []).find(x => x[0] === s.id); if (pre && pre[5]) o.lzEf = siteEf(s.body, pre[5][0], pre[5][1], earthMap); // f5.4f: RTLS to the site's real landing zone
  return o; }
// the art complex for a picked site: a preset's own model, else the moon/mars pads near their base, else the generic pad
export function artFor(s) { if (!s) return null; const p = (SITES[s.body] || []).find(x => x[0] === s.id); if (p && p[4]) return p[4]; return 'generic'; }

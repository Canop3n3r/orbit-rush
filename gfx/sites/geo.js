// Site placement math (pure, no three.js; node-testable). A site complex is built in a local frame:
// +X east, +Y up (local vertical), +Z south, origin = the site's main pad at the surface.
// Earth sites use the game's Earth-fixed frame (gfx/earthmap.js latLonToGame: the heritage pad at +x, east +y).
// Other bodies use their plain body-fixed frame (+x at lon 0, +z north pole), radius from physics/solar.js BODIES.
import { latLonToGame, geoToGame } from '../earthmap.js?v=f5.9-6';
export const BODY_R = { earth: 6378137, moon: 1737400, mars: 3396190 };
const D = Math.PI / 180, id3 = v => v;
const tf = body => body === 'earth' ? geoToGame : id3;
export function upDir(body, lat, lon) { if (body === 'earth') return latLonToGame(lat, lon); const a = lat * D, b = lon * D; return [Math.cos(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.sin(a)]; }
// local east/up/south unit vectors in the body's game frame
export function enu(body, lat, lon) { const a = lat * D, b = lon * D, T = tf(body);
  const east = T([-Math.sin(b), Math.cos(b), 0]), north = T([-Math.sin(a) * Math.cos(b), -Math.sin(a) * Math.sin(b), Math.cos(a)]);
  return { east, up: upDir(body, lat, lon), south: north.map(x => -x) }; }
// column-major 4x4 (three.js Matrix4.fromArray order): local site frame -> body frame, metres from the body centre
export function siteMatrix(body, lat, lon, R = BODY_R[body] || 1e6, alt = 0) { const { east, up, south } = enu(body, lat, lon), r = R + alt;
  return [...east, 0, ...up, 0, ...south, 0, up[0] * r, up[1] * r, up[2] * r, 1]; }
// exact relative placement of a second point (e.g. a droneship station downrange) in the main site's local frame
export function localOffset(body, lat0, lon0, lat1, lon1, R = BODY_R[body] || 1e6) { const m = siteMatrix(body, lat0, lon0, R), u = upDir(body, lat1, lon1).map(x => x * R);
  const d = [u[0] - m[12], u[1] - m[13], u[2] - m[14]], dot = (o) => m[o] * d[0] + m[o + 1] * d[1] + m[o + 2] * d[2];
  return [dot(0), dot(4), dot(8)]; }
// rotation of the second point's frame expressed in the first's local frame (column-major 3x3 as 4x4 with zero translation)
export function localBasis(body, lat0, lon0, lat1, lon1) { const A = enu(body, lat0, lon0), B = enu(body, lat1, lon1), ax = [A.east, A.up, A.south];
  const col = v => ax.map(a => a[0] * v[0] + a[1] * v[1] + a[2] * v[2]);
  return [...col(B.east), 0, ...col(B.up), 0, ...col(B.south), 0, 0, 0, 0, 1]; }

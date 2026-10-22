// flight-ground-2: near-ocean look for the Earth ground tile (the 150 km cap around the craft); no extra meshes or draws.
// A few analytic deep-water waves (directional sines with Gerstner-style steepness, w = sqrt(g k)) give animated normals;
// each wave fades out by camera distance (small ripples first) so from altitude the sea blends into the map colour.
// Fresnel sky reflection, sun glint, shallow/deep colour from the map's water mask, whitecaps on crests (med/high),
// surf foam along the coast (med/high), true vertex displacement of the two longest swells near the camera (high only).
import * as THREE from 'three/webgpu';
import { uniform, float, vec3, vec4, positionLocal, positionWorld, cameraPosition, normalWorld, normalLocal, modelWorldMatrix, cameraViewMatrix,
  normalize, dot, length, mix, smoothstep, pow, saturate, max, sin, cos, mx_noise_float, reflect } from 'three/tsl';
export const oceanTime = uniform(0); // seconds; main.js advances it every frame
// [wavelength m, steepness (A*k), direction (unit, tile-local), phase]
const WAVES = [[220, 0.16, [0.80, 0.55, 0.24], 0.0], [90, 0.18, [0.35, 0.90, -0.25], 1.3], [37, 0.18, [0.95, -0.20, 0.24], 2.1], [13, 0.15, [-0.30, 0.85, 0.43], 0.7], [5.2, 0.12, [0.60, 0.30, -0.74], 4.2]];
export const OCEAN_TIERS = { low: { waves: [1, 3], caps: false, surf: false, displace: false }, med: { waves: [0, 1, 2, 3], caps: true, surf: true, displace: false }, high: { waves: [0, 1, 2, 3, 4], caps: true, surf: true, displace: true } };
const G = 9.81;
function waveTerms(p, dist, ids) { // -> { grad (local), crest (-1..1 weighted), h (m) }
  let gx = vec3(0, 0, 0), crest = float(0), h = float(0), wsum = 0;
  for (const i of ids) {
    const [lam, st, d, ph] = WAVES[i], k = 2 * Math.PI / lam, w = Math.sqrt(G * k), A = st / k, dir = vec3(...d);
    const fade = smoothstep(float(lam * 70), float(lam * 12), dist), th = dot(p, dir).mul(k).sub(oceanTime.mul(w)).add(ph);
    gx = gx.add(dir.mul(cos(th).mul(st).mul(fade))); crest = crest.add(sin(th).mul(fade).mul(st)); wsum += st; h = h.add(sin(th).mul(A).mul(fade));
  }
  return { grad: gx, crest: crest.div(wsum), h };
}
// vc: map colour (linear), w0: raw water mask, w: shaped water mask, sunPos: world-space sun position uniform
export function oceanLook({ vc, w0, w, sunPos, tier = 'med' }) {
  const T = OCEAN_TIERS[tier] || OCEAN_TIERS.med, p = positionLocal, dist = length(positionWorld.sub(cameraPosition));
  const { grad, crest } = waveTerms(p, dist, T.waves);
  const gW = modelWorldMatrix.mul(vec4(grad, 0)).xyz, n0 = normalWorld, gt = gW.sub(n0.mul(dot(gW, n0)));
  const n = normalize(n0.sub(gt)), V = normalize(cameraPosition.sub(positionWorld)), L = normalize(sunPos.sub(positionWorld));
  const ndl = dot(n0, L), day = smoothstep(-0.12, 0.25, ndl), cosV = saturate(dot(n, V));
  const fres = float(0.04).add(pow(float(1).sub(cosV), 4.0).mul(0.96));
  // water body colour: navy offshore, turquoise where the mask says shallow/coastal; a hint of the map colour keeps regions
  const shallow = smoothstep(0.97, 0.62, w0), deep = vec3(0.02, 0.08, 0.15), shal = vec3(0.04, 0.24, 0.24);
  const body = mix(mix(deep, shal, shallow.mul(0.8)), vc.mul(vec3(0.7, 0.9, 1.2)), 0.25).mul(day.mul(0.85).add(0.15));
  const sky = mix(vec3(0.20, 0.34, 0.60), vec3(0.55, 0.68, 0.85), pow(float(1).sub(cosV), 3.0)).mul(day.mul(0.9).add(0.05));
  const near = smoothstep(9000.0, 600.0, dist); // ripple detail is resolved: sharp glint; far: broad statistical glint
  const R = reflect(V.negate(), n), rl = saturate(dot(R, L));
  const glint = pow(rl, mix(float(60), float(900), near)).mul(mix(float(2.0), float(14.0), near)).mul(fres.mul(4).add(0.2)).mul(day).mul(smoothstep(0.0, 0.08, ndl));
  let color = body.mul(float(1).sub(fres)), foam = float(0); // sky reflection is light, not albedo: it goes to emissive below
  if (T.caps) { const nz = mx_noise_float(p.mul(0.05).add(vec3(oceanTime.mul(0.4), 0, 0))); foam = foam.add(smoothstep(0.55, 0.9, crest.add(nz.mul(0.35))).mul(smoothstep(4000.0, 300.0, dist)).mul(0.8)); }
  if (T.surf) { const band = smoothstep(0.5, 0.58, w).mul(smoothstep(0.86, 0.62, w0.add(mx_noise_float(p.mul(0.002)).mul(0.08))));
    const surge = sin(dot(p, vec3(0.6, 0.6, 0.5)).mul(0.08).sub(oceanTime.mul(1.1))).mul(0.5).add(0.5), nz2 = mx_noise_float(p.mul(0.03).add(vec3(0, oceanTime.mul(0.3), 0)));
    foam = foam.add(band.mul(smoothstep(0.35, 0.8, surge.mul(0.7).add(nz2.mul(0.4)))).mul(smoothstep(12000.0, 500.0, dist))); }
  color = mix(color, vec3(0.85, 0.88, 0.9).mul(day.mul(0.9).add(0.1)), saturate(foam));
  const nView = normalize(cameraViewMatrix.mul(vec4(n, 0)).xyz);
  const DBG = typeof location !== 'undefined' ? +(new URLSearchParams(location.search).get('oceandbg') || 0) : 0; // test-only: 1 day, 2 fresnel, 3 near, 4 crest
  if (DBG) { const v = [day, fres, near, crest.mul(0.5).add(0.5), w, float(1)][DBG - 1]; return { color: vec3(0, 0, 0), emissive: vec3(v, v, v).mul(2), rough: float(1), normalView: nView }; }
  return { color, emissive: glint.mul(vec3(1.0, 0.92, 0.8)).add(sky.mul(fres).mul(float(1).sub(saturate(foam)))), rough: mix(float(0.32), float(0.06), near), normalView: nView };
}
// high tier: vertex displacement of the two longest swells near the camera (tile vertices ~100 m apart at the centre)
export function oceanDisplace(w0Attr, tier) {
  if (!(OCEAN_TIERS[tier] || {}).displace) return null;
  const dist = length(positionWorld.sub(cameraPosition)), { h } = waveTerms(positionLocal, dist, [0, 1]);
  return positionLocal.add(normalLocal.mul(h.mul(smoothstep(0.6, 0.9, w0Attr)).mul(smoothstep(6000.0, 1500.0, dist))));
}

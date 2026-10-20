// Shared TSL helpers for gfx/world (equirect lookup, ray/sphere, noise detail normals).
import { float, vec2, vec3, normalize, dot, sqrt, max, min, atan, acos, clamp, mx_noise_float, length } from 'three/tsl';
export const PI = Math.PI;
// unit direction -> equirect uv (SphereGeometry convention)
export const dirUV = d => vec2(atan(d.z, d.x.negate()).div(2 * PI).fract(), float(1).sub(acos(clamp(d.y, -1, 1)).div(PI)));
// ray (origin relative to sphere centre, unit dir) vs sphere radius r -> vec2(tNear, tFar); tFar < tNear => miss.
// c is written as (|o|-r)(|o|+r) so it stays precise in km units right at the surface.
export function raySphere(o, d, r) {
  const b = dot(o, d).toVar(), lo = length(o).toVar(), c = lo.sub(r).mul(lo.add(r)), h = b.mul(b).sub(c).toVar();
  const s = sqrt(max(h, 0.0)).toVar(), miss = h.lessThan(0.0);
  return vec2(miss.select(float(1e9), b.negate().sub(s)), miss.select(float(-1e9), b.negate().add(s)));
}
// fbm-ish value noise sum (octaves fixed at build time)
export function fbm(p, oct) { let s = float(0), a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s = s.add(mx_noise_float(p.mul(f)).mul(a)); a *= 0.5; f *= 2.07; } return s; }
// perturb unit normal n by the gradient of fbm(p*freq) projected on the tangent plane (finite differences)
export function detailNormal(n, p, freq, amp, oct) {
  const e = 0.35, q = p.mul(freq), h0 = fbm(q, oct);
  const g = vec3(fbm(q.add(vec3(e, 0, 0)), oct).sub(h0), fbm(q.add(vec3(0, e, 0)), oct).sub(h0), fbm(q.add(vec3(0, 0, e)), oct).sub(h0)).div(e);
  const gt = g.sub(n.mul(dot(g, n)));
  return normalize(n.sub(gt.mul(amp)));
}
export { min, max };

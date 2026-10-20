// f5 world-1: detail-tuned surface materials for Earth, Moon and Mars (no atmosphere/bloom changes; those wait for f4.1).
// Textures: CC BY 4.0 Solar System Scope (see CREDITS.md). Detail is procedural (original): fbm detail normals that fade
// in as the camera gets close, coastline mask from the ocean-specular map, ocean sun glint + wave normals,
// cloud shadows (same weather map as clouds.js), warmer/tighter night lights dimmed under cloud, Moon regolith,
// Mars dust haze. UVs are computed from the surface direction so a high-res local ground cap can share the material.
import * as THREE from 'three/webgpu';
import { uniform, texture, float, vec2, vec3, positionWorld, cameraPosition, normalWorld, normalize, dot, length, mix, pow, saturate, smoothstep, max, abs, exp, vec4, cameraViewMatrix } from 'three/tsl';
import { WORLD_TIERS, CLOUD_LAYER } from './tiers.js?v=w1';
import { dirUV, detailNormal, fbm, PW, CP } from './common.js?v=w1';
export function surfaceUniforms(o = {}) { return { center: uniform(new THREE.Vector3()), sunDir: uniform(new THREE.Vector3(1, 0, 0)), R: uniform(o.R ?? 6371), time: uniform(0), cloudUV: o.cloudUV || uniform(new THREE.Vector2()), cloudShadow: uniform(o.cloudShadow ?? 0.6) }; }
const wrapU = v => vec2(v.x.fract(), v.y);
const toView = n => normalize(cameraViewMatrix.mul(vec4(n, 0.0)).xyz); // normalNode is view-space
const camAlt = U => length(CP.sub(U.center)).sub(U.R);
export function earthSurfaceMaterial(t, tier = 'high', U = surfaceUniforms()) {
  const T = WORLD_TIERS[tier], m = new THREE.MeshStandardNodeMaterial();
  const d = normalize(PW.sub(U.center)), uv = dirUV(d);
  const day = texture(t.day, uv).rgb, spec = texture(t.spec, uv).r, night = texture(t.night, uv).rgb;
  // coastline mask: specular-map gradient over a few texels (sharp land/sea edge, 1k map)
  const px = 1 / 1024, sx = texture(t.spec, uv.add(vec2(px * 1.5, 0))).r, sy = texture(t.spec, uv.add(vec2(0, px * 1.5))).r;
  const coast = saturate(abs(sx.sub(spec)).add(abs(sy.sub(spec))).mul(3.0));
  const ocean = smoothstep(0.35, 0.65, spec);
  const L = U.sunDir, n0 = normalWorld, ndl = dot(n0, L);
  // ocean: deeper blue offshore, turquoise shallows near the coast
  const deep = day.mul(vec3(0.62, 0.82, 1.08)), shallow = mix(day, vec3(0.08, 0.32, 0.36), 0.45);
  const land = pow(day, vec3(1.08)).mul(vec3(1.04, 1.0, 0.94));
  m.colorNode = mix(land, mix(deep, shallow, coast.mul(0.8)), ocean);
  // detail normals: land relief + ocean waves, fading with altitude so orbit views stay clean
  const alt = camAlt(U), near = smoothstep(400.0, 5.0, alt);
  const pkm = PW.sub(U.center);
  const landN = detailNormal(n0, pkm, 0.35, near.mul(0.55), T.detail);
  const waveN = detailNormal(n0, pkm.add(vec3(U.time.mul(0.003), 0, 0)), 2.2, smoothstep(60.0, 2.0, alt).mul(0.1), Math.min(T.detail, 2));
  m.normalNode = toView(normalize(mix(landN, waveN, ocean)));
  m.roughnessNode = mix(float(0.92), mix(float(0.16), float(0.3), smoothstep(30.0, 2000.0, alt)), ocean);
  m.metalnessNode = float(0);
  // cloud shadow: sample the weather map where the sun ray through this point crosses mid-layer height
  const hMid = (CLOUD_LAYER.base + CLOUD_LAYER.top) * 0.5;
  const ps = pkm.add(L.mul(float(hMid).div(max(ndl, 0.12)))), cs = texture(t.clouds, wrapU(dirUV(normalize(ps)).add(U.cloudUV))).r;
  const cshadow = T.shadows ? float(1).sub(saturate(cs.sub(0.18).mul(1.6)).mul(U.cloudShadow)) : float(1);
  m.colorNode = m.colorNode.mul(mix(float(1), cshadow, smoothstep(-0.1, 0.1, ndl)));
  // night lights: contrast curve (tight cores, faint suburbs), sodium/LED mix, dimmed under cloud, gone in daylight
  const nightK = smoothstep(0.08, -0.18, ndl), lum = dot(night, vec3(0.33));
  const cores = pow(saturate(lum.mul(1.4)), float(1.8)).mul(vec3(1.0, 0.78, 0.45)).mul(2.6);
  const glow = saturate(lum.sub(0.04)).mul(vec3(0.9, 0.6, 0.3)).mul(0.6);
  const cloudOver = float(1).sub(saturate(texture(t.clouds, wrapU(uv.add(U.cloudUV))).r.sub(0.18).mul(1.6)).mul(0.7));
  m.emissiveNode = cores.add(glow).mul(nightK).mul(cloudOver).mul(float(1).sub(ocean.mul(0.9)));
  m.userData.U = U; return m;
}
export function moonSurfaceMaterial(t, tier = 'high', U = surfaceUniforms({ R: 1737.4 })) {
  const T = WORLD_TIERS[tier], m = new THREE.MeshStandardNodeMaterial();
  const d = normalize(PW.sub(U.center)), uv = dirUV(d), base = texture(t.moon, uv).rgb;
  const pkm = PW.sub(U.center), alt = camAlt(U), near = smoothstep(300.0, 2.0, alt);
  // regolith: fine fbm albedo grain + small crater-ish pits; mid-scale ejecta brightening
  const grain = fbm(pkm.mul(40.0), T.detail).mul(0.5).add(0.5), ejecta = fbm(pkm.mul(0.6), 2).mul(0.5).add(0.5);
  m.colorNode = base.mul(mix(float(1), grain.mul(0.16).add(0.92), near)).mul(ejecta.mul(0.1).add(0.95)).mul(vec3(1.0, 0.985, 0.96));
  m.normalNode = toView(detailNormal(normalWorld, pkm, 6.0, near.mul(0.3).add(0.04), T.detail));
  m.roughnessNode = float(0.97); m.metalnessNode = float(0);
  m.userData.U = U; return m;
}
export function marsSurfaceMaterial(t, tier = 'high', U = surfaceUniforms({ R: 3389.5 })) {
  const T = WORLD_TIERS[tier], m = new THREE.MeshStandardNodeMaterial();
  const d = normalize(PW.sub(U.center)), uv = dirUV(d), base = texture(t.mars, uv).rgb;
  const pkm = PW.sub(U.center), alt = camAlt(U), near = smoothstep(300.0, 3.0, alt);
  const dunes = fbm(pkm.mul(9.0), T.detail).mul(0.5).add(0.5);
  m.colorNode = base.mul(mix(float(1), dunes.mul(0.14).add(0.93), near)).mul(vec3(1.05, 0.97, 0.9));
  m.normalNode = toView(detailNormal(normalWorld, pkm, 4.0, near.mul(0.25).add(0.04), T.detail));
  m.roughnessNode = float(0.95); m.metalnessNode = float(0);
  // dust haze: butterscotch aerial perspective by view grazing angle and path length, blue-ish at the terminator
  const V = normalize(CP.sub(PW)), mu = saturate(dot(normalWorld, V)), dist = length(CP.sub(PW));
  const ndl = dot(normalWorld, U.sunDir), lit = smoothstep(-0.15, 0.3, ndl);
  const path = float(1).sub(exp(dist.div(max(mu, 0.08)).mul(-0.0045)));
  const hazeCol = mix(vec3(0.35, 0.42, 0.55), vec3(0.82, 0.58, 0.38), smoothstep(0.0, 0.25, ndl));
  m.emissiveNode = hazeCol.mul(path.mul(0.55).mul(lit)).add(hazeCol.mul(pow(float(1).sub(mu), 4.0).mul(0.25).mul(lit)));
  m.userData.U = U; return m;
}
// geometry: whole sphere (lowered slightly) + optional high-res cap centred on a site so the ground is smooth at the pad
export function capGeometry(R, dir, halfAngleDeg = 8, seg = 256) {
  const g = new THREE.SphereGeometry(R, seg, seg, 0, Math.PI * 2, 0, THREE.MathUtils.degToRad(halfAngleDeg));
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir)); g.applyQuaternion(q); return g;
}

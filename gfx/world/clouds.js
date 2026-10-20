// f5 world-1: volumetric cloud layer in the spirit of KSP EVE/Scatterer.
// A raymarched shell between CLOUD_LAYER.base and .top (km) driven by a weather-map coverage texture
// (the licensed Earth cloud map; CC BY 4.0 Solar System Scope) eroded by 3D noise, lit by the Sun with
// Beer-Powder extinction and a dual-lobe Henyey-Greenstein phase, ambient sky term and Earth's shadow.
// Phones (tier 'low') get a 2D cloud sphere with fake self-shadowing instead. Units: 1 = 1 km.
import * as THREE from 'three/webgpu';
import { viewportDepthTexture, screenUV, perspectiveDepthToViewZ, cameraNear, cameraFar, Fn, If, vec2, uniform, texture, float, int, vec3, vec4, positionWorld, cameraPosition, normalize, dot, length, max, min, mix, exp, pow, saturate, smoothstep, mx_noise_float, normalWorld } from 'three/tsl';
import { WORLD_TIERS, CLOUD_LAYER } from './tiers.js?v=w1';
import { dirUV, raySphere, fbm } from './common.js?v=w1';
const hg = (c, g) => float(1 - g * g).div(pow(float(1 + g * g).sub(c.mul(2 * g)), 1.5)).mul(1 / (4 * Math.PI));
export function cloudUniforms(o = {}) {
  return { center: uniform(new THREE.Vector3()), sunDir: uniform(new THREE.Vector3(1, 0, 0)), R: uniform(o.R ?? 6371),
    base: uniform(o.base ?? CLOUD_LAYER.base), top: uniform(o.top ?? CLOUD_LAYER.top), coverage: uniform(o.coverage ?? 1.0),
    density: uniform(o.density ?? 0.8), time: uniform(0), offset: uniform(new THREE.Vector2(o.offsetU ?? 0, 0)), wind: uniform(new THREE.Vector3(0.004, 0, 0.0)), sunCol: uniform(new THREE.Color(1.0, 0.96, 0.9)), exposure: uniform(o.exposure ?? 1.0), camFwd: uniform(new THREE.Vector3(0, 0, -1)), capA: uniform(new THREE.Vector4()), capB: uniform(new THREE.Vector3()) };
}
// coverage 0..1 at unit direction d (weather map, contrast-boosted, wind-advected)
function coverageAt(weather, U, d) {
  const uv0 = dirUV(d).add(U.offset).add(U.wind.xy.mul(U.time)), uv = vec2(uv0.x.fract(), uv0.y).toVar(); // wrap in u (textures clamp by default)
  return saturate(texture(weather, uv).r.sub(0.08).mul(1.5).mul(U.coverage));
}
function densityAt(weather, U, p, oct) { // p relative to centre, km
  const r = length(p).toVar(), d = p.div(r).toVar(), h = saturate(r.sub(U.R).sub(U.base).div(U.top.sub(U.base))).toVar();
  const cov = coverageAt(weather, U, d).toVar();
  const topH = mix(float(0.4), float(1.0), cov).toVar(); // thick cover towers higher
  const prof = smoothstep(0.0, 0.08, h).mul(float(1).sub(smoothstep(topH.mul(0.5), topH, h)));
  if (oct === 0) return cov.mul(prof); // cheap light-sample density (no noise)
  const n = saturate(fbm(p.mul(0.14).toVar().add(vec3(U.time.mul(0.02), 0, 0)), oct).mul(2.6).add(0.5)); // billow 0..1
  const fine = oct > 1 ? mx_noise_float(p.mul(0.55)).mul(0.5).add(0.5) : float(0.5);
  // coverage remap (Schneider 2015): noise survives where it exceeds (1 - coverage); fine noise erodes the edges
  // far away (orbit) the billow noise aliases into speckle: blend to the smooth weather-map shape
  const nearK = smoothstep(260.0, 40.0, length(cameraPosition.sub(U.center)).sub(U.R));
  const shape = mix(smoothstep(0.4, 0.95, cov), saturate(n.sub(float(1).sub(cov)).div(max(cov, 0.05))), nearK);
  if (globalThis.W1VIEW) return vec3(cov, n, shape);
  // cumulus look: flat dark bases, cauliflower tops -> erode more with height, rounded by the profile
  const ero = fine.mul(mix(float(0.18), float(0.5), h)).mul(nearK);
  return saturate(shape.mul(prof).sub(ero.mul(float(1).sub(shape.mul(prof)))).mul(2.2));
}
export function volumetricCloudMaterial(weatherTex, tier = 'high', U = cloudUniforms(), o = {}) {
  const T = WORLD_TIERS[tier], N = T.steps, NL = T.light;
  const m = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, transparent: true, depthWrite: false, depthTest: true, premultipliedAlpha: true });
  m.blending = THREE.CustomBlending; m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor;
  const weather = weatherTex;
  m.colorNode = Fn(() => {
    const ro = cameraPosition.sub(U.center).toVar(), rd = normalize(positionWorld.sub(cameraPosition)).toVar();
    const Rt = U.R.add(U.top), Rb = U.R.add(U.base);
    const so = raySphere(ro, rd, Rt).toVar(), sg = raySphere(ro, rd, U.R.sub(0.05)).toVar();
    const t0 = max(so.x, 0.0).toVar(), t1 = so.y.toVar();
    If(sg.y.greaterThan(sg.x).and(sg.x.greaterThan(0.0)), () => { t1.assign(min(t1, sg.x)); }); // stop at the ground
    // depth-aware march: stop at opaque occluders. Default = analytic occluder spheres (rocket, tower: set U.occ0/occ1 =
    // centre xyz + radius w, km; w = 0 disables) which works on every backend incl. log-depth WebGL. Optional scene-depth path
    // (o.sceneDepth) samples the depth buffer instead (perspective depth only; log depth reads back as 1 on WebGL2).
    { // capsule occluder: closest approach between the view ray and segment A-B (km, world); radius capA.w (0 = off)
      const A = U.capA.xyz.sub(U.center), ba = U.capB.sub(U.capA.xyz), oa = ro.sub(A);
      const bb = dot(ba, ba), bd = dot(ba, rd), bo = dot(ba, oa), dd = dot(rd, oa);
      const den = max(bb.sub(bd.mul(bd)), 1e-9);
      const sSeg = saturate(bo.sub(bd.mul(dd)).div(den)), tRay = max(bd.mul(sSeg).sub(dd), 0.0).toVar(); // ray param at closest approach
      const miss = length(ro.add(rd.mul(tRay)).sub(A.add(ba.mul(sSeg))));
      If(U.capA.w.greaterThan(0.0).and(miss.lessThan(U.capA.w)), () => { t1.assign(min(t1, tRay)); });
    }
    if (o.sceneDepth) {
      const d = viewportDepthTexture(screenUV).r, vz = perspectiveDepthToViewZ(d, cameraNear, cameraFar);
      If(d.lessThan(0.99999), () => { t1.assign(min(t1, vz.negate().div(max(dot(rd, U.camFwd), 1e-3)))); });
    }
    const alt = length(ro).sub(U.R);
    // above the layer looking down: skip the empty gap below the cloud base (saves samples from orbit)
    const sb = raySphere(ro, rd, Rb).toVar();
    If(alt.greaterThan(U.top).and(sb.x.greaterThan(0.0)).and(sb.y.greaterThan(sb.x)), () => { t1.assign(min(t1, sb.x)); });
    If(alt.lessThan(U.base).and(sb.y.greaterThan(0.0)), () => { t0.assign(max(t0, sb.y)); }); // below base: start at base
    if (globalThis.W1VIEW) { const sm = raySphere(ro, rd, U.R.add(U.base.add(U.top).mul(0.5))); const pm = ro.add(rd.mul(max(sm.x, sm.y.mul(alt.lessThan(U.top).select(1.0, 0.0))))); return vec4(densityAt(weather, U, pm, 2), 1); }
    const span = max(t1.sub(t0), 0.0).toVar(), dt = span.div(N).toVar();
    const jitter = mx_noise_float(positionWorld.mul(37.1)).mul(0.5).add(0.5).toVar();
    const Tr = float(1).toVar(), acc = vec3(0).toVar();
    const cth = dot(rd, U.sunDir), phase = mix(hg(cth, -0.25), hg(cth, 0.75), 0.6).mul(4 * Math.PI).toVar();
    // unrolled at build time (N is a tier constant): straight-line code is much faster on mobile/software GPUs than a dynamic loop
    for (let i = 0; i < N; i++) {
      const t = t0.add(float(i).add(jitter).mul(dt)), p = ro.add(rd.mul(t)).toVar();
      const den = densityAt(weather, U, p, tier === 'high' ? 2 : 1).toVar();
      let od = float(0); const ls = U.top.sub(U.base).mul(0.3);
      for (let k = 1; k <= NL; k++) od = od.add(densityAt(weather, U, p.add(U.sunDir.mul(ls.mul(k * k))), 0).mul(ls.mul(2 * k - 1)));
      od = od.toVar();
      const sig = U.density.mul(den).toVar(), sunUp = dot(normalize(p), U.sunDir).toVar();
      const earthShadow = smoothstep(-0.12, 0.04, sunUp);
      const beer = exp(od.mul(U.density).mul(1.6).negate()), powder = float(1).sub(exp(od.mul(U.density).mul(-2.0).sub(sig.mul(4.0))));
      const sunLight = vec3(U.sunCol).mul(beer.mul(mix(float(1), powder, 0.5)).mul(phase).mul(earthShadow).mul(0.95));
      const sunset = mix(vec3(1.0, 0.5, 0.25), vec3(1), smoothstep(0.0, 0.25, sunUp));
      const h = saturate(length(p).sub(Rb).div(U.top.sub(U.base)));
      const amb = mix(vec3(0.10, 0.13, 0.19), vec3(0.34, 0.42, 0.56), h).mul(smoothstep(-0.2, 0.15, sunUp).mul(0.9).add(0.02));
      const a = exp(sig.mul(dt).negate()).toVar();
      acc.addAssign(sunLight.mul(sunset).add(amb).mul(Tr).mul(float(1).sub(a)));
      Tr.mulAssign(a);
    }
    // fade with long grazing paths so the far limb merges into the 2D look rather than banding
    return vec4(acc.mul(U.exposure), float(1).sub(Tr));
  })();
  m.userData.U = U; return m;
}
// 2D fallback (phones, and from far orbit when volumetric is off): lit cloud sphere with fake thickness.
export function flatCloudMaterial(weatherTex, U = cloudUniforms()) {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  const d = normalize(positionWorld.sub(U.center)), cov = coverageAt(weatherTex, U, d);
  const sunUp = dot(normalWorld, U.sunDir), shade = smoothstep(-0.15, 0.35, sunUp);
  const thick = saturate(cov.mul(1.3)); // thicker -> greyer base when lit from low sun
  const lit = mix(vec3(1.0, 0.55, 0.32), vec3(0.98, 0.98, 1.0), smoothstep(0.0, 0.3, sunUp)).mul(mix(float(1), float(0.72), thick.mul(float(1).sub(shade))));
  m.colorNode = vec4(lit.mul(shade.mul(0.95).add(0.03)), smoothstep(0.3, 0.95, cov).mul(0.95));
  m.userData.U = U; return m;
}
// Build the cloud object. Returns { mesh, U, setSun(dirVec3), update(dt, camAltKm) }.
export function createClouds({ weatherTex, tier = 'high', R = 6371, U = cloudUniforms({ R }), sceneDepth = false } = {}) {
  const T = WORLD_TIERS[tier];
  const geo = T.volumetric ? new THREE.SphereGeometry(R + U.top.value, 96, 48) : new THREE.SphereGeometry(R + 6.0, 192, 96) /* facet sag < 1 km so the shell never dips under the ground cap */;
  const mat = T.volumetric ? volumetricCloudMaterial(weatherTex, tier, U, { sceneDepth }) : flatCloudMaterial(weatherTex, U);
  const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = 5; mesh.frustumCulled = false; mesh.name = 'clouds-' + (T.volumetric ? 'volumetric' : '2d');
  return { mesh, U, tier, setSun(v) { U.sunDir.value.copy(v).normalize(); }, // depth-tested against opaque scene: draw the shell's far side when the camera is inside the layer, near side from above
    update(dt, camera) { U.time.value += dt; if (camera) camera.getWorldDirection(U.camFwd.value); if (camera && T.volumetric) { const alt = camera.position.distanceTo(U.center.value) - U.R.value; const side = alt < U.top.value ? THREE.BackSide : THREE.FrontSide; if (mat.side !== side) { mat.side = side; mat.needsUpdate = true; } } },
    // occluder capsule from a vertical object (rocket/tower): its world bounding box's axis along localUp, or null to clear
    setOccluder(obj, up) { if (!obj) { U.capA.value.w = 0; return; }
      // local-space extents (identity transform), then place the axis with the object's world transform
      const p = obj.position.clone(), q = obj.quaternion.clone(), sc = obj.scale.clone(), par = obj.parent; obj.position.set(0, 0, 0); obj.quaternion.identity(); obj.scale.set(1, 1, 1); if (par) par.remove(obj);
      obj.updateMatrixWorld(true); const lb = new THREE.Box3().setFromObject(obj); obj.position.copy(p); obj.quaternion.copy(q); obj.scale.copy(sc); if (par) par.add(obj); obj.updateMatrixWorld(true);
      const s = lb.getSize(new THREE.Vector3()), k = Math.max(sc.x, sc.y, sc.z), r = Math.min(Math.max(s.x, s.z) * 0.5, (lb.max.y - Math.max(lb.min.y, 0)) * 0.03) * k; // legs/fins/stray LOD extents would over-clip: cap at a slender-stack radius
      const A = new THREE.Vector3(0, Math.max(lb.min.y, 0), 0).applyMatrix4(obj.matrixWorld), B = new THREE.Vector3(0, lb.max.y, 0).applyMatrix4(obj.matrixWorld);
      U.capA.value.set(A.x, A.y, A.z, r); U.capB.value.copy(B); },
    dispose() { geo.dispose(); mat.dispose(); } };
}

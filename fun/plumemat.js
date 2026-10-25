// fx-4 (QA f5.6s plumes 2.5/5): soft-edged exhaust shells. The plume cones and the vacuum bell were plain additive
// meshes, so every silhouette was a hard line (Heavy / Sparrow-1 "cones", the upper stage's maroon "dome", the big
// translucent halo at New Glendale separation). These node materials fade each surface by how squarely it faces the
// camera (|n·v|^k): the shell's middle stays bright and its edges dissolve, from any angle.
import * as THREE from 'three/webgpu';
const T = THREE.TSL;
import { SOFT_K, VAC_PLUME } from '../fxmap.js?v=f5.8x';
export { SOFT_K, VAC_PLUME };
export function softPlumeMaterial({ color = 0xffffff, opacity = 1, k = 1.5, vertexColors = false } = {}) {
  const m = new THREE.MeshBasicNodeMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, vertexColors });
  const nv = T.abs(T.dot(T.normalize(T.normalView), T.normalize(T.positionView.negate())));
  let c = T.materialColor.mul(T.pow(T.clamp(nv, 0, 1), T.float(k)));
  if (vertexColors) c = c.mul(T.vertexColor());
  m.colorNode = c; m.opacityNode = T.materialOpacity; m.userData.softK = k;
  return m;
}

// plume-soft-1: the vacuum shell. A lathe whose uv.y runs 0 (nozzle rim) .. 1 (far end): alpha = facing^radialK * (1-v)^axialK * a short ramp-in, so nothing is a hard edge:
// the sides dissolve with the view angle, the far end fades to 0, and it starts exactly at the bell exit. Additive, depthWrite off.
export function vacPlumeMaterial({ color = 0xc4d8ff, opacity = 0 } = {}) {
  const m = new THREE.MeshBasicNodeMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  const nv = T.abs(T.dot(T.normalize(T.normalView), T.normalize(T.positionView.negate()))), v = T.uv().y;
  const axial = T.pow(T.clamp(T.float(1).sub(v), 0, 1), T.float(VAC_PLUME.axialK)), ramp = T.smoothstep(T.float(0), T.float(VAC_PLUME.ramp), v);
  m.colorNode = T.materialColor.mul(T.pow(T.clamp(nv, 0, 1), T.float(VAC_PLUME.radialK))).mul(axial).mul(ramp); m.opacityNode = T.materialOpacity;
  m.userData.vacPlume = { radialK: VAC_PLUME.radialK, axialK: VAC_PLUME.axialK };
  return m;
}

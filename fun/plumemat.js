// fx-4 (QA f5.6s plumes 2.5/5): soft-edged exhaust shells. The plume cones and the vacuum bell were plain additive
// meshes, so every silhouette was a hard line (Heavy / Sparrow-1 "cones", the upper stage's maroon "dome", the big
// translucent halo at New Glendale separation). These node materials fade each surface by how squarely it faces the
// camera (|n·v|^k): the shell's middle stays bright and its edges dissolve, from any angle.
import * as THREE from 'three/webgpu';
const T = THREE.TSL;
import { SOFT_K } from '../fxmap.js?v=f5.7h';
export { SOFT_K };
export function softPlumeMaterial({ color = 0xffffff, opacity = 1, k = 1.5, vertexColors = false } = {}) {
  const m = new THREE.MeshBasicNodeMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, vertexColors });
  const nv = T.abs(T.dot(T.normalize(T.normalView), T.normalize(T.positionView.negate())));
  let c = T.materialColor.mul(T.pow(T.clamp(nv, 0, 1), T.float(k)));
  if (vertexColors) c = c.mul(T.vertexColor());
  m.colorNode = c; m.opacityNode = T.materialOpacity; m.userData.softK = k;
  return m;
}

// Orbit Rush airflow and heating effects, driven every frame by the physics telemetry (v.tel) through the
// pure mappings in fxmap.js. Everything here lives in the rocket's body frame (a child of the rocket group:
// +Y is the nose, y = 0 the bottom of the attached stack), so it moves and turns with the craft.
//  - Flow particles: air streaming around the body along the real flow direction (tel.flowBody), advected through
//    a potential-flow field (a Rankine source/sink pair on the axis + a crossflow doublet around it) and slowed /
//    brightened where they cross the shock cone. WebGPU: a TSL compute shader updates the particle buffers on the
//    GPU. WebGL2 fallback: the same field is integrated on the CPU into instanced attributes.
//  - Shock cone / bow shock (Mach angle, standoff), compressed-air glow, transonic vapor cone (condensation collar),
//    reentry plasma (bow cap, windward body glow, wake), coloured by stagnation temperature.
import * as THREE from 'three/webgpu';
import { fxState, QUALITY, shockStandoff } from './fxmap.js?v=f5.6o';
const T = THREE.TSL;
const { Fn, If, instancedArray, instancedBufferAttribute, instanceIndex, uniform, vec3, vec4, float, hash, length, normalize, dot, cross, max, mix,
  smoothstep, exp, sqrt, clamp, abs, sin, cos, uv, positionLocal, normalLocal, normalView, positionView, pow, oneMinus, texture, time, vec2 } = T;

// ---------- the flow field (CPU version; the GPU version below is the same maths in TSL) ----------
function fieldCPU(u, px, py, pz, out) {
  const d = u.dir, S = u.speed, R = u.R;
  const ax = px - u.srcA.x, ay = py - u.srcA.y, az = pz - u.srcA.z, bx = px - u.srcB.x, by = py - u.srcB.y, bz = pz - u.srcB.z;
  const ra = Math.max(Math.hypot(ax, ay, az), R * 0.7), rb = Math.max(Math.hypot(bx, by, bz), R * 0.7), ka = u.m / (ra * ra * ra), kb = u.m / (rb * rb * rb);
  let vx = d.x * S + ax * ka - bx * kb, vy = d.y * S + ay * ka - by * kb, vz = d.z * S + az * ka - bz * kb;
  const cx = d.x * S, cz = d.z * S, r2 = Math.max(px * px + pz * pz, R * R * 0.81), rr = Math.sqrt(r2), hx = px / rr, hz = pz / rr;
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const win = sm(-R, R, py) * sm(-R, R, u.L - py), dc = (cx * hx + cz * hz) * 2, k = R * R / r2 * win;
  vx += (cx - hx * dc) * k; vz += (cz - hz * dc) * k;
  // shock cone: downstream of the apex, inside the Mach cone the flow is slowed (compressed)
  const qx = px - u.apex.x, qy = py - u.apex.y, qz = pz - u.apex.z, s = qx * d.x + qy * d.y + qz * d.z;
  const ox = qx - d.x * s, oy = qy - d.y * s, oz = qz - d.z * s, rad = Math.hypot(ox, oy, oz), cone = s * u.tanMu;
  const inside = sm(cone + 0.6, cone - 0.6, rad) * sm(0, 2, s), slow = 1 - inside * u.shock * 0.5;
  const near = Math.exp(-((rad - cone) ** 2) / 1.5) * sm(-0.5, 1.5, s);
  out[0] = vx * slow; out[1] = vy * slow; out[2] = vz * slow; out[3] = 0.35 + near * u.shock * 1.6 + inside * u.shock * 0.3;
}
class FlowParticles {
  constructor(n, gpu) {
    this.n = n; this.gpu = gpu;
    const V3 = (x = 0, y = 0, z = 0) => uniform(new THREE.Vector3(x, y, z));
    const U = this.U = { dir: V3(0, -1, 0), speed: uniform(50), srcA: V3(), srcB: V3(), m: uniform(1), R: uniform(1.25), L: uniform(40), dt: uniform(0), seed: uniform(0),
      center: V3(), box: uniform(30), spawnR: uniform(8), e1: V3(1, 0, 0), e2: V3(0, 0, 1), life: uniform(1), apex: V3(), tanMu: uniform(3), shock: uniform(0),
      cam: V3(), streak: uniform(0.03), width: uniform(0.1), inten: uniform(0), color: uniform(new THREE.Color(0.75, 0.86, 1.0)) };
    let cN, vN, bN, lN;
    if (gpu) {
      const pos = instancedArray(n, 'vec3'), vel = instancedArray(n, 'vec3'), life = instancedArray(n, 'float'), bri = instancedArray(n, 'float');
      this.computeNode = Fn(() => {
        const p = pos.element(instanceIndex), vv = vel.element(instanceIndex), lf = life.element(instanceIndex), b = bri.element(instanceIndex);
        const pa = p.sub(U.srcA), pb = p.sub(U.srcB);
        const ra = max(length(pa), U.R.mul(0.7)), rb = max(length(pb), U.R.mul(0.7));
        const v = U.dir.mul(U.speed).add(pa.mul(U.m.div(ra.mul(ra).mul(ra)))).sub(pb.mul(U.m.div(rb.mul(rb).mul(rb)))).toVar();
        const c = vec3(U.dir.x, 0, U.dir.z).mul(U.speed);
        const rho = vec3(p.x, 0, p.z), r2 = max(dot(rho, rho), U.R.mul(U.R).mul(0.81)), rh = rho.div(sqrt(r2));
        const win = smoothstep(U.R.negate(), U.R, p.y).mul(smoothstep(U.R.negate(), U.R, U.L.sub(p.y)));
        v.addAssign(c.sub(rh.mul(dot(c, rh).mul(2))).mul(U.R.mul(U.R).div(r2)).mul(win));
        const rel = p.sub(U.apex), s = dot(rel, U.dir), rr = length(rel.sub(U.dir.mul(s))), cone = s.mul(U.tanMu);
        const inside = smoothstep(cone.add(0.6), cone.sub(0.6), rr).mul(smoothstep(0, 2, s));
        v.mulAssign(float(1).sub(inside.mul(U.shock).mul(0.5)));
        const dd = rr.sub(cone), near = exp(dd.mul(dd).div(1.5).negate()).mul(smoothstep(-0.5, 1.5, s));
        b.assign(float(0.35).add(near.mul(U.shock).mul(1.6)).add(inside.mul(U.shock).mul(0.3)));
        p.addAssign(v.mul(U.dt));
        vv.assign(v);
        lf.subAssign(U.dt);
        If(lf.lessThan(0).or(length(p.sub(U.center)).greaterThan(U.box)), () => {
          const fi = float(instanceIndex);
          const h1 = hash(fi.add(U.seed)), h2 = hash(fi.mul(1.37).add(U.seed).add(17.0)), h3 = hash(fi.mul(2.11).add(U.seed).add(41.0));
          const ang = h1.mul(6.2831853), rad = sqrt(h2).mul(U.spawnR);
          p.assign(U.center.sub(U.dir.mul(U.box.mul(0.92))).add(U.e1.mul(cos(ang).mul(rad))).add(U.e2.mul(sin(ang).mul(rad))).add(U.dir.mul(h3.mul(U.box).mul(0.6))));
          lf.assign(U.life.mul(h3.mul(0.6).add(0.7)));
          vv.assign(U.dir.mul(U.speed));
        });
      })().compute(n);
      cN = pos.toAttribute(); vN = vel.toAttribute(); bN = bri.toAttribute(); lN = life.toAttribute();
    } else {
      this.P = new Float32Array(n * 3); this.Vv = new Float32Array(n * 3); this.Lf = new Float32Array(n); this.B = new Float32Array(n);
      this.aP = new THREE.InstancedBufferAttribute(this.P, 3); this.aV = new THREE.InstancedBufferAttribute(this.Vv, 3);
      this.aB = new THREE.InstancedBufferAttribute(this.B, 1); this.aL = new THREE.InstancedBufferAttribute(this.Lf, 1);
      for (const a of [this.aP, this.aV, this.aB, this.aL]) a.setUsage(THREE.DynamicDrawUsage);
      cN = instancedBufferAttribute(this.aP); vN = instancedBufferAttribute(this.aV); bN = instancedBufferAttribute(this.aB); lN = instancedBufferAttribute(this.aL);
      this.tmp = new Float32Array(4);
    }
    // velocity-aligned streaks: each instance is a quad stretched along its local flow velocity, facing the camera
    const mat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    mat.positionNode = Fn(() => {
      const dir = normalize(vN.add(vec3(0, 1e-5, 0))), toCam = normalize(U.cam.sub(cN)), side = normalize(cross(dir, toCam));
      const len = clamp(length(vN).mul(U.streak), 0.3, 16);
      return cN.add(dir.mul(positionLocal.y.mul(len))).add(side.mul(positionLocal.x.mul(U.width)));
    })();
    const e = uv().sub(0.5).mul(2), soft = clamp(float(1).sub(e.x.mul(e.x)), 0, 1).mul(clamp(float(1).sub(abs(e.y)), 0, 1));
    const fade = clamp(lN.div(U.life.mul(0.25)), 0, 1);
    mat.colorNode = vec4(U.color.mul(bN.mul(U.inten).mul(soft).mul(fade)), 1);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); this.mesh.count = n; this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
  }
  stepCPU(dt) {
    const u = {}; for (const k in this.U) u[k] = this.U[k].value;
    const n = this.n, P = this.P, Vv = this.Vv, Lf = this.Lf, B = this.B, o = this.tmp, d = u.dir, box2 = u.box * u.box;
    for (let i = 0; i < n; i++) {
      const j = i * 3; let x = P[j], y = P[j + 1], z = P[j + 2];
      fieldCPU(u, x, y, z, o);
      x += o[0] * dt; y += o[1] * dt; z += o[2] * dt; Lf[i] -= dt;
      const cx = x - u.center.x, cy = y - u.center.y, cz = z - u.center.z;
      if (Lf[i] < 0 || cx * cx + cy * cy + cz * cz > box2) {
        const ang = Math.random() * 6.2831853, rad = Math.sqrt(Math.random()) * u.spawnR, h3 = Math.random(), ca = Math.cos(ang) * rad, sa = Math.sin(ang) * rad, b = u.box;
        x = u.center.x - d.x * b * 0.92 + u.e1.x * ca + u.e2.x * sa + d.x * h3 * b * 0.6;
        y = u.center.y - d.y * b * 0.92 + u.e1.y * ca + u.e2.y * sa + d.y * h3 * b * 0.6;
        z = u.center.z - d.z * b * 0.92 + u.e1.z * ca + u.e2.z * sa + d.z * h3 * b * 0.6;
        Lf[i] = u.life * (0.7 + 0.6 * h3); o[0] = d.x * u.speed; o[1] = d.y * u.speed; o[2] = d.z * u.speed;
      }
      P[j] = x; P[j + 1] = y; P[j + 2] = z; Vv[j] = o[0]; Vv[j + 1] = o[1]; Vv[j + 2] = o[2]; B[i] = o[3];
    }
    this.aP.needsUpdate = this.aV.needsUpdate = this.aB.needsUpdate = this.aL.needsUpdate = true;
  }
  dispose() { this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

// ---------- shells ----------
// Unit hyperboloid "bow shock" profile: apex at y = 0, opening toward +Y, radius ~ y far from the apex and a
// rounded nose near it (k sets the bluntness). Scaled per frame: x/z by tan(angle)*H, y by H.
function bowGeometry(k, n = 40) {
  const pts = []; for (let i = 0; i <= n; i++) { const u = (i / n) ** 1.6; pts.push(new THREE.Vector2(Math.sqrt(u * (u + 2 * k)) / Math.sqrt(1 + 2 * k), u)); }
  return new THREE.LatheGeometry(pts, 48);
}
function noiseTexture() {
  const W = 256, H = 64, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'), img = c.createImageData(W, H);
  const rnd = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let a = 0, amp = 0.5, f = 1;
    for (let o = 0; o < 4; o++) { const gx = x / W * 8 * f, gy = y / H * 3 * f, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy, w = (ix % (8 * f));
      const v00 = rnd(w, iy), v10 = rnd((ix + 1) % (8 * f), iy), v01 = rnd(w, iy + 1), v11 = rnd((ix + 1) % (8 * f), iy + 1), sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      a += amp * (v00 + (v10 - v00) * sx + (v01 - v00) * sy + (v00 - v10 - v01 + v11) * sx * sy); amp *= 0.5; f *= 2; }
    const o = (y * W + x) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = 255; img.data[o + 3] = Math.max(0, Math.min(255, (a - 0.25) * 420));
  }
  c.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(cv); t.wrapS = THREE.RepeatWrapping; return t;
}
// Additive shell with a view-angle rim (bright where you look along the surface, like a real shock/plasma
// layer) and a fade along the profile (uv.y: 0 at the apex/front, 1 at the far end).
function rimMaterial(U, frontFade = 0.05, power = 1.5) {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const rim = oneMinus(abs(dot(normalize(normalView), normalize(positionView.negate())))), v = uv().y;
  const along = smoothstep(0, frontFade, v).mul(pow(oneMinus(v), power));
  m.colorNode = vec4(U.color.mul(U.inten).mul(pow(rim, 1.6).mul(0.85).add(0.15)).mul(along), 1);
  return m;
}
const qFrom = (obj, d) => obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);

export class FX {
  constructor({ gpu = false, quality = 'high' } = {}) {
    this.gpu = gpu; this._pc = new THREE.Color(); this.root = new THREE.Group(); this.root.name = 'fx'; this.q = quality; this.flow = null; this.compute = 0; this.last = null;
    const mkU = c => ({ color: uniform(new THREE.Color(c)), inten: uniform(0) });
    // shock cone / bow shock with compressed-air glow
    this.shockU = mkU(0x9fc4ff); this.shock = new THREE.Mesh(bowGeometry(0.03), rimMaterial(this.shockU, 0.03, 1.2)); this.shock.renderOrder = 6;
    // transonic vapor cone: a condensation collar flaring back from the shoulder, noisy and soft
    const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new THREE.Vector2(1.02 + 1.5 * Math.pow(t, 0.5), -t)); }
    this.vaporU = { inten: uniform(0) }; this.vaporTex = noiseTexture();
    const vm = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const vv = uv(), n = texture(this.vaporTex, vec2(vv.x.mul(2).add(time.mul(0.15)), vv.y.mul(0.9).add(time.mul(0.6)))).a;
    vm.colorNode = vec4(1, 1, 1, 1); vm.opacityNode = this.vaporU.inten.mul(n.mul(0.6).add(0.4)).mul(smoothstep(0, 0.05, vv.y)).mul(pow(oneMinus(vv.y), 1.2)).mul(1.5).min(0.92);
    this.vapor = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), vm); this.vapor.renderOrder = 7;
    // reentry plasma: bow cap hugging the windward end, windward body glow, and a long wake
    this.bowU = mkU(0xff9a40); this.bow = new THREE.Mesh(bowGeometry(0.14), rimMaterial(this.bowU, 0.02, 0.9)); this.bow.renderOrder = 8;
    this.wakeU = mkU(0xff9a40);
    const wp = []; for (let i = 0; i <= 20; i++) { const t = i / 20; wp.push(new THREE.Vector2(1 - 0.85 * Math.pow(t, 0.7), t)); }
    this.wake = new THREE.Mesh(new THREE.LatheGeometry(wp, 32), rimMaterial(this.wakeU, 0.04, 1.8)); this.wake.renderOrder = 8;
    this.shellU = { ...mkU(0xff9a40), flow: uniform(new THREE.Vector3(0, -1, 0)) };
    const sm = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const wind = max(dot(normalize(normalLocal), this.shellU.flow.negate()), 0);
    sm.colorNode = vec4(this.shellU.color.mul(this.shellU.inten).mul(pow(wind, 1.5).mul(0.9).add(0.06)), 1);
    const sg = new THREE.CylinderGeometry(1, 1, 1, 32, 6, false); sg.translate(0, 0.5, 0);
    this.shell = new THREE.Mesh(sg, sm); this.shell.renderOrder = 9;
    for (const m of [this.shock, this.vapor, this.bow, this.wake, this.shell]) { m.frustumCulled = false; m.visible = false; this.root.add(m); }
    this.setQuality(quality);
  }
  attach(parent) { if (this.root.parent !== parent) parent.add(this.root); }
  setQuality(q) {
    this.q = q; const Q = QUALITY[q];
    // particle sets are cached per quality and never disposed mid-flight (GPU storage buffers may still be in flight)
    if (this.flow) this.flow.mesh.visible = false;
    this.flows = this.flows || {};
    if (!this.flows[q]) { this.flows[q] = new FlowParticles(this.gpu ? Q.flowGPU : Q.flowCPU, this.gpu); this.root.add(this.flows[q].mesh); }
    this.flow = this.flows[q]; this.flow.mesh.visible = false;
  }
  hide() { for (const m of [this.shock, this.vapor, this.bow, this.wake, this.shell, this.flow.mesh]) m.visible = false; }
  // ctx: { tel, L, d (diameter), shoulderY, cam (THREE.Vector3 in the body frame), on }
  update(dt, ctx, renderer) {
    const tel = ctx.tel; if (!ctx.on || !tel) { this.hide(); return null; }
    const s = fxState(tel), Q = QUALITY[this.q], L = Math.max(ctx.L, 2), R = Math.max(ctx.d / 2, 0.5);
    const fb = tel.flowBody || [0, -1, 0], d = new THREE.Vector3(fb[0], fb[1], fb[2]).normalize();
    const noseFirst = d.y < 0, yW = noseFirst ? L : 0, yLee = L - yW, sg = noseFirst ? 1 : -1;
    const M = s.M, standoff = shockStandoff(Math.max(M, 1.05), tel.rnLead || 1) + 0.3;
    const apex = new THREE.Vector3(0, yW, 0).addScaledVector(d, -standoff);
    this.last = s;
    // --- flow particles ---
    const flowOn = s.flow > 0.01 && s.plasma > 0.05 && dt > 0, // f3: streak specks only in the reentry plasma regime
      F = this.flow, U = F.U; F.mesh.visible = flowOn;
    if (flowOn) {
      const vis = 25 + Math.min(tel.vAir, 2500) * 0.06, streakLen = Math.max(0.6, Math.min(12, tel.vAir * 0.005 + 0.6));
      const e1 = new THREE.Vector3().crossVectors(d, Math.abs(d.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize(), e2 = new THREE.Vector3().crossVectors(d, e1);
      U.dir.value.copy(d); U.speed.value = vis; U.R.value = R; U.L.value = L; U.m.value = vis * R * R / 4;
      U.srcA.value.set(0, yW - sg * 0.6 * R, 0); U.srcB.value.set(0, yLee + sg * 0.6 * R, 0);
      U.apex.value.copy(apex); U.tanMu.value = M > 1.02 ? Math.min(3, 1 / Math.sqrt(M * M - 1)) : 3; U.shock.value = s.shock;
      U.center.value.set(0, L / 2, 0); U.box.value = L * 0.6 + 10; U.spawnR.value = Math.max(R * 5, L * 0.22); U.e1.value.copy(e1); U.e2.value.copy(e2);
      U.life.value = 2 * U.box.value / vis; U.dt.value = Math.min(dt, 0.05); U.seed.value = Math.random() * 1000;
      U.cam.value.copy(ctx.cam); U.streak.value = streakLen / vis; U.width.value = 0.06 + 0.002 * L;
      // in the plasma regime the shock layer, not the free stream, dominates: dim the streaks and tint them with the plasma colour
      const pk = Math.min(1, s.plasma * 1.3), pc = s.plasmaColor;
      U.inten.value = s.flow * (this.gpu ? 0.38 : 0.8) * (1 + s.glow) * (1 - 0.93 * pk) * (this.gpu ? 1 - 0.4 * pk : 1);
      U.color.value.setRGB(0.72 + 0.28 * s.glow, 0.84 - 0.2 * s.glow, 1.0 - 0.55 * s.glow).lerp(this._pc.setRGB(pc[0], pc[1], pc[2]), pk);
      if (this.gpu) { renderer.compute(F.computeNode); this.compute++; } else F.stepCPU(U.dt.value);
    }
    // --- shock cone + compressed-air glow ---
    const shockI = Q.shock ? 0.08 * s.shock + 0.4 * s.glow : 0; // f3: a faint collar at the nose, never a sky-wide cone
    this.shock.visible = shockI > 0.02;
    if (this.shock.visible) {
      const H = Math.min(L * 0.18, 1.8 * ctx.d + 2), tn = Math.min(0.45, Math.tan(s.machAngle));
      this.shock.position.copy(apex); qFrom(this.shock, d); this.shock.scale.set(tn * H, H, tn * H);
      this.shockU.inten.value = Math.min(1.2, shockI);
      this.shockU.color.value.setRGB(0.62 + 0.38 * s.glow, 0.76 - 0.2 * s.glow, 1.0 - 0.6 * s.glow);
    }
    // --- vapor cone: only flying nose-first in humid transonic air ---
    this.vapor.visible = false; // f3: condensation now lives in the one exhaust/vapour trail (main.js emit)
    if (this.vapor.visible) {
      const len = 2.2 * ctx.d + 4; this.vapor.position.set(0, ctx.shoulderY, 0); this.vapor.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), d);
      this.vapor.scale.set(R, len, R); this.vaporU.inten.value = Math.min(1, s.vapor * 1.6);
    }
    // --- reentry plasma ---
    const pl = s.plasma, col = s.plasmaColor;
    this.bow.visible = pl > 0.01; this.wake.visible = Q.wake && pl > 0.03; this.shell.visible = Q.plasmaShell && pl > 0.02;
    if (this.bow.visible) {
      const blunt = L < 3 * ctx.d, H = blunt ? L * 1.6 + 2 : L * 1.25, tn = Math.max(blunt ? 1.5 * R / H : 0, Math.min(0.5, Math.tan(s.machAngle) * 1.3), 0.06);
      this.bow.position.set(0, yW, 0).addScaledVector(d, -(standoff + 0.2)); qFrom(this.bow, d); this.bow.scale.set(Math.max(tn * H, R * 1.15), H, Math.max(tn * H, R * 1.15));
      this.bowU.inten.value = Math.min(1.6, pl * 1.5); this.bowU.color.value.setRGB(col[0], col[1], col[2]);
    }
    if (this.wake.visible) {
      const Lw = L * 2.5 + 80 * pl + 10; this.wake.position.set(0, yLee, 0); qFrom(this.wake, d); this.wake.scale.set(R * 1.4, Lw, R * 1.4);
      this.wakeU.inten.value = pl * 0.9; this.wakeU.color.value.setRGB(col[0], col[1] * 0.85, col[2]);
    }
    if (this.shell.visible) {
      this.shell.scale.set(R * 1.08, L, R * 1.08); this.shell.position.set(0, 0, 0);
      this.shellU.flow.value.copy(d); this.shellU.inten.value = pl * 1.1; this.shellU.color.value.setRGB(col[0], col[1], col[2]);
    }
    return s;
  }
}

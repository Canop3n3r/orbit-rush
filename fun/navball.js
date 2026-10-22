// Navball: a small attitude sphere drawn per pixel into its own canvas (no WebGPU pass, ~10–20k pixels at 30 Hz).
// The ship's nose points out of the screen at the fixed reticle; the ball shows the local horizon (sky above,
// ground below), a pitch ladder every 10°, heading ticks along the horizon, and original markers for the
// flight directions. Pure math lives in navballProject / navballSample so tests can check it without a canvas.
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
// frame: nose (out of screen), top (screen up), right (screen right) — world unit vectors
export function shipFrame(nose, top) { const n = nrm(nose), t = nrm(top), r = nrm(cross(t, n)); return { n, t: cross(n, r), r }; }
// world direction → ball coords (x right, y up, in -1..1) and whether it is on the visible (front) side
export function navballProject(F, d) { const z = dot(d, F.n); return { x: dot(d, F.r), y: dot(d, F.t), front: z >= 0, z }; }
// local horizon frame at the craft: up, north, east (world)
export function horizonFrame(r) { const up = nrm(r); let e = cross([0, 0, 1], up); if (Math.hypot(...e) < 1e-6) e = [0, 1, 0]; e = nrm(e); return { up, east: e, north: cross(up, e) }; }
// pitch (deg, + above horizon) and heading (deg from north, clockwise) of a world direction
export function pitchHeading(H, d) { const u = dot(d, H.up), p = Math.asin(Math.max(-1, Math.min(1, u))) * 180 / Math.PI;
  const hd = (Math.atan2(dot(d, H.east), dot(d, H.north)) * 180 / Math.PI + 360) % 360; return { pitch: p, heading: hd }; }
// f5: nose attitude for the numeric readouts: heading (0-360, from north), pitch (+ above the horizon) and roll
// (deg, 0 = ship top toward the sky, + = rolled right) of the frame F in the horizon frame H
export function attitude(F, H) {
  const { pitch, heading } = pitchHeading(H, F.n), un = dot(H.up, F.n), u = [H.up[0] - F.n[0] * un, H.up[1] - F.n[1] * un, H.up[2] - F.n[2] * un];
  const roll = Math.hypot(...u) < 1e-4 ? 0 : Math.atan2(dot(u, F.r), dot(u, F.t)) * 180 / Math.PI;
  return { heading, pitch, roll };
}
export const MARKERS = { pro: '#7dffa6', retro: '#7dffa6', nrm: '#d58cff', anti: '#d58cff', radOut: '#4ad6ff', radIn: '#4ad6ff', node: '#5aa0ff', tgt: '#ff6ad5', antiTgt: '#ff6ad5' };
export function createNavball(canvas) {
  const g = canvas.getContext('2d'); let W = 0, img = null, last = 0, lastAtt = null;
  function size() { const w = canvas.width; if (w !== W) { W = w; img = g.createImageData(W, W); } }
  function draw(st, now = performance.now()) { // st: { nose, top, r, markers: {key: dir}, }
    if (now - last < 33) return lastAtt; last = now; size();
    const F = shipFrame(st.nose, st.top), H = horizonFrame(st.r), d = img.data, R = W / 2 - 1, R2 = R * R;
    // per pixel: direction on the front hemisphere = x·right + y·top + z·nose
    for (let j = 0; j < W; j++) { const y = (R - j) / R;
      for (let i = 0; i < W; i++) { const x = (i - R) / R, q = x * x + y * y, o = (j * W + i) * 4; if (q > 1) { d[o + 3] = 0; continue; }
        const z = Math.sqrt(1 - q), dx = x * F.r[0] + y * F.t[0] + z * F.n[0], dy = x * F.r[1] + y * F.t[1] + z * F.n[1], dz = x * F.r[2] + y * F.t[2] + z * F.n[2];
        const u = dx * H.up[0] + dy * H.up[1] + dz * H.up[2], el = Math.asin(Math.max(-1, Math.min(1, u))) * 57.2958;
        const sky = u >= 0, sh = 0.55 + 0.45 * z;                       // limb darkening
        let cr = sky ? 46 : 120, cg = sky ? 120 : 78, cb = sky ? 196 : 40;
        const m10 = Math.abs(el - Math.round(el / 10) * 10);           // pitch ladder
        if (Math.abs(el) < 0.9) { cr = cg = cb = 250; }
        else if (m10 < 0.45 && Math.abs(el) < 75) { cr = cr * 0.4 + 150; cg = cg * 0.4 + 150; cb = cb * 0.4 + 150; }
        else if (Math.abs(el) < 6) { const hd = Math.atan2(dx * H.east[0] + dy * H.east[1] + dz * H.east[2], dx * H.north[0] + dy * H.north[1] + dz * H.north[2]) * 57.2958;
          const m = Math.abs(hd - Math.round(hd / 15) * 15); if (m < (Math.round(hd / 45) * 45 === Math.round(hd / 15) * 15 ? 1.1 : 0.6) && Math.abs(el) < (Math.round(hd / 45) * 45 === Math.round(hd / 15) * 15 ? 5 : 3)) { cr = cg = cb = 235; } }
        d[o] = cr * sh; d[o + 1] = cg * sh; d[o + 2] = cb * sh; d[o + 3] = 255; } }
    g.putImageData(img, 0, 0);
    // f5 labels: heading numbers every 30° on the horizon (N/E/S/W at the cardinals), pitch numbers on the ladder
    const fs = Math.max(9, W / 13); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    const lab = (t, x, y, f, col = '#0b1424', halo = '#ffffffb0') => { g.font = `800 ${f}px system-ui`; g.lineWidth = Math.max(2, f / 4); g.strokeStyle = halo; g.strokeText(t, x, y); g.fillStyle = col; g.fillText(t, x, y); };
    for (let a = 0; a < 360; a += 30) { const rad = a * Math.PI / 180, dir = [0, 1, 2].map(k => H.north[k] * Math.cos(rad) + H.east[k] * Math.sin(rad));
      const p = navballProject(F, dir); if (p.z > 0.2) lab(a % 90 ? String(a / 10).padStart(2, '0') : 'NESW'[a / 90], R + p.x * R, R - p.y * R - W / 16, a % 90 ? fs * 0.8 : fs); }
    { const nh = pitchHeading(H, F.n).heading * Math.PI / 180; // ladder numbers along the meridian under the nose
      for (const el of [-60, -30, -20, -10, 10, 20, 30, 60]) { const e = el * Math.PI / 180, c = Math.cos(e), sE = Math.sin(e);
        const dir = [0, 1, 2].map(k => (H.north[k] * Math.cos(nh) + H.east[k] * Math.sin(nh)) * c + H.up[k] * sE), p = navballProject(F, dir);
        if (p.z > 0.25) lab(String(Math.abs(el)), R + p.x * R + W / 7, R - p.y * R, fs * 0.72, '#ffffff', '#0b1424c0'); } }
    // roll bezel: fixed ticks at 0/±10/±20/±30/±45/±60 along the top edge, a pointer at the current roll
    const att = attitude(F, H); g.strokeStyle = '#ffffffc0'; g.lineWidth = Math.max(1.2, W / 90);
    for (const a of [0, 10, 20, 30, 45, 60, -10, -20, -30, -45, -60]) { const t = (a - 90) * Math.PI / 180, l = a % 30 === 0 ? W / 14 : W / 24;
      g.beginPath(); g.moveTo(R + Math.cos(t) * R, R + Math.sin(t) * R); g.lineTo(R + Math.cos(t) * (R - l), R + Math.sin(t) * (R - l)); g.stroke(); }
    { const t = (Math.max(-75, Math.min(75, att.roll)) - 90) * Math.PI / 180, rr = R - W / 12, s2 = W / 22; g.save(); g.translate(R + Math.cos(t) * rr, R + Math.sin(t) * rr); g.rotate(t + Math.PI / 2);
      g.beginPath(); g.moveTo(0, -s2); g.lineTo(s2 * 0.8, s2 * 0.6); g.lineTo(-s2 * 0.8, s2 * 0.6); g.closePath(); g.fillStyle = '#ffcf4a'; g.fill(); g.restore(); }
    lastAtt = att;
    for (const [k, dir] of Object.entries(st.markers || {})) { if (!dir) continue; const p = navballProject(F, dir); if (!p.front) continue; const big = k === 'pro' || k === 'retro', mx = R + p.x * R, my = R - p.y * R; // f5.5d: bold, labelled prograde / retrograde
      if (big) { g.save(); g.globalAlpha = 0.85; mark(k, mx, my, Math.max(9, W / 8.5), '#0b1424', 2.2); g.restore(); } mark(k, mx, my, big ? Math.max(9, W / 8.5) : Math.max(5, W / 13));
      if (big) lab(k === 'pro' ? 'PRO' : 'RETRO', mx, my + Math.max(9, W / 8.5) + fs * 0.55, fs * 0.7, MARKERS[k], '#0b1424e0'); }
    if (st.ghost && st.ghost.n) { const p = navballProject(F, st.ghost.n), off = Math.acos(Math.max(-1, Math.min(1, p.z))); // f5.6h: ghost of the trackball target until the ship catches up
      if (off > 0.017 || (st.ghost.t && Math.abs(Math.atan2(dot(cross(F.t, st.ghost.t), F.n), dot(F.t, st.ghost.t))) > 0.03)) { const k = p.front ? 1 : 1 / Math.max(1e-6, Math.hypot(p.x, p.y)), gx = R + p.x * k * R * (p.front ? 1 : 0.92), gy = R - p.y * k * R * (p.front ? 1 : 0.92);
        const gt = st.ghost.t ? Math.atan2(dot(st.ghost.t, F.r), dot(st.ghost.t, F.t)) : 0, s = W / 9; g.save(); g.translate(gx, gy); g.rotate(gt); g.setLineDash([W / 40, W / 50]); g.strokeStyle = '#ffffffd0'; g.lineWidth = Math.max(2, W / 60); g.lineCap = 'round'; g.beginPath();
        g.moveTo(-s * 1.6, 0); g.lineTo(-s * 0.6, 0); g.lineTo(0, s * 0.5); g.lineTo(s * 0.6, 0); g.lineTo(s * 1.6, 0); g.stroke(); g.setLineDash([]); g.beginPath(); g.arc(0, 0, W / 30, 0, 7); g.stroke(); g.restore(); } }
    // fixed ship reticle (original: a winged chevron)
    g.strokeStyle = '#ffcf4a'; g.lineWidth = Math.max(2, W / 50); g.lineCap = 'round'; g.beginPath();
    const s = W / 9; g.moveTo(R - s * 1.6, R); g.lineTo(R - s * 0.6, R); g.lineTo(R, R + s * 0.5); g.lineTo(R + s * 0.6, R); g.lineTo(R + s * 1.6, R); g.stroke();
    g.beginPath(); g.arc(R, R, W / 50, 0, 7); g.fillStyle = '#ffcf4a'; g.fill();
    g.beginPath(); g.arc(R, R, R, 0, 7); g.strokeStyle = '#ffffff40'; g.lineWidth = 1.5; g.stroke();
    return att;
  }
  function mark(k, x, y, s, col, lw = 1) { // original iconography
    g.save(); g.translate(x, y); g.strokeStyle = col || MARKERS[k]; g.fillStyle = col || MARKERS[k]; g.lineWidth = Math.max(1.6, s / 4) * lw; g.beginPath();
    switch (k) {
      case 'pro': g.moveTo(0, -s); g.lineTo(s, 0); g.lineTo(0, s); g.lineTo(-s, 0); g.closePath(); g.stroke(); g.beginPath(); g.arc(0, 0, s / 4, 0, 7); g.fill(); break;   // ◇ with a dot
      case 'retro': g.moveTo(0, -s); g.lineTo(s, 0); g.lineTo(0, s); g.lineTo(-s, 0); g.closePath(); g.moveTo(-s / 2, -s / 2); g.lineTo(s / 2, s / 2); g.moveTo(s / 2, -s / 2); g.lineTo(-s / 2, s / 2); g.stroke(); break; // ◇ with ×
      case 'nrm': g.moveTo(0, -s); g.lineTo(s * 0.9, s * 0.7); g.lineTo(-s * 0.9, s * 0.7); g.closePath(); g.stroke(); break;            // △
      case 'anti': g.moveTo(0, s); g.lineTo(s * 0.9, -s * 0.7); g.lineTo(-s * 0.9, -s * 0.7); g.closePath(); g.stroke(); break;         // ▽
      case 'radOut': g.rect(-s * 0.75, -s * 0.75, s * 1.5, s * 1.5); g.moveTo(0, -s * 0.45); g.lineTo(0, s * 0.45); g.moveTo(-s * 0.45, 0); g.lineTo(s * 0.45, 0); g.stroke(); break; // ⊞
      case 'radIn': g.rect(-s * 0.75, -s * 0.75, s * 1.5, s * 1.5); g.stroke(); g.beginPath(); g.arc(0, 0, s / 4, 0, 7); g.fill(); break;   // ▣
      case 'node': for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.moveTo(0, 0); g.lineTo(Math.cos(a) * s * 1.1, Math.sin(a) * s * 1.1); } g.stroke(); g.beginPath(); g.arc(0, 0, s * 0.45, 0, 7); g.stroke(); break; // ✛ in ring
      case 'tgt': case 'antiTgt': g.arc(0, 0, s * 0.8, 0, 7); g.moveTo(-s * 1.2, 0); g.lineTo(-s * 0.4, 0); g.moveTo(s * 1.2, 0); g.lineTo(s * 0.4, 0); g.moveTo(0, -s * 1.2); g.lineTo(0, -s * 0.4); g.stroke(); if (k === 'antiTgt') { g.beginPath(); g.moveTo(-s / 2, -s / 2); g.lineTo(s / 2, s / 2); g.stroke(); } break;
    }
    g.restore();
  }
  return { draw, canvas };
}

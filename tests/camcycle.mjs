import { CAM_VIEWS, nextCamView, horizonChase, groundShot } from '../fun/camcycle.js';
let p = 0, f = 0; const t = (c, m) => { if (c) { p++; console.log('  ✔ ' + m); } else { f++; console.log('  ✘ ' + m); } };

t(CAM_VIEWS.join() === 'ground,horizon,vehicle,free', 'cycle order is ground, horizon, vehicle, free');
const seq = []; let v = 'vehicle'; for (let i = 0; i < 4; i++) { v = nextCamView(v, true); seq.push(v); }
t(seq.join() === 'free,ground,horizon,vehicle', 'from the vehicle camera, V steps free → ground → horizon → vehicle (' + seq.join(' → ') + ')');
t(nextCamView('vehicle', true) === 'free' && nextCamView('free', true) === 'ground', 'two presses from vehicle reach ground');
const orb = []; v = 'vehicle'; for (let i = 0; i < 3; i++) { v = nextCamView(v, false); orb.push(v); }
t(orb.join() === 'free,horizon,vehicle' && !orb.includes('ground'), 'above the pad the ground tripod drops out (' + orb.join(' → ') + ')');

const pad = horizonChase({ alt: 30, stackL: 50 });
t(pad.meaningful && pad.dist >= 200 && pad.pitch > 0.08, `pad horizon frames the limb (frac ${pad.frac.toFixed(2)} from top, pitch ${pad.pitch.toFixed(2)}, dist ${pad.dist.toFixed(0)})`);
const climb = horizonChase({ alt: 12000, stackL: 50 });
t(climb.meaningful && climb.pitch > pad.pitch, `climb keeps the limb in frame (frac ${climb.frac.toFixed(2)}, pitch ${climb.pitch.toFixed(2)})`);
const orbH = horizonChase({ alt: 200000, stackL: 40, inOrbit: true, orbitDist: 70 });
t(orbH.meaningful && orbH.dist > 70 && Math.abs(orbH.pitch - orbH.dip) < orbH.dip * 0.25, `orbit rests the craft on the limb (frac ${orbH.frac.toFixed(2)}, pitch ${orbH.pitch.toFixed(2)}, dip ${orbH.dip.toFixed(2)})`);

const g1 = groundShot({ zoom: 1, stackL: 48, rocketAlt: 24 });
t(g1.meaningful && g1.horizonIn && g1.rocketIn, `ground zoom 1 shows the horizon (frac ${g1.frac.toFixed(2)}, fov ${g1.fovDeg.toFixed(1)}°, rocket ${g1.rocketIn})`);
const gWide = groundShot({ zoom: 4, stackL: 48, rocketAlt: 24 });
t(gWide.meaningful && gWide.horiz > g1.horiz * 1.5 && gWide.fov > g1.fov, `zoom out dollies back and opens toward the horizon (${g1.horiz.toFixed(0)} m / ${g1.fovDeg.toFixed(0)}° → ${gWide.horiz.toFixed(0)} m / ${gWide.fovDeg.toFixed(0)}°)`);
const gIn = groundShot({ zoom: 0.25, stackL: 48, rocketAlt: 24 });
t(gIn.fov < g1.fov * 0.55 && gIn.rocketIn, `zoom in tightens on the rocket (${gIn.fovDeg.toFixed(1)}° < ${g1.fovDeg.toFixed(1)}°)`);
const gHigh = groundShot({ zoom: 3, stackL: 48, rocketAlt: 8000 });
t(gHigh.horizonIn && gHigh.rocketIn && gHigh.frac > 0.16 && gHigh.frac < 0.72, `a high rocket still shares the frame with the horizon (frac ${gHigh.frac.toFixed(2)}, fov ${gHigh.fovDeg.toFixed(0)}°, range ${(gHigh.horiz / 1000).toFixed(1)} km)`);

// The flight bar covers the top of the picture. Zoom 1 used to leave the craft in the last degree of the frame.
const topFrac = g => 0.5 - (g.elevR - g.lookEl) / g.fov;
for (const alt of [914, 1770, 8000]) {
  const g = groundShot({ zoom: 1, stackL: 70, rocketAlt: alt });
  t(g.rocketIn && g.horizonIn && topFrac(g) >= 0.14, `ground ascent at ${alt} m keeps the rocket clear of the top bar (top ${(topFrac(g) * 100).toFixed(0)}%, horizon ${g.frac.toFixed(2)})`);
}
const gCap = groundShot({ zoom: 1, stackL: 48, rocketAlt: 120000 });
t(gCap.rocketIn && gCap.horizonIn && topFrac(gCap) >= 0.12, `ground near 120 km still holds the rocket and the horizon (top ${(topFrac(gCap) * 100).toFixed(0)}%, fov ${gCap.fovDeg.toFixed(0)}°)`);

console.log(`camcycle: ${p} passed, ${f} failed`);
process.exit(f ? 1 : 0);

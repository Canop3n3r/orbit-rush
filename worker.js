// Hangar verdict worker: flies the design on AUTO headlessly (assessDesign) and plans the booster landing
// (planBuild) off the main thread, so editing the rocket never stalls the 3D view. Same DOM-free rules as the game.
import { assessDesign, planBuild } from './flight.js?v=f5.8j';
self.onmessage = e => {
  const { id, design, earthRot } = e.data, t0 = Date.now();
  try {
    const a = assessDesign(design, { earthRot });
    const p = planBuild(design, { earthRot });
    self.postMessage({ id, a, p, ms: Date.now() - t0 });
  } catch (err) { self.postMessage({ id, error: String(err && err.stack || err) }); }
};

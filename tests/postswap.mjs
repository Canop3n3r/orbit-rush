// gx1h2 regression: two makePost views on one renderer must each rebind the shared r172 post quad when they render,
// so leaving the map restores the flight scene + camera for every preset (bloom on = High/Medium, off = Low).
import { readFileSync } from 'node:fs';
let n = 0, bad = 0; const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL', m); } };
const src = readFileSync(new URL('../gfx/gfx.js', import.meta.url), 'utf8');
// Re-create makePost with stubs (the real module imports three/webgpu from the CDN).
const body = src.slice(src.indexOf('let postOwner'), src.indexOf('\n}\n', src.indexOf('export function makePost')) + 2)
  .replace(/export /g, '').replace("await import('three/addons/tsl/display/BloomNode.js')", '({ bloom: () => ({ strength: { value: 0 } }) })');
let quad = null; const THREE = { PostProcessing: class { constructor() { this.needsUpdate = true; } render() { if (this.needsUpdate) { quad = this.outputNode; this.needsUpdate = false; } this.drew = quad; } } };
const pass = (scene, camera) => ({ getTextureNode: () => ({ add: () => ({ scene, camera }) }) });
const mk = new Function('THREE', 'pass', body + '; return { makePost, renderState };')(THREE, pass);
const renderer = { render(s, c) { this.last = { scene: s, camera: c }; } };
const flight = { n: 'flightScene' }, fcam = { n: 'flightCam' }, map = { n: 'mapScene' }, mcam = { n: 'mapCam' };
for (const [preset, bloom] of [['low', false], ['medium', true], ['high', true]]) {
  const fp = mk.makePost(renderer, flight, fcam), mp = mk.makePost(renderer, map, mcam);
  await fp.enable(bloom); await mp.enable(bloom);
  fp.render();
  for (let i = 0; i < 3; i++) {
    mp.render(); const rs = mk.renderState; ok(rs.scene === map && rs.camera === mcam, `${preset} enter ${i}: map view`);
    if (bloom) ok(quad.scene === map, `${preset} enter ${i}: quad bound to map pass`);
    fp.render(); ok(rs.scene === flight && rs.camera === fcam, `${preset} exit ${i}: flight scene+camera`);
    if (bloom) ok(quad.scene === flight && quad.camera === fcam, `${preset} exit ${i}: quad rebound to flight pass`);
    else ok(renderer.last.scene === flight && renderer.last.camera === fcam, `${preset} exit ${i}: direct render of flight`);
  }
}
console.log(`postswap: ${n - bad}/${n} passed`); if (bad) process.exit(1);

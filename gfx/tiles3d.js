// Google Photorealistic 3D Tiles around the real launch sites (private build only; off unless window.ORBIT_TILES or
// ?tiles=<site>). The API key never reaches the client: every request goes to the same-origin /tiles/* proxy run by
// the private build's server, which adds the key server-side. Tiles live in memory only (bounded LRU, no-store).
//
// Placement: the game's pad sits on a spherical full-scale Earth at Earth-fixed [1,0,0]. The real site's local
// East-North-Up frame (WGS84) is mapped onto the game pad's surface frame (y = up, z = east, x = north), with the
// real ground height under the pad (raycast once tiles arrive) put at the game's ground. So the real complex is
// placed around the game pad; positions within ±50 km keep the real geometry (sphere vs ellipsoid curvature
// differs by < 1 m at 50 km).
import * as THREE from 'three/webgpu';
import { uniform, positionWorld, cameraPosition, smoothstep, float, texture, uv, vec4, vec3, dot } from 'three/tsl';
import { TilesRenderer } from '3d-tiles-renderer';
import { GoogleCloudAuthPlugin } from '3d-tiles-renderer/plugins';

export const SITES = {
  // clip: [r0, r1] metres. Inside r0 the real pad (towers, FSS, mount) is discarded so the game's own pad, tower and
  // mount stand alone; r0 -> r1 is a dithered soft edge where a game-coloured apron skirt fades into the real ground.
  lc39a:    { name: 'LC-39A, Kennedy Space Center', lat: 28.60822, lon: -80.60413, clip: [190, 250] },
  slc40:    { name: 'SLC-40, Cape Canaveral SFS',   lat: 28.56194, lon: -80.57735, clip: [170, 230] },
  starbase: { name: 'Starbase, Boca Chica',          lat: 25.99697, lon: -97.15398, clip: [200, 260] },
  slc4e:    { name: 'SLC-4E, Vandenberg SFB',        lat: 34.63209, lon: -120.61067, clip: [170, 230] },
};
export function tilesSite(params, vehicleId) {
  const f = params.get('tiles') ?? (typeof window !== 'undefined' ? window.ORBIT_TILES : null);
  if (!f || f === '0' || f === 'off') return null;
  if (SITES[f]) return f;
  return /titan/.test(vehicleId || '') ? 'starbase' : 'lc39a';
}

const ALT_FULL = 20000, ALT_OFF = 30000, RADIUS = 50000, FADE0 = 35000;
const P2G = new THREE.Matrix4().set(0, 1, 0, 0,  0, 0, 1, 0,  1, 0, 0, 0,  0, 0, 0, 1); // ENU (e,n,u) -> game local (n,u,e)

export function createTiles({ earth, camera, renderer, onSurface, padEF, ground, R, site = 'lc39a', phone = false }) {
  const S0 = SITES[site] || SITES.lc39a, q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  // debug overrides (private build tuning): ?tileslon=..&tileslat=..&tilesclip=r0,r1 (tilesclip=0 shows the real pad)
  const S = { ...S0, lat: +(q.get('tileslat') ?? S0.lat), lon: +(q.get('tileslon') ?? S0.lon),
    clip: q.has('tilesclip') ? (q.get('tilesclip') === '0' ? [0, 0] : q.get('tilesclip').split(',').map(Number)) : S0.clip };
  const anchor = new THREE.Group(); anchor.name = 'tiles3d'; onSurface(anchor, padEF, 0);
  const tiles = new TilesRenderer(location.origin + '/tiles/v1/3dtiles/root.json');
  // The proxy swaps this placeholder for the real key; the plugin still manages the session token + attributions.
  tiles.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: 'via-proxy', autoRefreshToken: true, useRecommendedSettings: true }));
  const mask = new THREE.Sphere(new THREE.Vector3(), RADIUS);
  tiles.registerPlugin({ name: 'ORBIT_RADIUS_MASK', calculateTileViewError(tile, t) { // only tiles within 50 km of the camera
    if (tile.engineData.boundingVolume.intersectsSphere(mask)) return false; t.inView = false; return true; } });
  tiles.errorTarget = phone ? 40 : 20;              // the reduced phone setting: coarser LOD, fewer requests
  tiles.lruCache.minSize = phone ? 150 : 300; tiles.lruCache.maxSize = phone ? 400 : 900;
  tiles.lruCache.maxBytesSize = (phone ? 160 : 400) * 2 ** 20; tiles.lruCache.minBytesSize = (phone ? 100 : 250) * 2 ** 20;
  tiles.downloadQueue.maxJobs = phone ? 4 : 8; tiles.parseQueue.maxJobs = phone ? 1 : 2;
  tiles.fetchOptions = { cache: 'no-store', credentials: 'same-origin' };
  tiles.setCamera(camera);

  // ECEF -> real-site ENU (origin on the ellipsoid; the ground height h0 is applied on the anchor)
  const enu = new THREE.Matrix4(); tiles.ellipsoid.getEastNorthUpFrame(S.lat * Math.PI / 180, S.lon * Math.PI / 180, 0, enu);
  let h0 = 0, h0Known = false;
  const g = tiles.group; g.matrixAutoUpdate = false; anchor.add(g);
  const nud = new THREE.Vector3(); // tuning nudge in game metres (x north, z east)
  const place = () => { g.matrix.makeTranslation(nud.x, 0, nud.z).multiply(P2G).multiply(new THREE.Matrix4().makeTranslation(0, 0, -h0)).multiply(enu.clone().invert()); g.matrixWorldNeedsUpdate = true; };
  place();

  // Fade: by camera altitude (20 -> 30 km) and by distance (35 -> 50 km), dithered so no transparency sorting.
  const uAlt = uniform(1), uLight = uniform(1);
  const uPad = uniform(new THREE.Vector3()), uUp = uniform(new THREE.Vector3(0, 1, 0)), uR0 = uniform(S.clip[0]), uR1 = uniform(S.clip[0] > 0 ? Math.max(S.clip[1], S.clip[0] + 1) : -1);
  const rel = positionWorld.sub(uPad), horiz = rel.sub(uUp.mul(dot(rel, uUp))).length(); // horizontal distance from the game pad
  const clipK = smoothstep(uR0, uR1, horiz);
  // apron skirt: covers the clipped hole (the game ground cap sits 40 m under the real terrain) and fades out over the soft edge
  const skirtM = new THREE.MeshBasicNodeMaterial(); skirtM.alphaHash = true; skirtM.depthWrite = true;
  skirtM.colorNode = vec3(0.50, 0.49, 0.44).mul(uLight); skirtM.opacityNode = uAlt.mul(float(1).sub(smoothstep(uR0, uR1, horiz)));
  const skirt = new THREE.Mesh(new THREE.CircleGeometry(Math.max(S.clip[1], 1), 96), skirtM); skirt.rotation.x = -Math.PI / 2; skirt.position.y = 0.03;
  skirt.visible = S.clip[0] > 0; skirt.renderOrder = -1; anchor.add(skirt);
  tiles.addEventListener('load-model', ({ scene }) => scene.traverse(o => {
    if (!o.isMesh) return; const m0 = o.material, map = m0.map || null, ix = o.geometry.index;
    if (ix && ix.array instanceof Uint8Array) o.geometry.setIndex(new THREE.BufferAttribute(Uint16Array.from(ix.array), 1)); // WebGPU has no 8-bit indices
    const m = new THREE.MeshBasicNodeMaterial(); m.alphaHash = true; m.side = THREE.FrontSide;
    const base = map ? texture(map, uv()) : vec4(m0.color.r, m0.color.g, m0.color.b, 1);
    const d = positionWorld.sub(cameraPosition).length();
    m.colorNode = base.rgb.mul(uLight);
    m.opacityNode = uAlt.mul(float(1).sub(smoothstep(FADE0, RADIUS, d))).mul(clipK);
    o.material = m; m0.dispose(); o.frustumCulled = true;
  }));
  tiles.addEventListener('dispose-model', ({ scene }) => scene.traverse(o => { if (o.isMesh && o.material) { if (o.material.dispose) o.material.dispose(); } }));

  // on-screen attribution (Google logo text + per-tile data providers), as Google's policies require
  const attr = document.createElement('div'); attr.id = 'tilesAttr';
  attr.style.cssText = 'position:fixed;left:6px;bottom:4px;z-index:60;font:11px/1.25 system-ui,sans-serif;color:#fff;text-shadow:0 0 3px #000,0 0 2px #000;pointer-events:none;max-width:70vw;display:none';
  document.body.appendChild(attr);
  let attrT = 0;
  const stats = { site, h0: null, visible: 0, loaded: 0, req: 0, fps: 0, alt: 0, on: false };
  tiles.addEventListener('tile-download-start', () => stats.req++);

  const ray = new THREE.Raycaster(), camL = new THREE.Vector3(), inv = new THREE.Matrix4();
  function measureGround(n = 0, e = 0) { // real ground at (north, east) metres from the pad, relative to the game ground
    g.updateMatrixWorld(true);
    const top = new THREE.Vector3(n, 3000, e).applyMatrix4(anchor.matrixWorld), down = new THREE.Vector3(0, -1, 0).transformDirection(anchor.matrixWorld);
    ray.set(top, down); ray.far = 6000; const hit = ray.intersectObject(g, true)[0];
    if (!hit) return null; return 3000 - hit.distance; // height of the real ground above the current game ground
  }

  let hideList = [], hideT = 0; // the game's generic apron, roads and sheds give way to the real site while tiles show
  function update({ alt, hidden, light = 1 }) {
    if (++hideT % 120 === 1) { hideList = []; earth.traverse(o => { if (o.userData.tilesHide) hideList.push(o); }); }
    const k = hidden ? 0 : Math.max(0, Math.min(1, (ALT_OFF - alt) / (ALT_OFF - ALT_FULL)));
    stats.alt = alt; stats.on = k > 0;
    // generic roads/sheds give way to the real site, but the game's own apron and pad-side buildings inside the clip stay
    for (const o of hideList) o.visible = k < 0.5 || Math.hypot(o.position.x, o.position.z) < S.clip[0];
    anchor.visible = k > 0; uAlt.value = k; uLight.value = light;
    if (ground) ground.position.setLength(R - 40 * k); // drop the game's coloured ground cap under the real terrain
    if (k <= 0) { attr.style.display = 'none'; return; }   // above 30 km: no traversal, no requests
    anchor.updateMatrixWorld(true); camera.updateMatrixWorld();
    uPad.value.setFromMatrixPosition(anchor.matrixWorld); uUp.value.set(0, 1, 0).transformDirection(anchor.matrixWorld);
    inv.copy(g.matrixWorld).invert(); camL.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(inv); mask.center.copy(camL);
    const t0 = performance.now(); tiles.setResolutionFromRenderer(camera, renderer);
    tiles.update(); stats.updMs = +((stats.updMs || 0) * 0.9 + (performance.now() - t0) * 0.1).toFixed(2);
    if (!h0Known && tiles.visibleTiles.size > 20) { // ground level: median of a ring just outside the clip (the pad centre hits the mount/towers)
      const rr = S.clip[0] > 0 ? (S.clip[0] + S.clip[1]) / 2 : 0, hs = [];
      for (let i = 0; i < (rr ? 12 : 1); i++) { const a = i * Math.PI / 6, d = measureGround(rr * Math.cos(a), rr * Math.sin(a)); if (d !== null && Math.abs(d) < 500) hs.push(d); }
      if (hs.length >= (rr ? 6 : 1)) { hs.sort((a, b) => a - b); h0 += hs[hs.length >> 1]; h0Known = true; stats.h0 = h0; place(); } }
    const now = performance.now();
    if (now - attrT > 1000) { attrT = now; const a = tiles.getAttributions(); const txt = a.filter(x => x.type === 'string').map(x => x.value).join('; ');
      attr.style.display = tiles.visibleTiles.size ? 'block' : 'none'; attr.innerHTML = '<b>Google</b> · ' + (txt || 'Map data ©Google').replace(/</g, '&lt;'); }
    stats.visible = tiles.visibleTiles.size; stats.loaded = tiles.lruCache.itemSet.size; stats.mb = +(tiles.lruCache.cachedBytes / 2 ** 20 || 0).toFixed(0);
  }
  return { update, tiles, anchor, stats, measureGround, heightAt: measureGround,
    setClip(r0, r1) { uR0.value = r0 > 0 ? r0 : -2; uR1.value = r0 > 0 ? r1 : -1; skirt.visible = r0 > 0; if (r0 > 0) skirt.scale.setScalar(r1 / Math.max(S.clip[1], 1)); S.clip = [r0, r1]; },
    nudge(n, e) { nud.set(n, 0, e); place(); }, get h0() { return h0; }, site: S };
}

// Brand lookup. Every user-visible vehicle/payload/mission name and the title go through B()/vehicleName()/missionName().
// Pack selection: build-time window.ORBIT_BRAND (set by a private build's index.html) or ?brand=<id> (loads brand/<id>.js).
// The public repo ships only brand/default.js; a missing pack falls back to it silently.
import DEFAULT from './default.js?v=f5.6h';
import { setBrandPack as setNames, displayName } from '../vehicles/brand.js';
let PACK = DEFAULT;
const merge = (a, b) => { const o = { ...a }; for (const k in b || {}) o[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) ? { ...(a[k] || {}), ...b[k] } : b[k]; return o; };
export function brandId() {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('brand') : null;
  return (typeof window !== 'undefined' && window.ORBIT_BRAND) || (q && /^[a-z0-9-]{1,32}$/.test(q) ? q : 'default');
}
export async function loadBrand(id = brandId()) {
  if (id !== 'default') { try { const m = await import(`./${id}.js?v=f4`); PACK = merge(DEFAULT, m.default || m); } catch (e) { PACK = DEFAULT; } }
  setNames({ ...(PACK.vehicles || {}), ...(PACK.engines || {}), ...(PACK.missions || {}) });
  if (PACK.decals && Object.keys(PACK.decals).length) { try { (await import('../gfx/vehicles/decals.js?v=f5.6h')).setBrandPack(PACK.decals); } catch (e) {} }
  return PACK;
}
export const brand = () => PACK;
export const B = (key, fb) => { const v = key.split('.').reduce((o, k) => (o == null ? o : o[k]), PACK); return v == null || typeof v === 'object' ? (fb ?? key) : v; };
export const vehicleName = id => displayName(id);
export const missionName = (id, fb) => (PACK.missions || {})[id] || fb || id;
export const payloadName = (id, fb) => (PACK.payloads || {})[id] || fb || id;
export const label = (key, fb) => (PACK.labels || {})[key] ?? fb;
// DOM pass: title, [data-brand="key"] text, [data-brand-logo="slot"] images
export function applyBrandDom(doc = document) {
  const t = B('title', 'Orbit Rush');
  doc.title = doc.title.replace(/^Orbit Rush/, t);
  if (t !== 'Orbit Rush') doc.querySelectorAll('.hLogo').forEach(el => { el.textContent = t; });
  doc.querySelectorAll('[data-brand]').forEach(el => { const v = B(el.dataset.brand, null); if (v) el.textContent = v; });
  doc.querySelectorAll('[data-brand-logo]').forEach(el => { const u = (PACK.logos || {})[el.dataset.brandLogo]; if (u) { el.src = u; el.hidden = false; } else el.hidden = true; });
  doc.documentElement.dataset.brand = PACK.id || 'default';
}

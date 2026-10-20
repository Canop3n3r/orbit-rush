// Retired catalog ids -> current public ids (rocketdb/public_ids.json). Old ids are stored only as FNV-1a hashes,
// so this file carries no retired names; old saves still resolve through canonicalVehicleId().
export const fnv36 = s => { let h = 0x811c9dc5; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };
export const RETIRED = { d58fyg: 'rodnik', cljb5j: 'rodnik-2', roffut: 'gorynych' };
export const canonicalVehicleId = id => (id == null ? id : RETIRED[fnv36(id)] || id);
// Rewrite any vehicle-id fields in a saved object (design, quicksave, career) in place; returns it.
export function migrateSave(o) {
  if (!o || typeof o !== 'object') return o;
  for (const k of ['vehicle', 'vehicleId', 'rocket']) if (typeof o[k] === 'string') o[k] = canonicalVehicleId(o[k]);
  if (o.design && typeof o.design === 'object') migrateSave(o.design);
  return o;
}

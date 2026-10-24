// Which payload a flight carries (pure: no three import, tested in tests/payload_kinds.mjs).
// The model shows this payload under the fairing from t=0 and releases that same mesh on RELEASE.
export const KINDS = ['comsat', 'eo', 'nav', 'probe', 'cargo', 'flatpack', 'rideshare', 'roadster'];
// mission id -> payload look (missions/<id>.js)
export const BY_MISSION = { 'constellation-batch': 'flatpack', 'gto-comsat': 'comsat', rideshare: 'rideshare', 'sso-rideshare': 'rideshare', 'first-orbit': 'probe',
  'roadster-helio': 'roadster', 'station-rendezvous': 'cargo', refuel: 'cargo' };
const SATS = ['comsat', 'eo', 'nav']; // generic satellite looks, picked per rocket so the fleet does not all carry the same bus
const hash = s => { let h = 7; for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
// { missionId, partIds: design part ids, hasSpec: roster-spec design, model, constellation }
export function payloadKindFor(o = {}) {
  const ids = o.partIds || [];
  if (ids.includes('crew')) return null; // the capsule is the payload; capsule stacks have their own separation flow
  if (o.missionId && BY_MISSION[o.missionId]) return BY_MISSION[o.missionId];
  if (o.constellation) return 'flatpack';
  if (ids.includes('sat') || o.hasSpec) return SATS[hash(o.model) % SATS.length];
  if (ids.includes('probe')) return 'probe';
  return SATS[0];
}
// models whose 'payload' stage group is a fixed nose (re-entry vehicle / warhead), not a jettisoned shell: they carry no visible payload
export const NO_PAYLOAD = /^titanus-2/;
// stage groups that already ARE the payload (capsule, lander, orbiter ...): nothing to add
export const OWN_PAYLOAD = /^(capsule|lander|orbiter|csm|crew|probe|spaceplane|carrier)/i;

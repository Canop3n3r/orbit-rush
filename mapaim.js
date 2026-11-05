// Where the map camera looks the moment the map opens.
// The vessel you are flying is the focus. The last planet, a pan, and a glide from that planet are dropped.
// A tap that opens the map can land on a label in the same spot; that tap must not move the camera.
// A real press on the map, after it is open, still can. Tracking after the open belongs elsewhere.
import * as P from './physics.js?v=f5.9-27';

const hypot = r => Math.hypot(r[0], r[1], r[2]);

export function mapOpenAim(flight, fitDist) {
  const v = flight && flight.v;
  const activeId = flight && flight.fleet ? flight.fleet.activeId : null;
  const base = { focus: 'craft', activeId, pan: [0, 0, 0], trans: null };
  if (!v || !v.r) return { ...base, dist: 3e7, body: 'earth' };
  const body = flight.body || v.body || 'earth';
  const B = P.BODIES[body];
  const Rb = B ? B.R : 6.371e6;
  const r = hypot(v.r);
  let far = 0;
  try {
    const o = P.orbitOf(v);
    if (Number.isFinite(o.ra) && B && o.ra < B.soi) far = Math.max(o.ra, r);
  } catch (e) { far = 0; }
  const nice = Math.max(Rb * 3.2, Math.min(r * 2.6, 3e9));
  const framed = far ? Math.max(Rb * 3.2, typeof fitDist === 'function' ? fitDist(far) : nice) : nice;
  return { ...base, body, dist: Math.max(2000, framed) };
}

// A click on something other than the active craft is ignored for lockMs after open
// unless the press started on the map itself (not on the button that opened it).
export function mapFocusAllowed(id, openedAt, now, pointerOnMap, lockMs = 500) {
  if (id === 'craft' || id == null) return true;
  if (!openedAt || !(now - openedAt < lockMs)) return true;
  return !!pointerOnMap;
}

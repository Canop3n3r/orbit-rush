// A bad v3 universe save must not hide a legacy world or quicksave, and must not delete either key.
// Run: node tests/tracking_legacy.mjs
import { readFileSync } from 'node:fs';
import { SAVE_KEY, LEGACY_KEYS } from '../core/universe.js';
import { loadTrackingUniverse } from '../scenes/tracking.js?v=f5.9-47';

let pass = 0, fail = 0;
const ok = (c, m, x = '') => { if (c) { pass++; console.log('  ✔', m, x); } else { fail++; console.log('  ✘', m, x); } };
const mem = (init = {}) => {
  const m = new Map(Object.entries(init));
  const log = [];
  return {
    log,
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { log.push(['set', k]); m.set(String(k), String(v)); },
    removeItem: k => { log.push(['del', k]); m.delete(k); },
  };
};

const quick = JSON.stringify({
  v: 1, design: { name: 'Hopper' }, body: 'earth', tAbs: 12,
  veh: { r: [6378137, 0, 0], v: [0, 0, 0], clamped: true, sas: 'stab', throttle: 0 },
  f: { ignited: false, parked: false, nodes: [] },
});
const world = JSON.stringify({
  v: 1, seq: 1,
  objs: [{ id: 'o9', kind: 'sat', name: 'Lone', body: 'mars', r: [4e6, 0, 0], v: [0, 3000, 0], t: 250 }],
});

console.log('1. A bad v3 save falls through to the legacy import');
{
  const warns = [];
  const store = mem({
    [SAVE_KEY]: '{not json',
    [LEGACY_KEYS.quicksave]: quick,
    [LEGACY_KEYS.world]: world,
  });
  const u = loadTrackingUniverse(store, (...a) => warns.push(a.join(' ')));
  ok(u.active && u.active.name === 'Hopper' && u.get('o9') && u.get('o9').body === 'mars', 'the quicksave craft and the world satellite both come back', u.active && u.active.name);
  ok(store.getItem(SAVE_KEY) === '{not json' && store.getItem(LEGACY_KEYS.quicksave) === quick && store.getItem(LEGACY_KEYS.world) === world, 'none of the keys are deleted or rewritten');
  ok(!store.log.some(x => x[0] === 'del'), 'removeItem is never called', store.log.map(x => x.join(':')).join(','));
  ok(warns.length >= 1 && /legacy|universe/i.test(warns[0]), 'a bad save is reported', warns[0]);
}

console.log('2. An unknown version tries legacy before an empty station');
{
  const warns = [];
  const store = mem({ [SAVE_KEY]: JSON.stringify({ v: 9, ut: 1 }), [LEGACY_KEYS.world]: world });
  const u = loadTrackingUniverse(store, (...a) => warns.push(a.join(' ')));
  ok(u.get('o9') && u.get('o9').name === 'Lone' && !u.active, 'the world list is the station when v3 cannot be migrated');
  ok(store.getItem(SAVE_KEY) === JSON.stringify({ v: 9, ut: 1 }), 'the unreadable v3 key is left in place');
  ok(warns.length >= 1, 'the failure is warned');
}

console.log('3. Legacy that cannot be read becomes an empty universe, keys intact');
{
  const warns = [];
  const store = mem({ [SAVE_KEY]: '{not json', [LEGACY_KEYS.quicksave]: '{not json', [LEGACY_KEYS.world]: 'not-json' });
  const u = loadTrackingUniverse(store, (...a) => warns.push(a.join(' ')));
  ok(u.vessels.size === 0 && u.activeId == null, 'a bad legacy import is an empty station');
  ok(store.getItem(SAVE_KEY) === '{not json' && store.getItem(LEGACY_KEYS.quicksave) === '{not json' && store.getItem(LEGACY_KEYS.world) === 'not-json', 'corrupt keys are still there');
  ok(warns.length >= 1, 'the bad v3 save is still warned');
}

console.log('4. A good v3 save is used as-is');
{
  const warns = [];
  const good = JSON.stringify({ v: 3, ut: 40, warp: 1, warpMode: 'physics', activeId: 'v1', seq: 1, vessels: [{ id: 'v1', name: 'Kept', body: 'earth', situation: 'orbiting', orbit: { epoch: 40, r: [7e6, 0, 0], v: [0, 7500, 0] }, parts: [{ uid: 1, spec: 'probe-core', parent: null, state: {} }] }] });
  const store = mem({ [SAVE_KEY]: good, [LEGACY_KEYS.quicksave]: quick });
  const u = loadTrackingUniverse(store, (...a) => warns.push(a.join(' ')));
  ok(u.get('v1') && u.get('v1').name === 'Kept' && !u.get('v1').name.includes('Hopper') && u.clock.ut === 40, 'a readable universe is not replaced by the quicksave');
  ok(warns.length === 0 && store.getItem(LEGACY_KEYS.quicksave) === quick, 'a good load does not warn and does not touch legacy');
}

console.log('5. The station enter path uses that loader');
{
  const src = readFileSync(new URL('../scenes/tracking.js', import.meta.url), 'utf8');
  ok(/loadTrackingUniverse\(store/.test(src), 'enter loads through loadTrackingUniverse');
  ok(!/removeItem|delete store|localStorage\.remove/.test(src), 'tracking never deletes storage keys');
}

console.log(`tracking_legacy: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

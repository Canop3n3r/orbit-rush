// Keyboard time warp: < and > step, / cancels to ×1. After ?warp= / __cine.warp the same keys stay quiet.
import { readFileSync } from 'node:fs';
import { Flight, WARPS } from '../flight.js';
import { TEMPLATES, cloneDesign } from '../parts.js';
import { warpKeyAction, stepWarp } from '../fun/warpkeys.js';

let pass = 0, fail = 0;
const ok = (c, m, x = '') => { if (c) { pass++; console.log('  ✔', m, x); } else { fail++; console.log('FAIL', m, x); } };

ok(warpKeyAction({ code: 'Period' }) === 'up' && warpKeyAction({ key: '>' }) === 'up' && warpKeyAction({ key: '.' }) === 'up', '> / . step warp up');
ok(warpKeyAction({ code: 'Comma' }) === 'down' && warpKeyAction({ key: '<' }) === 'down' && warpKeyAction({ key: ',' }) === 'down', '< / , step warp down');
ok(warpKeyAction({ code: 'Slash' }) === 'reset' && warpKeyAction({ key: '/' }) === 'reset', '/ cancels time warp');
ok(warpKeyAction({ key: '?' }) === null && warpKeyAction({ code: 'KeyT' }) === null && warpKeyAction({ code: 'KeyG' }) === null, 'question mark, T, and G are not these chords');
ok(warpKeyAction({ code: 'Slash', key: '?' }) === 'reset', 'the slash key still cancels when shifted to ?');

function coast() {
  const log = [];
  const F = new Flight(cloneDesign(TEMPLATES[0]), { toast: m => log.push(m) });
  F.placeInOrbit(300000); F.ignited = true; F.v.ut = 0; F.v.throttle = 0;
  return { F, log };
}

{
  const { F, log } = coast();
  ok(F.warpLimit()[0] >= 100, 'orbit can warp past ×1', 'limit ×' + F.warpLimit()[0]);
  F.setWarp(2, true); log.length = 0;
  ok(stepWarp(F, 'up', WARPS) === true && F.warpI === 3 && WARPS[F.warpI] === 10, 'up moves one warp step', '×' + WARPS[F.warpI]);
  ok(log.some(m => m === 'Time warp ×10'), 'a normal step still toasts');
  log.length = 0;
  ok(stepWarp(F, 'down', WARPS, { quiet: true }) === true && F.warpI === 2 && WARPS[F.warpI] === 4 && !log.length, 'quiet < steps down with no toast');
  log.length = 0;
  ok(stepWarp(F, 'reset', WARPS, { quiet: true }) === true && F.warpI === 0 && WARPS[0] === 1 && !log.length && !F.autoWarp, '/ cancels to ×1 quietly');
  log.length = 0;
  F.setWarp(4, true); log.length = 0;
  ok(stepWarp(F, 'reset', WARPS) === true && F.warpI === 0 && log.some(m => m === 'Time warp ×1'), 'a loud cancel still toasts ×1');
}

{
  const { F, log } = coast();
  F.setWarp(0, true); log.length = 0;
  ok(stepWarp(F, 'up', WARPS, { limit: 1, why: 'on the pad' }) === false && F.warpI === 0, 'up at the cap does not raise warp');
  ok(log.some(m => m === 'Max warp ×1: on the pad'), 'the cap toast names the limit');
  log.length = 0;
  ok(stepWarp(F, 'up', WARPS, { limit: 1, why: 'on the pad', quiet: true }) === false && F.warpI === 0 && !log.length, 'a trailer warp cap stays quiet');
  ok(stepWarp(F, 'down', WARPS, { limit: 1 }) === false && F.warpI === 0, 'down at ×1 does nothing');
}

const src = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const tw = src.slice(src.indexOf('function trailerWarp'), src.indexOf('function trailerWarp') + 420);
ok(/setWarp\(p\.index, true\)/.test(tw) && /F\.warpTarget = null/.test(tw), '?warp= / __cine.warp still sets a quiet warp and clears warp-to');
ok(/warpKeysQuiet = true/.test(tw), 'a trailer warp latches quiet keyboard steps');
ok(/quiet: !!warpKeysQuiet/.test(src), 'warp step and cancel read that latch');
ok(/code === 'Slash'\) \{ warpReset\(\);/.test(src) && /code === 'Comma'\) \{ warpStep\(-1\);/.test(src) && /code === 'Period'\) \{ warpStep\(1\);/.test(src), '< > / still call the shared warp step');
ok(/function launch\(\) \{ warpKeysQuiet = false;/.test(src), 'a later flight toasts warp keys again unless ?warp= sets them');

console.log(fail ? `warpkeys: ${fail} FAIL, ${pass} passed` : `warpkeys: ${pass} passed`);
process.exit(fail ? 1 : 0);

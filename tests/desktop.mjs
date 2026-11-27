// Desktop boot: med defaults, quality ladder on every screen, boot card, renderer fallback.
// Run: node tests/desktop.mjs
import { readFileSync } from 'node:fs';
import { GFX } from '../gfx/presets.js?v=f5.9-27';
import { QUALITY } from '../fxmap.js?v=f5.9-32';
import { chooseGfx, chooseFx, lodPhone, qualityLadderStep, withTimeout, initRenderer, waitToShowHome } from '../boot.js?v=f5.9-47';

let pass = 0, fail = 0;
const ok = (c, m, x = '') => { if (c) { pass++; console.log('  ✔', m, x); } else { fail++; console.log('  ✘', m, x); } };

console.log('1. Graphics default is med on desktop, low on a software GPU');
ok(chooseGfx(null, null, false) === 'med', 'desktop with no saved choice starts at med');
ok(chooseGfx(null, null, true) === 'low', 'a software GPU stays low');
ok(chooseGfx(null, 'high', false) === 'high', '?gfx=high wins');
ok(chooseGfx('low', null, false) === 'low', 'a saved choice wins over the desktop default');
ok(chooseGfx('high', 'med', true) === 'med', '?gfx= beats a saved choice, including on a software GPU');
ok(chooseGfx('nope', 'nope', false) === 'med', 'an unknown param and an unknown save fall through to med');
ok(GFX.med && !GFX.med.bloom && GFX.med.tex === '_1k', 'med is 1K textures and no bloom');

console.log('2. Effects default is med, and a saved or ?fx= choice still wins');
ok(chooseFx(null, null) === 'med', 'no saved effects choice starts at med');
ok(chooseFx('high', null) === 'high', 'a saved effects choice is kept');
ok(chooseFx('low', 'high') === 'high', '?fx= beats the saved choice');
ok(chooseFx('med', 'nope') === 'med', 'an unknown ?fx= does not throw away a saved choice');
ok(QUALITY.med && QUALITY.med.flowGPU < QUALITY.high.flowGPU, 'med spends fewer GPU particles than high');

console.log('3. Desktop near LOD is mid unless the user picked high');
ok(lodPhone('med', false) === true, 'desktop med uses the mid LOD');
ok(lodPhone('low', false) === true, 'desktop low uses the mid LOD');
ok(lodPhone('high', false) === false, 'desktop high keeps the hi LOD');
ok(lodPhone('high', true) === true, 'a touch device stays on the mid LOD');
ok(lodPhone('med', true) === true, 'touch med stays on the mid LOD');

console.log('4. The quality ladder runs in any state: bloom and effects, then pixels');
{
  const home = { slowT: 2.1, fxQ: 'high', fxLocked: false, bloomOn: true, gfxPinned: false, pixR: 1.5 };
  const a = qualityLadderStep(home);
  ok(a && a.kind === 'fx' && a.q === 'med', 'a slow Home drops effects before pixels', JSON.stringify(a));
  const b = qualityLadderStep({ ...home, fxQ: 'med' });
  ok(b && b.kind === 'fx' && b.q === 'low', 'the next slow stretch drops effects again');
  const c = qualityLadderStep({ ...home, fxQ: 'low' });
  ok(c && c.kind === 'bloom', 'with effects already low, bloom drops next', JSON.stringify(c));
  const d = qualityLadderStep({ ...home, fxQ: 'low', bloomOn: false });
  ok(d && d.kind === 'pixel' && d.pixR === 1.25, 'pixels drop only after bloom and effects', JSON.stringify(d));
  const e = qualityLadderStep({ ...home, fxQ: 'low', bloomOn: false, pixR: 0.7 });
  ok(e && e.kind === 'pixel' && e.pixR === 0.6, 'pixel ratio does not go under 0.6');
  ok(qualityLadderStep({ ...home, fxQ: 'low', bloomOn: false, pixR: 0.6 }) === null, 'the ladder stops at the floor');
  ok(qualityLadderStep({ ...home, slowT: 2 }) === null, 'slowT of 2 is not yet over the line');
  const pinnedFx = qualityLadderStep({ ...home, fxLocked: true });
  ok(pinnedFx && pinnedFx.kind === 'pixel', '?fx= keeps the effects level and still lowers pixels', JSON.stringify(pinnedFx));
  const pinnedGfx = qualityLadderStep({ ...home, fxQ: 'low', gfxPinned: true });
  ok(pinnedGfx && pinnedGfx.kind === 'pixel', '?gfx= keeps bloom and still lowers pixels', JSON.stringify(pinnedGfx));
}

console.log('5. Renderer init times out into a WebGL renderer');
{
  let calls = [];
  const hang = { init() { return new Promise(() => {}); }, dispose() { calls.push('dispose'); } };
  const gl = { init() { calls.push('gl'); return Promise.resolve(); } };
  const create = ({ forceWebGL }) => { calls.push(forceWebGL ? 'webgl' : 'primary'); return forceWebGL ? gl : hang; };
  const t0 = Date.now();
  const got = await initRenderer(create, { timeoutMs: 30 });
  ok(got === gl && calls[0] === 'primary' && calls.includes('dispose') && calls.includes('webgl') && calls.includes('gl'), 'a hung init is disposed and replaced with forceWebGL', calls.join(','));
  ok(Date.now() - t0 < 500, 'the timeout fires instead of waiting out the hang', (Date.now() - t0) + 'ms');
  let boom = 0;
  const bad = { init() { boom++; return Promise.reject(new Error('adapter lost')); }, dispose() { boom++; } };
  const good = { init() { boom++; return Promise.resolve('ok'); } };
  const got2 = await initRenderer(({ forceWebGL }) => forceWebGL ? good : bad, { timeoutMs: 200 });
  ok(got2 === good && boom === 3, 'a thrown init is caught and the WebGL renderer is inited');
  let n = 0;
  const fine = { init() { n++; return Promise.resolve(); } };
  const got3 = await initRenderer(() => fine, { timeoutMs: 200 });
  ok(got3 === fine && n === 1, 'a healthy init is kept and not replaced');
  let timed = false;
  await withTimeout(() => new Promise(() => {}), 20, 'renderer init timeout').catch(e => { timed = e.message === 'renderer init timeout'; });
  ok(timed, 'withTimeout rejects with the renderer init label');
}

console.log('6. The boot card stays until a frame, compile, or the cap');
{
  const frame = waitToShowHome({ compile: new Promise(() => {}), frame: Promise.resolve(), capMs: 500 });
  ok(await frame === 'frame', 'a presented frame dismisses the card');
  const compiled = waitToShowHome({ compile: Promise.resolve(), frame: new Promise(() => {}), capMs: 500 });
  ok(await compiled === 'compile', 'compileAsync settling dismisses the card');
  const t0 = Date.now();
  const capped = await waitToShowHome({ compile: new Promise(() => {}), frame: new Promise(() => {}), capMs: 40 });
  ok(capped === 'cap' && Date.now() - t0 >= 30 && Date.now() - t0 < 400, 'neither signal still ends at the cap', (Date.now() - t0) + 'ms');
  const rejected = await waitToShowHome({ compile: Promise.reject(new Error('shader')), frame: new Promise(() => {}), capMs: 500 });
  ok(rejected === 'compile', 'a failed compile still lets the card go');
}

console.log('7. The page wires the decisions and the f5.9-47 cache tag');
{
  const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
  const gfx = readFileSync(new URL('../gfx/gfx.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  ok(/chooseGfx\(stored, param, softwareGPU\(\)\)/.test(gfx), 'pickGfx asks chooseGfx and still detects a software GPU');
  ok(/chooseFx\(/.test(main), 'effects quality goes through chooseFx');
  ok(/lodPhone\(/.test(main), 'near LODs follow lodPhone');
  ok(/qualityLadderStep\(/.test(main), 'the frame loop uses the quality ladder');
  ok(!/slowT > 2 && state === 'flight'/.test(main), 'the ladder is not gated on flight');
  ok(/Frame rate low — bloom off/.test(main) && /Frame rate low — effects set to/.test(main), 'the frame-rate toasts stay');
  ok(/waitToShowHome\(/.test(main) && /Compiling shaders/.test(main), 'the boot card waits and says it is compiling shaders');
  const boot = readFileSync(new URL('../boot.js', import.meta.url), 'utf8');
  ok(/initRenderer\(/.test(main) && /forceWebGL:\s*true/.test(boot), 'renderer init falls back to a WebGL renderer');
  ok(/main\.js\?v=f5\.9-47/.test(html) && /Compiling shaders/.test(html), 'index.html cache tag is f5.9-47 and the boot card notes shaders');
}

console.log(`desktop: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

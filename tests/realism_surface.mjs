// realism-1: procedural surface detail helpers (normal-from-height, per-stage soot weights)
import assert from 'node:assert/strict';
import { heightToNormal, sootOf, SOOT_LOOK } from '../gfx/vehicles/surface_math.js';
const W = 8, H = 8, flat = new Uint8ClampedArray(W * H * 4).fill(128), n = heightToNormal(flat, W, H);
for (let i = 0; i < W * H; i++) { assert.ok(Math.abs(n[i * 4] - 127.5) <= 1 && Math.abs(n[i * 4 + 1] - 127.5) <= 1 && n[i * 4 + 2] >= 254, 'flat height -> straight-up normal'); }
const ramp = new Uint8ClampedArray(W * H * 4); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ramp[(y * W + x) * 4] = 100 + (x === 4 ? 60 : 0); // a raised seam at x=4
const r = heightToNormal(ramp, W, H); assert.ok(r[(0 * W + 3) * 4] < 120 && r[(0 * W + 5) * 4] > 135, 'normals tilt away from a raised seam on both sides');
const st = [{ key: 'booster', role: 'tank' }, { key: 'upper', role: 'tank' }, { key: 'payload', role: 'fairing' }, { key: 'side0', role: 'strap' }, { key: 'srb0', role: 'solid' }];
assert.equal(sootOf(st[2], st, 'heron-9'), 0, 'no soot on fairings');
assert.ok(sootOf(st[0], st, 'heron-9') > sootOf(st[1], st, 'heron-9'), 'first stage sootier than the upper stage');
assert.ok(sootOf(st[3], st, 'x') === 1 && sootOf(st[4], st, 'x') === 1, 'boosters and solids get full soot');
assert.ok(sootOf(st[0], st, 'heron-9') > sootOf(st[0], st, 'new-glendale'), 'reused kerolox booster dirtier than the methane/hydrogen stack');
for (const v of Object.values(SOOT_LOOK)) assert.ok(v > 0 && v <= 1.5);
console.log('realism_surface ok');

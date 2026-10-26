"""Winged stages (orbiters, spaceplanes, carrier aircraft, winged boosters): a lathe fuselage + extruded wing / tail planforms, parameter-driven
from overrides/<id>.json -> stages.<key>.winged (the extracted silhouette of these stages is not a body of revolution, so there is no automatic spec).
Canonical frame: nose = +Y, wings along +-X, dorsal (tail fin) = +Z, belly = -Z. `rot` turns that frame about Y into the stage frame."""
import math
from mathutils import Matrix
from .geo import *
from . import parts as K

def prep(st, W):
    """give the stage spec a body-of-revolution silhouette (the fuselage) so the generic pipeline can place and describe it"""
    y0 = st['y0']; fuse = [(y0 + y, r) for y, r in W['fuse']]
    nose = fuse[-1][0] - fuse[0][0]
    bands = [(fuse[0][0], fuse[-1][0], 'paint:0,0')]
    return dict(st, prof=fuse, bands=bands, w=[0, 0], empty=False)

def _poly_wing(W):
    s = W['span'] / 2; r0, r1, t0, t1 = W['root_te'], W['root_le'], W['tip_te'], W['tip_le']; xr = W.get('root_x', 0.6)
    return [(-s, t0), (-xr, r0), (xr, r0), (s, t0), (s, t1), (xr, r1), (-xr, r1), (-s, t1)]

def build(part, ctx, L, W, tint):
    """L = normalized spec (prof = fuselage). Adds fuselage, wings, tail, engines to `part`."""
    B = xf((0, 0, 0), (0, W.get('rot', 0.0), 0)); sz = W.get('sz', 1.0)
    white = srgb(W.get('hull', 0xEDEDE9)); tile = srgb(W.get('belly', 0x1B1C20)); dark = srgb(0x2A2B2F); acc = srgb(W.get('accent', 0x2B3A66))
    sil = L['prof']; y_lo, y_hi = sil[0][0], sil[-1][0]
    Mf = B @ xf((0, 0, 0), (0, 0, 0), (1, 1, sz))
    def col(yy, a, i, j):   # belly (z<0 side: sin a < 0) is dark tile, the nose cap too; white above; accent stripe near the tail
        s = math.sin(a)
        if yy > y_hi - 0.06 * (y_hi - y_lo): return dark
        if s < -0.25 and W.get('belly_tile', True): return tile
        if yy < y_lo + 0.1 * (y_hi - y_lo) and W.get('stripe', True): return acc
        return white
    lathe(part.buf('hull'), [(r, y) for y, r in sil], ctx.seg, col, Mf, cap_bottom=dark)
    wg = W.get('wing')
    if wg:
        th = wg.get('thick', 0.3); zc = wg.get('z', 0.0) * sz
        bw = part.buf('hull', 0.0)
        prism(bw, [(u, y_lo + v) for u, v in _poly_wing(wg)], th, white, B @ xf((0, 0, zc)))
        if ctx.detail >= 1 and W.get('belly_tile', True):  # dark underside + leading-edge strip
            prism(part.buf('tile'), [(u, y_lo + v - 0.0) for u, v in _poly_wing(wg)], th * 0.35, tile, B @ xf((0, 0, zc - th * 0.55)))
        if wg.get('winglets'):
            s = wg['span'] / 2; h = wg['winglets']; c = wg['tip_te'] - wg['tip_le']
            for sg in (-1, 1):
                prism(bw, [(0.0, y_lo + wg['tip_te']), (h, y_lo + wg['tip_te'] + 0.4), (h, y_lo + wg['tip_le'] + 0.3), (0.0, y_lo + wg['tip_le'])], 0.18,
                      white, B @ xf((sg * s, 0, zc), (0, -math.pi / 2, 0)))
    tl = W.get('tail')
    if tl:
        zb = tl.get('z0', 0.7 * (max(r for _, r in sil)) * sz); zt = zb + tl['h']; t0, t1 = tl['te'], tl['le']; sw = tl.get('sweep', 2.0)
        poly = [(zb, y_lo + t0), (zt, y_lo + t0 + sw * 0.6), (zt, y_lo + t0 + sw * 0.6 + tl.get('tip', 1.2)), (zb, y_lo + t1)]
        prism(part.buf('hull'), poly, tl.get('thick', 0.25), white, B @ xf((0, 0, 0), (0, -math.pi / 2, 0)))
        if tl.get('twin'):    # second boom fin
            prism(part.buf('hull'), poly, tl.get('thick', 0.25), white, B @ xf((tl['twin'], 0, 0), (0, -math.pi / 2, 0)))
            prism(part.buf('hull'), poly, tl.get('thick', 0.25), white, B @ xf((-tl['twin'], 0, 0), (0, -math.pi / 2, 0)))
    for bm in W.get('booms', []):   # extra cylinders (carrier twin booms, tail booms): [x, z, y_from, y_to, r]
        x, z, ya, yb, r = bm
        cyl(part.buf('hull'), r, r, yb - ya, max(8, ctx.seg // 2), white, B @ xf((x, ya, z)))
        cyl(part.buf('dark'), r * 0.98, r * 0.4, r * 1.2, max(8, ctx.seg // 2), dark, B @ xf((x, yb, z)))
    if ctx.detail >= 1 and W.get('canopy'):
        c = W['canopy']; lathe(part.buf('glass'), [(0.01, c[0]), (c[2] * 0.7, c[0] + 0.25 * (c[1] - c[0])), (c[2] * 0.5, c[1]), (0.01, c[1] + 0.3)], max(8, ctx.seg // 2), lambda *a: srgb(0x182638),
                               B @ xf((0, 0, max(r for _, r in sil) * sz * 0.8), (0, 0, 0), (1, 1, 0.55)))
    if L['noz']: K.cluster_nozzles(part, ctx, L['noz'], tint)

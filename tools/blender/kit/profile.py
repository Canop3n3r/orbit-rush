"""Pure (no bpy) silhouette helpers shared by the hull builder and tests/py/hull_profile.py."""

def interp(prof, y):
    """radius of the silhouette at height y (prof = [(y, r)...] ascending)."""
    if y <= prof[0][0]: return prof[0][1]
    for (y0, r0), (y1, r1) in zip(prof, prof[1:]):
        if y <= y1:
            u = (y - y0) / ((y1 - y0) or 1); return r0 + (r1 - r0) * u
    return prof[-1][1]

def hull_ys(sil, bands, extra=()):
    """ring heights of the hull lathe: every silhouette point is kept (a step like an upper stage's 4 cm thrust-ring shoulder
    must never be merged away, or the lathe runs straight from the narrow skirt to the next ring and the stage turns into a cone);
    livery band edges are added only when they are more than 4 cm from a kept ring."""
    lo, hi = sil[0][0] - 1e-6, sil[-1][0] + 1e-6
    dedup = sorted(set(p[0] for p in sil))
    for c in sorted(set(x for b in bands for x in b[:2])):
        if lo <= c <= hi and all(abs(c - d) > 0.04 for d in dedup): dedup.append(c)
    return sorted(set(round(y, 4) for y in list(dedup) + list(extra)))

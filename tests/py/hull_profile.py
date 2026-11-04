"""Every Blender hull keeps its silhouette: the lathe rings must reproduce the spec profile (no step dropped -> no cone-shaped stage)."""
import json, glob, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'tools', 'blender', 'kit'))
from profile import hull_ys, interp
bad = []
for f in sorted(glob.glob(os.path.join(os.path.dirname(__file__), '..', '..', 'tools', 'blender', 'specs', '*.json'))):
    sp = json.load(open(f))
    for st in sp['stages']:
        prof = st.get('prof') or []
        if len(prof) < 2: continue
        y0 = prof[0][0]; sil = [(y - y0, r) for y, r in prof]; bands = [(a - y0, b - y0, m) for a, b, m in st.get('bands', [])] or [(0, sil[-1][0], 'dark')]
        ys = hull_ys(sil, bands); rings = [(y, interp(sil, y)) for y in ys]; R = max(r for _, r in sil)
        # sample the silhouette densely and compare with the lathe (linear between rings)
        H = sil[-1][0]; worst = 0.0; at = 0
        for k in range(401):
            y = H * k / 400; d = abs(interp(rings, y) - interp(sil, y))
            if d > worst: worst, at = d, y
        if worst > 0.06 * R: bad.append(f"{sp['id']}/{st['key']}: lathe off the silhouette by {worst:.2f} m at y={at + y0:.2f} (R {R:.2f})")
print('\n'.join(bad) or 'hull_profile: every stage keeps its silhouette')
sys.exit(1 if bad else 0)

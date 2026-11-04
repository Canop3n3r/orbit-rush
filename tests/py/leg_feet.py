"""Deployed landing-leg feet sit 1-2 m below the lowest engine exit on every legged stage (was ~3.5 m with a fixed 120 deg swing)."""
import json, glob, os, sys, math
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'tools', 'blender', 'kit'))
from profile import leg_deploy
bad = []; n = 0
for f in sorted(glob.glob(os.path.join(os.path.dirname(__file__), '..', '..', 'tools', 'blender', 'specs', '*.json'))):
    sp = json.load(open(f)); ov = {}
    op = f.replace('/specs/', '/overrides/'); ov = json.load(open(op)) if os.path.exists(op) else {}
    for st in sp['stages']:
        lg = ((ov.get('stages') or {}).get(st['key']) or {}).get('legs', st.get('legs'))
        if not lg or not st.get('noz') or not lg.get('pivots', (st.get('legs') or {}).get('pivots')): continue
        piv = lg.get('pivots') or st['legs']['pivots']; L = lg.get('len') or (st.get('legs') or {}).get('len') or 9.0
        ex = min(z[1] for z in st['noz'])
        for p in piv:
            th = leg_deploy(p[1], L, ex); foot = p[1] + L * math.cos(th); drop = ex - foot; n += 1
            if not (0.9 <= drop <= 2.1): bad.append(f"{sp['id']}/{st['key']}: foot {drop:.2f} m below the bells (swing {math.degrees(th):.0f} deg)")
print('\n'.join(bad) or f'leg_feet: {n} legs land 1-2 m below the bells')
sys.exit(1 if bad or not n else 0)

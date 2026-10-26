"""Blender entry point (run with the bpy python or `blender -b -P`).  python bake.py -- <out_dir> <spec.json>...  [--tiers hi,mid,lo]
Deterministic: seeds come from vehicle id + stage key; nothing reads the clock."""
import sys, os, json, math, time, hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from kit.geo import *
from kit import parts as K
from kit.stage import build_stage, nonaxisymmetric, role_of

def main(argv):
    out = argv[0]; files = [a for a in argv[1:] if not a.startswith('--')]
    tiers = ['hi', 'mid', 'lo']
    for a in argv:
        if a.startswith('--tiers='): tiers = a.split('=')[1].split(',')
    here = os.path.dirname(os.path.abspath(__file__)); memo = {}
    summary = {}
    def one(f):
        spec = json.load(open(f)); vid = spec['id']
        ovp = os.path.join(here, 'overrides', vid + '.json'); ov = json.load(open(ovp)) if os.path.exists(ovp) else {}
        vdir = os.path.join(out, vid); os.makedirs(vdir, exist_ok=True)
        man = dict(schema=1, id=vid, height_m=spec['height'], units='m', frame='game: +Y up, origin = bottom of the lowest engine exit', tiers=tiers, stages=[], skipped=[])
        t0 = 0
        for st in spec['stages']:
            key = st['key']; sov = (ov.get('stages') or {}).get(key, {})
            if sov.get('winged'): from kit import winged as WG; st = WG.prep(st, sov['winged']); sov = dict(sov, force=True)
            if st.get('empty') or not st.get('prof') or len(st['prof']) < 2: man['skipped'].append(dict(key=key, why='empty')); continue
            if nonaxisymmetric(st) and not sov.get('force'): man['skipped'].append(dict(key=key, why='non-axisymmetric (procedural fallback)')); continue
            # direction from a strap-on toward the vehicle axis, in the stage frame (for attach struts)
            ox, oy, oz = st['offset']; ry = st.get('rotY', 0.0)
            tw = None
            if abs(ox) + abs(oz) > 0.5:
                tx, tz = -ox, -oz; c, s = math.cos(-ry), math.sin(-ry); tw = (tx * c + tz * s, 0, -tx * s + tz * c); st = dict(st, _toward=tw)
            sig = hashlib.md5(json.dumps([st['prof'], st['bands'], st['noz'], st.get('legs'), st.get('fins'), st.get('info'), key, sov, st.get('_toward')], sort_keys=True).encode()).hexdigest()[:10]
            assets = {}; tris = {}; meta = None
            for tier in tiers:
                fn = f'{key}.{tier}.glb'; path = os.path.join(vdir, fn)
                mk = (sig, tier)
                if mk in memo and os.path.exists(memo[mk][0]) and False:
                    pass
                scale = 1.0; lo, hi = K.TIERS[tier]['budget']
                for attempt in range(10):
                    reset_scene(); part, meta = build_stage(vid, st, tier, sov, scale)
                    root = build_objects(part); n = count_tris(root)
                    if n <= hi or scale < 0.25: break
                    scale *= 0.75
                if os.environ.get('KIT_DEBUG'): print('TRIS', vid, key, tier, n, count_tris(root, True)[1], 'scale', round(scale, 2))
                export_glb(root, path)
                assets[tier] = f'assets/rockets/{vid}/{fn}'; tris[tier] = n
            ref = meta['ref']; c, s = math.cos(ry), math.sin(ry)
            world = lambda p: [round(ox + (p[0] * c + p[2] * s), 3), round(oy + p[1], 3), round(oz + (-p[0] * s + p[2] * c), 3)]
            # asset origin in the vehicle frame = group offset + R(rotY) * ref
            org = [round(ox + ref[0] * c + ref[2] * s, 3), round(oy + ref[1], 3), round(oz - ref[0] * s + ref[2] * c, 3)]
            H = meta['H']
            sm = dict(key=key, role=meta['role'], prop=meta['prop'], asset=assets, tris=tris, offset=org, rotY=round(ry, 4), size_m=dict(h=round(H, 2), r=round(meta['R'], 2)),
                      attach=dict(top=[0, round(H, 3), 0], bottom=[0, 0, 0]), com=[0, round(H * 0.42, 2), 0],
                      engines=[dict(pos=[round(n[0], 3), round(n[1], 3), round(n[2], 3)], dir=[0, -1, 0], bell_r=n[3], length=n[4], prop=meta['prop']) for n in normalize_noz(st)],
                      group_noz_ref=[round(ref[0], 3), round(ref[1], 3), round(ref[2], 3)])
            if meta['role'] == 'fairing': sm['pivots'] = dict(fairing_L=[-meta['R'] if False else 0, 0, 0], note='fairing_L / fairing_R nodes in the asset: hinge at the base ring, sep_dir in extras')
            if st.get('legs'): sm['legs'] = len(st['legs']['pivots'])
            if (sov.get('fins') or st.get('fins')): sm['grid_fins'] = (sov.get('fins') or st.get('fins')).get('n', 4)
            man['stages'].append(sm)
        if not man['stages']:  # every stage of this rocket needs a hand-built part (winged / lifting body): leave it fully procedural
            import shutil; shutil.rmtree(vdir, ignore_errors=True); summary[vid] = {'_all_skipped': [s['key'] for s in man['skipped']]}; return
        man['order'] = [s['key'] for s in man['stages']]
        json.dump(man, open(os.path.join(vdir, 'manifest.json'), 'w'), indent=1, sort_keys=False); open(os.path.join(vdir, 'manifest.json'), 'a').write('\n')
        summary[vid] = {s['key']: s['tris'] for s in man['stages']}
    failed = []
    for f in files:
        try: one(f)
        except Exception as e:
            import traceback; traceback.print_exc(); failed.append(os.path.basename(f)); print('FAILED', f, repr(e))
    print('BAKED', json.dumps(summary))
    if failed: print('FAILED_LIST', ' '.join(failed)); sys.exit(2)

def normalize_noz(st):
    cx, cz = st['axis']; y0 = st['prof'][0][0]
    return [(x - cx, y - y0, z - cz, re, ln) for x, y, z, re, ln in st['noz']]

if __name__ == '__main__':
    main(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])

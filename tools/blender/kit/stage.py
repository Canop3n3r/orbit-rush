"""Stage asset builder: turns one stage spec (tools/blender/specs/<id>.json, extracted from the vehicle data) into a Blender Part per tier."""
import math, random, re, hashlib, json
from .geo import *
from . import parts as K

RADIAL = re.compile(r'^(srb|strap|side|struts|ssb|booster[a-z]?\d)', re.I)
FAIR = re.compile(r'^(payload|fairing)$', re.I)
CAPS = re.compile(r'^(capsule|crew|cm|csm|service|lander|probe|orbiter|ship|adapter|cargo|cap|tip|pod)', re.I)
LES = re.compile(r'^(les|abort|tower|shroud)', re.I)

def role_of(key, st):
    if st.get('empty'): return 'empty'
    if FAIR.match(key): return 'fairing'
    if LES.match(key): return 'les'
    if CAPS.match(key) and not st.get('noz'): return 'capsule'
    if RADIAL.match(key):
        prop = (st.get('info') or {}).get('prop', '')
        return 'solid' if prop == 'solid' or re.match(r'^(srb|ssb)', key, re.I) else 'strap'
    return 'tank'

def nonaxisymmetric(st):
    # f6.0 P2: the extracted bbox `w` includes attached struts / fins / nozzles, so the old |w0-w1| test flagged every strap-on booster.
    # Only winged / lifting-body shapes (bbox much wider than the hull ring, or a named plane stage) go to the procedural fallback until they get an orbiter builder.
    w = st.get('w') or [0, 0]; R = max([r for _, r in st.get('prof', [])] or [0])
    if st['key'] in ('orbiter', 'spaceplane', 'carrier', 'struts') or R <= 0: return True
    return max(w) > 0 and max(w) / (2 * R) > 1.6

def normalize(st):
    """shift a stage spec into the asset frame: origin = hull axis at the silhouette base."""
    cx, cz = st['axis']; y0 = st['prof'][0][0]
    L = dict(st); L['_ref'] = (cx, y0, cz)
    L['prof'] = [(y - y0, r) for y, r in st['prof']]
    L['bands'] = [(a - y0, b - y0, m) for a, b, m in st['bands']]
    L['noz'] = [(x - cx, y - y0, z - cz, re, ln) for x, y, z, re, ln in st['noz']]
    if st.get('legs'):
        lg = st['legs']; L['legs'] = dict(pivots=[(x - cx, y - y0, z - cz) for x, y, z in lg['pivots']], len=lg.get('len', 9.0))
    if st.get('fins'):
        f = dict(st['fins']); f['y'] = f['y'] - y0; L['fins'] = f
    return L

PROP_TINT = {'hydrolox': 0xC9825A, 'kerolox': 0xB87333, 'methalox': 0xB87333, 'solid': 0x5A5A60, 'hypergolic': 0x8E8E94}

def build_stage(vid, st, tier, ov, scale=1.0):
    """-> (Part, meta) for one stage and tier. ov = override dict for this stage."""
    W = ov.get('winged')
    if W: from . import winged as WG; st = WG.prep(st, W)
    L = normalize(st); key = st['key']; role = ov.get('role') or ('winged' if W else role_of(key, st))
    seed = int(hashlib.md5(f'{vid}/{key}'.encode()).hexdigest()[:8], 16)
    ctx = K.Ctx(K.TIERS[tier], scale, random.Random(seed), vid, key)
    # bells poke out below the engine skirt: clip the hull base up so ~45% of the shortest bell hangs free (the extracted silhouette includes the
    # thermal boots / powerhead ring that surround the bells, which would hide them)
    if L['noz'] and role not in ('fairing', 'capsule', 'les', 'winged'):
        lmin = min(n[4] for n in L['noz']); yc = min(L['noz'][0][1] if False else min(n[1] for n in L['noz']) + 0.45 * lmin, L['prof'][-1][0] * 0.5)
        if yc > L['prof'][0][0] + 0.05:
            r_c = K.interp(L['prof'], yc); L['prof'] = [(yc, r_c)] + [(y, r) for y, r in L['prof'] if y > yc + 1e-3]
            nb = []
            for a, b, m in L['bands']:
                if b <= yc: continue
                nb.append((max(a, yc), b, m))
            L['bands'] = nb or [(yc, L['prof'][-1][0], 'dark')]
    part = Part(key); cx = (0.0, 0.0); sil = L['prof']; H = sil[-1][0]; R = max(r for _, r in sil)
    prop = (st.get('info') or {}).get('prop', 'kerolox'); tint = PROP_TINT.get(prop, 0xB87333)
    if 'legs' in ov: L['legs'] = ov['legs'] and dict(L.get('legs') or {}, **ov['legs'])
    if 'fins' in ov: L['fins'] = ov['fins']
    if role == 'winged':
        WG.build(part, ctx, L, W, tint)
    elif role == 'fairing':
        K.fairing_halves(part, ctx, cx, L)
    elif role == 'capsule':
        K.capsule(part, ctx, cx, L)
        if L['noz']: K.cluster_nozzles(part, ctx, L['noz'], tint)
    elif role == 'les':
        K.les_tower(part, ctx, cx, L)
        if L['noz']: K.cluster_nozzles(part, ctx, L['noz'], tint)
    else:
        K.hull(part, cx, L, ctx)
        K.cluster_nozzles(part, ctx, L['noz'], tint, prop)
        K.engine_section(part, ctx, L, L['noz'], cx, sil[0][1], sil[0][0])
        top_r = interp_r(sil, H - 0.3)
        if role in ('tank', 'strap'):
            if st['key'] not in ('s1', 'booster', 'core', 'ccb', 'cbc') or True:
                K.interstage_details(part, ctx, cx, top_r, H, H)
            if not re.match(r'^(s1|booster|core|ccb|cbc|stage1|first)$', key, re.I): K.rcs_quads(part, ctx, cx, top_r, H - max(0.5, 0.06 * H))
        if role == 'solid': K.solid_details(part, ctx, cx, L)
        if L.get('legs') and ctx.detail >= 0: K.legs(part, ctx, cx, L['legs'])
        if L.get('fins') and ctx.detail >= 0: K.grid_fins(part, ctx, cx, interp_r(sil, L['fins']['y']), L['fins'])
        if role in ('solid', 'strap'):
            ref = st['_toward'] if '_toward' in st else None
            if ref: K.strut_to_core(part, ctx, cx, L, [H * 0.2, H * 0.78], R, ref)
    # ---- nodes (self-describing asset): nozzles, attach points, CoM hint
    for i, (x, y, z, re_, ln) in enumerate(L['noz']):
        part.empty(f'nozzle_{i}', (x, y, z), bell_r=re_, length=ln, prop=prop, dir=[0, -1, 0])
    part.empty('attach_top', (0, H, 0), kind='top'); part.empty('attach_bottom', (0, 0, 0), kind='bottom')
    if role in ('solid', 'strap'):
        part.empty('attach_side', (-R, H * 0.5, 0), kind='side')
    part.empty('com', (0, H * (0.42 if role in ('tank', 'solid', 'strap') else 0.4), 0), kind='com_hint')
    meta = dict(role=role, H=H, R=R, prop=prop, ref=L['_ref'])
    return part, meta

def interp_r(sil, y):
    return K.interp([(a, b) for a, b in sil], y)

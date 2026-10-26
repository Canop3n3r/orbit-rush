"""Kit builders: hull lathe with livery bands + grooves + soot, engine bells and clusters, thrust structure, interstage, RCS quads,
grid fins, landing legs, fairing halves, capsule/heat-shield, solid-motor details, escape tower. All in the game frame (+Y up, metres)."""
import math, random
from mathutils import Vector, Matrix
from .geo import *

# ---- tiers: segment counts; `scale` shrinks them when a stage is over its triangle budget
TIERS = {
    'hi':  dict(name='hi',  seg=48, bseg=22, brings=12, detail=2, budget=(6000, 20000)),
    'mid': dict(name='mid', seg=24, bseg=12, brings=6,  detail=1, budget=(2000, 6000)),
    'lo':  dict(name='lo',  seg=12, bseg=8,  brings=3,  detail=0, budget=(600, 1500)),
}

# ---- livery: material keys of the procedural models -> (glTF material, linear colour)
HEX = {'silver': 0xC9CCD0, 'steel': 0xB4B8BE, 'carbon': 0x2B2C30, 'dark': 0x26272B, 'grey': 0x8A8F96, 'tiles': 0x17191D, 'skirt': 0x303034,
       'shield': 0x34343A, 'foil': 0xC9A043, 'gold': 0xC9A043, 'red': 0xB0121A, 'solar': 0x1B2A55, 'foam': 0xC9803F, 'suit': 0xE8E8E8, 'ti': 0xA8A29A, 'tiframe': 0xA9A49C}
def livery(m):
    """spec material key -> (gl material, hex)"""
    k = (m or 'paint').split(':')[0]
    if k == 'paint': return 'hull', 0xEDEDE9
    if k.startswith('x-c'):
        try: return 'hull', int(k[3:], 16)
        except ValueError: return 'hull', 0xDDDDDD
    if k.startswith('x-'): return 'hull', {'salmon': 0xC9803F, 'tan': 0xC9A27A, 'orange': 0xD9772B}.get(k[2:], 0xC9803F)
    if k == 'foam': return 'foam', HEX['foam']
    if k in ('silver', 'steel', 'grey', 'foil', 'gold', 'ti', 'tiframe'): return 'metal', HEX[k]
    if k in ('tiles',): return 'tile', HEX[k]
    if k in ('carbon', 'dark', 'skirt', 'shield'): return 'dark', HEX[k]
    return 'hull', HEX.get(k, 0xCCCCCC)

def soot_arg(m):
    try: return float((m or '').split(':')[1].split(',')[0])
    except Exception: return 0.0

class Ctx:
    """per-stage build context"""
    def __init__(self, tier, scale, rng, vid, key):
        self.t = tier; self.sc = scale; self.rng = rng; self.vid = vid; self.key = key
    @property
    def seg(self): return max(6, int(round(self.t['seg'] * self.sc / 2) * 2))
    @property
    def bseg(self): return max(5, int(round(self.t['bseg'] * self.sc)))
    @property
    def brings(self): return max(2, int(round(self.t['brings'] * self.sc)))
    @property
    def detail(self): return self.t['detail']

def interp(prof, y):
    """radius of the silhouette at height y (prof = [(y, r)...] ascending)."""
    if y <= prof[0][0]: return prof[0][1]
    for (y0, r0), (y1, r1) in zip(prof, prof[1:]):
        if y <= y1:
            u = (y - y0) / ((y1 - y0) or 1); return r0 + (r1 - r0) * u
    return prof[-1][1]

# ------------------------------------------------------------------ hull
def hull(part, cx, spec, ctx, rel_y0=0.0):
    """Silhouette lathe split into livery runs; welds as grooves; soot gradient; faint panel facets (hi). Returns the groove heights."""
    sil = [(y, r) for (y, r) in spec['prof']]
    bands = spec['bands']; H = sil[-1][0] - sil[0][0]; R = max(r for _, r in sil)
    # groove (tank-section weld) heights: on near-constant radius stretches only
    grooves = []
    if ctx.detail >= 1 and H > 6 * R * 0.5:
        n = min(7 if ctx.detail >= 2 else 3, int(H / (R * 3.2)))
        for i in range(1, n + 1):
            y = sil[0][0] + H * i / (n + 1)
            if abs(interp(sil, y + 0.3) - interp(sil, y - 0.3)) < 0.02 * R and not any(b0 <= y <= b1 and False for b0, b1, _ in bands): grooves.append(y)
    cuts = sorted(set([sil[0][0], sil[-1][0]] + [p[0] for p in sil] + [b[0] for b in bands] + [b[1] for b in bands]))
    cuts = [c for c in cuts if sil[0][0] - 1e-6 <= c <= sil[-1][0] + 1e-6]
    dedup = []
    for c in cuts:
        if not dedup or c - dedup[-1] > 0.04: dedup.append(c)
    # long straight stretches get intermediate rings only when needed for grooves/colour gradients
    ys = list(dedup)
    soot = max((soot_arg(b[2]) for b in bands), default=0.0)
    soot_h = min(H * 0.22, 9.0)
    if soot > 0.05 and ctx.detail >= 1:
        for k in (0.25, 0.5, 0.75): ys.append(sil[0][0] + soot_h * k)
    ys = sorted(set(round(y, 4) for y in ys))
    def band_at(y):
        for b0, b1, m in bands:
            if b0 - 1e-6 <= y < b1 + 1e-6: return m
        return bands[-1][2]
    rng = ctx.rng; facet = [1.0 + (rng.random() - 0.5) * 0.05 for _ in range(ctx.seg)]
    base_y = sil[0][0]
    # walk the cuts, one lathe per run of equal livery material
    runs = []; cur = None
    for a, b in zip(ys, ys[1:]):
        m = band_at((a + b) / 2)
        if cur and cur[0] == m: cur[2] = b
        else:
            cur = [m, a, b]; runs.append(cur)
    for (m, ya, yb) in runs:
        gm, hx = livery(m); base = srgb(hx); sa = soot_arg(m)
        sub_ys = [y for y in ys if ya - 1e-6 <= y <= yb + 1e-6]
        prof = []
        for y in sub_ys:
            r = interp(sil, y)
            if any(abs(y - g) < 0.011 for g in grooves): prof += [(r, y - 0.02), (r * 0.985, y - 0.008), (r * 0.985, y + 0.008), (r, y + 0.02)]
            else: prof.append((r, y))
        # remove overlapping/unsorted
        prof2 = []
        for p in prof:
            if prof2 and p[1] < prof2[-1][1] - 1e-6: continue
            prof2.append(p)
        if len(prof2) < 2: continue
        sk = soot if (gm == 'hull') else 0.0
        def col(y, a, i, j, base=base, gm=gm, sk=sk):
            c = base
            if gm == 'hull' and ctx.detail >= 2: c = mulc(c, facet[j % len(facet)])
            if sk > 0.05:
                t = max(0.0, 1.0 - (y - base_y) / soot_h); c = mixc(c, (0.025, 0.022, 0.02), min(0.85, sk * t * t))
            return c
        lathe(part.buf(gm), prof2, ctx.seg, col, xf((cx[0], 0, cx[1])))
    return grooves

# ------------------------------------------------------------------ engines
def bell(part, ctx, x, y, z, re, L, tint=0xB87333, ext_frac=0.28, head=True):
    """parabolic bell with regen-cooled upper part, dark nozzle extension, corrugation rings (hi), exit lip, powerhead + actuators (hi/mid)."""
    n = ctx.brings; ry = L * 0.55 if L > re * 3.5 else L
    rows = []
    for i in range(n + 1):
        s = i / n  # 0 at the throat .. 1 at exit
        r = re * (0.27 + 0.73 * math.sqrt(s)); rows.append((r, y + L * (1 - s), s))
    prof_reg = [(r, yy) for r, yy, s in rows if s <= 1 - ext_frac + 1e-6]
    prof_ext = [(r, yy) for r, yy, s in rows if s >= 1 - ext_frac - 1e-6]
    reg = srgb(tint); ext = srgb(0x3A3A3E)
    M = xf((x, 0, z))
    if ctx.detail >= 2:
        # corrugation: alternate rows slightly in/out (hi)
        prof_reg = [(r * (1.0 + (0.012 if k % 2 else -0.004)), yy) for k, (r, yy) in enumerate(prof_reg)]
    # bottom -> top
    lathe(part.buf('bell'), list(reversed(prof_ext)), ctx.bseg, lambda yy, a, i, j: mulc(ext, 1.0), M, flip=False)
    lathe(part.buf('bell'), list(reversed(prof_reg)), ctx.bseg, lambda yy, a, i, j: mulc(reg, 0.85 + 0.15 * ((j + i) % 2)), M)
    # exit lip (skipped at lo when the stage has a big cluster)
    if not (ctx.detail == 0 and getattr(ctx, 'many', False)): lathe(part.buf('metal'), [(re * 1.0, y - 0.01 * L), (re * 1.045, y + 0.0), (re * 1.045, y + 0.03 * L + 0.02), (re, y + 0.04 * L + 0.03)], ctx.bseg, lambda *a: srgb(0x7A7C82), M)
    if head and ctx.detail >= 1:
        rt = re * 0.3; top = y + L
        lathe(part.buf('metal'), [(rt, top - 0.02), (rt * 1.35, top + re * 0.12), (rt * 1.1, top + re * 0.3), (0.0, top + re * 0.42)], ctx.bseg, lambda *a: srgb(0x9A9CA2), M)
        if ctx.detail >= 2:
            cy = Matrix.Translation((x + re * 0.55, top - re * 0.1, z)); cyl(part.buf('dark'), re * 0.2, re * 0.2, re * 0.6, 8, srgb(0x303036), cy)
            for sg in (-1, 1): rod(part.buf('metal'), (x + sg * re * 0.5, top + re * 0.35, z + re * 0.2), (x + sg * re * 0.42, top - L * 0.45, z + re * 0.2), max(0.02, re * 0.035), 5, srgb(0x8A8C92))

def cluster_nozzles(part, ctx, noz, tint=0xB87333, prop=None):
    """noz = [[x, y, z, re, L], ...] in the asset frame."""
    # budget: many engines -> fewer segments
    n = len(noz); sc = ctx.sc
    save = ctx.sc
    if n > 9: ctx.sc = ctx.sc * (0.62 if n <= 20 else 0.45)
    if n > 30: ctx.sc = ctx.sc * 0.8
    ctx.many = n > 20
    for (x, y, z, re, L) in noz: bell(part, ctx, x, y, z, re, L, tint=tint, head=(n <= 14 or ctx.detail >= 2 and n <= 40))
    ctx.sc = save

def engine_section(part, ctx, spec, noz, cx, r_base, y_base):
    """thrust structure: frustum from the hull base down to the bells' throat plane + octaweb plate with a heat-shield; bells sit inside.
    Returns nothing; adds to part."""
    if not noz: return
    top_b = max(n[1] + n[4] for n in noz); bot = min(n[1] for n in noz)
    ring = max(math.hypot(n[0] - cx[0], n[2] - cx[1]) + n[3] for n in noz)
    dark = srgb(0x2A2B2F); metal = srgb(0x70747B)
    if top_b < y_base - 0.25:
        # bells hang below the hull: a truncated cone carries them
        rb = min(r_base, max(ring * 1.08, r_base * 0.45))
        lathe(part.buf('dark'), [(rb, top_b - 0.08), (r_base, y_base)], ctx.seg, lambda *a: dark, xf((cx[0], 0, cx[1])), cap_bottom=dark)
        if ctx.detail >= 1 and len(noz) > 1:  # plate + manifold ring
            torus(part.buf('metal'), ring * 0.8, max(0.03, ring * 0.025), ctx.seg, 5, metal, y=top_b - 0.04, M=xf((cx[0], 0, cx[1])))
    else:
        yp = top_b - 0.06
        rp = max(0.2, interp([(p[0], p[1]) for p in spec['prof']], max(yp, spec['prof'][0][0])) * 0.985)
        lathe(part.buf('dark', 0.015), [(0.0, yp), (rp, yp), (rp, yp + 0.12)], ctx.seg, lambda *a: dark, xf((cx[0], 0, cx[1])), cap_top=dark)
        if ctx.detail >= 1 and len(noz) > 2:
            lathe(part.buf('tile'), [(rp * 0.96, yp - 0.015), (0.0, yp - 0.015)][::-1], ctx.seg, lambda *a: srgb(0x4A4B52), xf((cx[0], 0, cx[1])))

# ------------------------------------------------------------------ stage details
def interstage_details(part, ctx, cx, r, y_top, h):
    """separation ring groove + bolt pads near the top of a stage."""
    if ctx.detail < 1: return
    n = 12 if ctx.detail >= 2 else 6
    col = srgb(0x45474D)
    for i in range(n):
        a = i / n * TAU
        M = xf((cx[0] + math.cos(a) * r * 1.0, y_top - r * 0.16, cx[1] + math.sin(a) * r * 1.0), (0, -a, 0))
        box(part.buf('dark'), (r * 0.06, r * 0.1, r * 0.14), col, M)

def rcs_quads(part, ctx, cx, r, y):
    if ctx.detail < 1 or r < 0.45: return
    col = srgb(0x25262A)
    for i in range(4):
        a = i * PI / 2 + PI / 4; px, pz = cx[0] + math.cos(a) * r * 1.01, cx[1] + math.sin(a) * r * 1.01
        M = xf((px, y, pz), (0, -a, 0))
        box(part.buf('dark'), (r * 0.07, r * 0.16, r * 0.2), col, M)
        if ctx.detail >= 2:
            for k in (-1, 0, 1): cyl(part.buf('metal'), r * 0.012, r * 0.02, r * 0.05, 6, srgb(0x9A9CA2), xf((px + math.cos(a) * r * 0.04, y + k * r * 0.05, pz + math.sin(a) * r * 0.04), (0, 0, -PI / 2)) @ Matrix.Identity(4))

def grid_fins(part, ctx, cx, r, fins):
    """lattice grid fins as animatable pivots (stowed pointing up along the hull, hinge at the base: same convention as the procedural model)."""
    n = fins.get('n', 4); y = fins['y']; w = fins.get('w', 1.6); h = fins.get('h', 1.8); a0 = fins.get('a0', PI / 4)
    for i in range(n):
        a = a0 + i / n * TAU
        s = part.sub(f'gridfin_{i}', (cx[0] + math.cos(a) * (r + 0.05), y, cx[1] + math.sin(a) * (r + 0.05)), rot_y=-a, kind='gridfin', deploy_axis='z', deploy_deg=-88)
        col = srgb(0xA9A49C); b = s.buf('metal'); bf = s.buf('metal', 0.012 if ctx.detail >= 1 else 0.0)
        t = 0.05
        # frame (beveled) + lattice blades (plain boxes)
        for (py, sy) in ((0.1, 0.1), (h + 0.1, 0.1)): box(bf, (0.4, sy, w), col, xf((0, py, 0)))
        for sx in (-1, 1): box(bf, (0.4, h, 0.1), col, xf((0, h / 2 + 0.1, sx * w / 2)))
        if ctx.detail >= 2:
            step = 0.3
            for sgn in (1, -1):
                c = -(w + h)
                while c <= w + h:
                    lo = (0 - c) if sgn > 0 else (c - h); hi_ = (h - c) if sgn > 0 else c
                    u0 = max(-w / 2, min(lo, hi_)); u1 = min(w / 2, max(lo, hi_))
                    if u1 - u0 > 0.08:
                        um = (u0 + u1) / 2; L = (u1 - u0) * math.sqrt(2); vm = sgn * um + c
                        box(b, (0.36, L, t), col, xf((0, 0.1 + vm, um), (sgn * PI / 4, 0, 0)))
                    c += step
        elif ctx.detail == 1:
            box(b, (0.36, h * 0.9, 0.05), col, xf((0, h / 2 + 0.1, 0), (0, 0, 0)))
            box(b, (0.36, 0.05, w * 0.95), col, xf((0, h / 2 + 0.1, 0)))
            for sgn in (1, -1): box(b, (0.3, math.hypot(w, h) * 0.9, 0.04), col, xf((0, h / 2 + 0.1, 0), (sgn * math.atan2(w, h), 0, 0)))
        else:
            box(b, (0.2, h, w), col, xf((0, h / 2 + 0.1, 0)))
        box(s.buf('dark', 0.02 if ctx.detail >= 1 else 0.0), (0.5, 0.5, 0.5), srgb(0x2A2B2F), xf((0.08, 0, 0)))

def legs(part, ctx, cx, spec_legs):
    """landing legs: tapered hinged struts as animatable pivots `leg_i` (rotation.z = -t*2 rad deploys them, like setLegs). Stowed = pointing up."""
    piv = spec_legs['pivots']; ln = spec_legs.get('len') or 9.0; n = len(piv)
    for i, (px, py, pz) in enumerate(piv):
        a = math.atan2(pz - cx[1], px - cx[0])
        s = part.sub(f'leg_{i}', (px, py, pz), rot_y=-a, kind='leg', deploy_axis='z', deploy_rad=-2.0)
        col = srgb(0x2F3034); b = s.buf('dark', 0.015 if ctx.detail >= 1 else 0.0); L = ln
        # A-frame: two struts splayed at the hinge (z = +-w) converging at the foot, a crossbar and a crush-core rod (real 3D, not a plate)
        w = 0.55 * min(1.0, ln / 7) + 0.1; rr = max(0.07, 0.011 * ln); sd = 6 if ctx.detail >= 1 else 4
        for sg in (-1, 1): rod(b, (0.02, 0.0, sg * w), (0.34, L, sg * 0.07), rr, sd, col)
        rod(b, (0.02, L * 0.38, -w * 0.62), (0.02, L * 0.38, w * 0.62), rr * 0.7, sd, col)
        rod(s.buf('metal'), (0.34, L * 0.15, 0.0), (0.34, L * 0.95, 0.0), rr * 0.8, sd, srgb(0x8A8F96))
        if ctx.detail >= 1:
            cyl(s.buf('dark'), 0.62, 0.72, 0.26, 12 if ctx.detail >= 2 else 8, srgb(0x25262A), xf((0.2, L + 0.02, 0), (0, 0, PI / 2)))  # foot pad
            box(s.buf('dark', 0.01), (0.3, 0.5, 1.2), srgb(0x25262A), xf((0.1, 0.25, 0)))                     # hinge clevis
        if ctx.detail >= 2:
            for sg in (-1, 1): box(s.buf('metal'), (0.03, L * 0.85, 0.12), srgb(0x6E7178), xf((0.52, L * 0.45, sg * 0.28), (0, 0, 0.0)))

def solid_details(part, ctx, cx, spec):
    """casting-segment joints are grooves (done by hull()); here: aft skirt lip + nozzle flex-seal ring + forward attach ring."""
    if ctx.detail < 1: return
    y0 = spec['prof'][0][0]; r = spec['prof'][0][1]
    torus(part.buf('metal'), r * 0.92, max(0.02, r * 0.03), ctx.seg, 4, srgb(0x6E7178), y=y0 + 0.02, M=xf((cx[0], 0, cx[1])))

def strut_to_core(part, ctx, cx, spec, ys, r, toward):
    """two attach struts from a strap-on toward the core axis (direction `toward` in the stage frame)"""
    if ctx.detail < 1: return
    col = srgb(0x3A3B40)
    d = Vector(toward); d.normalize()
    for y in ys:
        rod(part.buf('dark', 0.0), (cx[0] + d.x * r * 0.9, y, cx[1] + d.z * r * 0.9), (cx[0] + d.x * (r * 0.9 + max(0.5, r * 1.2)), y, cx[1] + d.z * (r * 0.9 + max(0.5, r * 1.2))), max(0.04, r * 0.06), 6, col)

# ------------------------------------------------------------------ fairing (two halves) and capsules
def fairing_halves(part, ctx, cx, spec):
    """payload shell as two separate half-shells (outer + inner skin + seam lips) on `fairing_L` / `fairing_R` pivots (hinge on the base ring)."""
    sil = [(y, r) for y, r in spec['prof']]; base = sil[0][0]; col = srgb(livery(spec['bands'][-1][2])[1]) if spec['bands'] else srgb(0xEDEDE9)
    gm = livery(spec['bands'][0][2])[0] if spec['bands'] else 'hull'
    rb = sil[0][1]
    ys = [p[0] for p in sil]
    # resample the long stretches so the ogive keeps its curve at low seg
    prof = [(r, y - base) for y, r in sil]
    for hi_, (a0, a1, nm, sgn) in enumerate(((0.0, PI, 'fairing_L', 1), (PI, TAU, 'fairing_R', -1))):
        s = part.sub(nm, (cx[0], base, cx[1]), rot_y=0.0, kind='fairing_half', hinge=[sgn * rb, 0, 0], sep_dir=[sgn, 0.25, 0])
        seg = max(4, ctx.seg // 2)
        lathe(s.buf(gm), prof, seg, lambda y, a, i, j: mulc(col, 1.0 - 0.04 * (j % 2) * (ctx.detail >= 2)), None, a0=a0, a1=a1)
        if ctx.detail >= 1:
            # inner skin (inverted, slightly smaller) so the open halves are not see-through after separation
            lathe(s.buf('dark'), [(max(0.0, r - 0.06), y) for r, y in prof], seg, lambda *a: srgb(0xC9A27A), None, a0=a0, a1=a1, flip=True)
            for ang in (a0, a1):                                         # seam lips
                pr = [(r, y) for r, y in prof]
                for k in range(len(pr) - 1):
                    r0, y0 = pr[k]; r1, y1 = pr[k + 1]
                    if r0 < 0.02 and r1 < 0.02: continue
                    ca, sa = math.cos(ang), math.sin(ang)
                    v = [s.buf('dark').vert(p) for p in ((r0 * ca, y0, r0 * sa), (r1 * ca, y1, r1 * sa), (max(0, r1 - 0.06) * ca, y1, max(0, r1 - 0.06) * sa), (max(0, r0 - 0.06) * ca, y0, max(0, r0 - 0.06) * sa))]
                    s.buf('dark').face(tuple(v), srgb(0x2A2B2F))
        if ctx.detail >= 2:
            # base ring + 2 acoustic panels (colour only), separation bolts
            for k in range(8):
                a = a0 + (a1 - a0) * (k + 0.5) / 8
                box(s.buf('dark', 0.008), (rb * 0.05, rb * 0.04, rb * 0.08), srgb(0x3A3B40), xf((rb * 1.0 * math.cos(a), 0.14, rb * math.sin(a)), (0, -a, 0)))

def capsule(part, ctx, cx, spec):
    """crew/cargo capsule: silhouette lathe + heat-shield tiles (hex-ish tile colour noise) + window ring + thruster quads + docking collar."""
    sil = spec['prof']; y0 = sil[0][0]; R = max(r for _, r in sil)
    # base hull from bands (tiles band keeps tile colour via livery())
    hull(part, cx, spec, ctx)
    # window row (hi/mid)
    if ctx.detail >= 1:
        ym = y0 + (sil[-1][0] - y0) * 0.45; rm = interp(sil, ym)
        for k in range(4 if ctx.detail >= 2 else 2):
            a = PI / 2 + k * 0.28 - 0.42
            box(part.buf('glass'), (rm * 0.06, rm * 0.1, rm * 0.14), srgb(0x0C1218), xf((cx[0] + math.cos(a) * rm * 0.99, ym, cx[1] + math.sin(a) * rm * 0.99), (0, -a, 0)))
    rcs_quads(part, ctx, cx, interp(sil, y0 + (sil[-1][0] - y0) * 0.7), y0 + (sil[-1][0] - y0) * 0.7)

def les_tower(part, ctx, cx, spec):
    hull(part, cx, spec, ctx)

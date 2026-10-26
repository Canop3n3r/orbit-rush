"""Geometry accumulation + Blender assembly.

All kit code works in the GAME frame (metres, +Y up, the vehicle axis is +Y). Vertices are converted to Blender's Z-up frame only when a
mesh is created ((x, y, z) -> (x, -z, y), a proper rotation) and the glTF exporter's +Y-up conversion maps them straight back.

A Buf collects one material's geometry (verts, faces, per-corner linear RGBA colours). `hard` buffers get a Bevel modifier (hard-surface
parts: fins, legs, blocks); everything gets Smooth-by-angle shading, then the buffers of one material are joined into ONE mesh.
"""
import math, bpy, bmesh
from mathutils import Vector, Matrix

PI = math.pi
TAU = 2 * math.pi

def srgb(h):
    """0xRRGGBB -> linear RGB tuple."""
    c = [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]
    return tuple((v / 12.92) if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)

def mulc(c, k):
    return (c[0] * k, c[1] * k, c[2] * k)

def mixc(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)

def P(v):
    """game frame -> blender frame"""
    return (v[0], -v[2], v[1])

class Buf:
    __slots__ = ('v', 'f', 'c', 'bevel')
    def __init__(self, bevel=0.0):
        self.v = []; self.f = []; self.c = []; self.bevel = bevel
    def vert(self, p):
        self.v.append((p[0], p[1], p[2])); return len(self.v) - 1
    def face(self, idx, col):
        self.f.append(tuple(idx)); self.c.append(col)
    def tris(self):
        return sum(len(f) - 2 for f in self.f)

class Part:
    """Everything one stage asset consists of: material buffers, empties (nodes with extras) and sub-assemblies (pivot + buffers)."""
    def __init__(self, name):
        self.name = name; self.bufs = {}; self.empties = []; self.subs = []
    def buf(self, mat, bevel=0.0):
        k = (mat, round(bevel, 4))
        if k not in self.bufs: self.bufs[k] = Buf(bevel)
        return self.bufs[k]
    def empty(self, name, pos, rot_y=0.0, **extras):
        self.empties.append(dict(name=name, pos=tuple(pos), rot_y=rot_y, extras=extras))
    def sub(self, name, pos, rot_y=0.0, **extras):
        """a child pivot (own transform) with its own buffers: used for animated pieces (legs, fins, fairing halves)."""
        s = Part(name); s.pos = tuple(pos); s.rot_y = rot_y; s.extras = extras; self.subs.append(s); return s
    def tris(self):
        n = sum(b.tris() for b in self.bufs.values())
        for s in self.subs: n += s.tris()
        return n

# ---------------------------------------------------------------- transforms
def xf(pos=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    """game-frame transform: rotations about game X, Y, Z (applied Z then X then Y, like three's 'YXZ' euler)."""
    m = Matrix.Translation(pos)
    ry = Matrix.Rotation(rot[1], 4, 'Y'); rx = Matrix.Rotation(rot[0], 4, 'X'); rz = Matrix.Rotation(rot[2], 4, 'Z')
    s = Matrix.Diagonal((scale[0], scale[1], scale[2], 1))
    return m @ ry @ rx @ rz @ s

def _ap(M, p):
    if M is None: return p
    v = M @ Vector(p); return (v.x, v.y, v.z)

# ---------------------------------------------------------------- primitives
def lathe(buf, prof, seg, col, M=None, a0=0.0, a1=TAU, flip=False, angles=None, cap_bottom=None, cap_top=None):
    """Surface of revolution about +Y. prof = [(r, y), ...] bottom -> top; col(y, a, i, j) -> linear rgb per quad (ring i, column j).
    angles: optional explicit angle list (to put narrow seam columns); cap_*: colour for a flat disc closing that end."""
    full = abs((a1 - a0) - TAU) < 1e-6
    if angles is None:
        n = seg if full else seg + 1
        angles = [a0 + (a1 - a0) * j / seg for j in range(n)]
    n = len(angles); rings = []
    for (r, y) in prof:
        rings.append([buf.vert(_ap(M, (r * math.cos(a), y, r * math.sin(a)))) for a in angles])
    nj = n if full else n - 1
    for i in range(len(prof) - 1):
        ra, rb = rings[i], rings[i + 1]
        if prof[i][0] < 1e-6 and prof[i + 1][0] < 1e-6: continue
        for j in range(nj):
            j2 = (j + 1) % n
            c = col((prof[i][1] + prof[i + 1][1]) / 2, (angles[j] + angles[j2] if j2 else angles[j] + a1) / 2, i, j)
            if prof[i][0] < 1e-6: q = (ra[0], rb[j2], rb[j])      # apex at the bottom
            elif prof[i + 1][0] < 1e-6: q = (ra[j], ra[j2], rb[0])
            else: q = (ra[j], rb[j], rb[j2], ra[j2])
            if flip: q = tuple(reversed(q))
            buf.face(q, c)
    for (ring, y, cc, up) in ((rings[0], prof[0][1], cap_bottom, False), (rings[-1], prof[-1][1], cap_top, True)):
        if cc is None or (prof[0 if not up else -1][0] < 1e-6): continue
        ctr = buf.vert(_ap(M, (0, y, 0)))
        for j in range(nj):
            j2 = (j + 1) % n
            q = (ctr, ring[j2], ring[j]) if up else (ctr, ring[j], ring[j2])
            if flip: q = tuple(reversed(q))
            buf.face(q, cc)
    return rings

def box(buf, size, col, M=None):
    sx, sy, sz = size[0] / 2, size[1] / 2, size[2] / 2
    vs = [buf.vert(_ap(M, (x * sx, y * sy, z * sz))) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
    # index = x*4 + y*2 + z  (bits)
    def V(x, y, z): return vs[x * 4 + y * 2 + z]
    for q in ((V(1, 0, 0), V(1, 1, 0), V(1, 1, 1), V(1, 0, 1)), (V(0, 0, 1), V(0, 1, 1), V(0, 1, 0), V(0, 0, 0)),
              (V(0, 1, 0), V(0, 1, 1), V(1, 1, 1), V(1, 1, 0)), (V(0, 0, 1), V(0, 0, 0), V(1, 0, 0), V(1, 0, 1)),
              (V(0, 0, 1), V(1, 0, 1), V(1, 1, 1), V(0, 1, 1)), (V(1, 0, 0), V(0, 0, 0), V(0, 1, 0), V(1, 1, 0))):
        buf.face(q, col)

def prism(buf, poly, depth, col, M=None):
    """extrude a convex/simple 2D polygon [(u, v)...] (CCW) along local +Z by depth (centred); u->x, v->y."""
    n = len(poly); h = depth / 2
    a = [buf.vert(_ap(M, (u, v, -h))) for (u, v) in poly]; b = [buf.vert(_ap(M, (u, v, h))) for (u, v) in poly]
    buf.face(tuple(reversed(a)), col); buf.face(tuple(b), col)
    for i in range(n):
        j = (i + 1) % n; buf.face((a[i], a[j], b[j], b[i]), col)

def cyl(buf, r0, r1, h, seg, col, M=None, caps=True):
    """frustum along +Y from y=0..h"""
    lathe(buf, [(r0, 0), (r1, h)], seg, lambda *a: col, M, cap_bottom=col if caps else None, cap_top=col if caps else None)

def rod(buf, a, b, r, seg, col):
    a = Vector(a); b = Vector(b); d = b - a; L = d.length
    if L < 1e-6: return
    q = Vector((0, 1, 0)).rotation_difference(d.normalized()).to_matrix().to_4x4()
    cyl(buf, r, r, L, seg, col, Matrix.Translation(a) @ q)

def torus(buf, R, r, seg, tseg, col, y=0.0, M=None):
    prof = [(R + r * math.cos(t), y + r * math.sin(t)) for t in [TAU * k / tseg for k in range(tseg + 1)]]
    # lathe expects bottom->top; a closed circle profile is fine (outward winding for CW circle)
    lathe(buf, list(reversed(prof)), seg, lambda *a: col, M)

# ---------------------------------------------------------------- assembly / export
MATS = {  # name: (roughness, metallic, doubleSided)
    'hull': (0.42, 0.04, False), 'metal': (0.34, 0.85, False), 'bell': (0.28, 0.95, True), 'dark': (0.62, 0.25, True),
    'tile': (0.72, 0.0, False), 'glass': (0.06, 0.2, False), 'foam': (0.9, 0.0, False), 'emit': (0.5, 0.0, False),
}
_mat_cache = {}
def get_material(name):
    if name in _mat_cache: return _mat_cache[name]
    rough, metal, dbl = MATS[name]
    m = bpy.data.materials.new('or_' + name); m.use_nodes = True
    nt = m.node_tree; bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = rough; bsdf.inputs['Metallic'].default_value = metal
    ca = nt.nodes.new('ShaderNodeVertexColor'); ca.layer_name = 'Col'
    nt.links.new(ca.outputs['Color'], bsdf.inputs['Base Color'])
    m.use_backface_culling = not dbl
    _mat_cache[name] = m; return m

def _mesh_from_bufs(name, bl):
    me = bpy.data.meshes.new(name); verts = []; faces = []; cols = []
    for b in bl:
        o = len(verts); verts += [P(v) for v in b.v]
        for f, c in zip(b.f, b.c):
            faces.append(tuple(i + o for i in f)); cols.extend([c] * len(f))
    me.from_pydata(verts, [], faces); me.update()
    ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    flat = []
    for c in cols: flat.extend((c[0], c[1], c[2], 1.0))
    ca.data.foreach_set('color', flat)
    return me

def _finish_object(ob, mat):
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.selected_objects: o.select_set(False)
    ob.select_set(True)
    # weld coincident verts (lathe seams, shared ring edges) so smooth shading is continuous; then smooth by angle (creases stay hard)
    bm = bmesh.new(); bm.from_mesh(ob.data); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data); bm.free()
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(38))
    ob.data.materials.append(get_material(mat))

def build_objects(part, parent=None, coll=None):
    """create the Blender objects for a Part (recursively). Returns the root object."""
    coll = coll or bpy.context.scene.collection
    root = bpy.data.objects.new(part.name, None); coll.objects.link(root)
    if parent is not None:
        root.parent = parent
    if hasattr(part, 'pos'):
        root.location = P(part.pos); root.rotation_euler = (0, 0, part.rot_y)
        for k, v in part.extras.items(): root[k] = v
    by_mat = {}
    for (mat, bw), b in sorted(part.bufs.items(), key=lambda kv: (kv[0][0], kv[0][1])):
        if not b.f: continue
        me = _mesh_from_bufs(f'{part.name}_{mat}_{bw}', [b]); ob = bpy.data.objects.new(f'{part.name}_{mat}_{bw}', me); coll.objects.link(ob)
        _finish_object(ob, mat)
        if bw > 0:
            m = ob.modifiers.new('bev', 'BEVEL'); m.width = bw; m.segments = 1; m.limit_method = 'ANGLE'; m.angle_limit = math.radians(40)
            bpy.context.view_layer.objects.active = ob; bpy.ops.object.modifier_apply(modifier='bev')
            bpy.ops.object.shade_smooth_by_angle(angle=math.radians(38))
        by_mat.setdefault(mat, []).append(ob)
    for mat, obs in by_mat.items():
        for o in bpy.context.selected_objects: o.select_set(False)
        for o in obs: o.select_set(True)
        bpy.context.view_layer.objects.active = obs[0]
        if len(obs) > 1: bpy.ops.object.join()
        j = bpy.context.view_layer.objects.active; j.name = f'{part.name}.{mat}'; j.data.name = j.name
        j.parent = root
    for e in part.empties:
        eo = bpy.data.objects.new(e['name'], None); eo.empty_display_type = 'ARROWS'; coll.objects.link(eo)
        eo.parent = root; eo.location = P(e['pos']); eo.rotation_euler = (0, 0, e['rot_y'])
        for k, v in e['extras'].items(): eo[k] = v
    for s in part.subs: build_objects(s, root, coll)
    return root

def count_tris(root, detail=False):
    n = 0; d = {}
    for o in [root] + list(root.children_recursive):
        if o.type == 'MESH':
            t = sum(len(p.vertices) - 2 for p in o.data.polygons); n += t; d[o.name] = t
    return (n, d) if detail else n

def export_glb(root, path):
    for o in bpy.context.selected_objects: o.select_set(False)
    for o in [root] + list(root.children_recursive): o.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=False,
                              export_vertex_color='ACTIVE', export_all_vertex_colors=False, export_attributes=False, export_normals=True,
                              export_texcoords=False, export_extras=True, export_cameras=False, export_lights=False, export_animations=False,
                              export_skins=False, export_materials='EXPORT', will_save_settings=False)

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mat_cache.clear()

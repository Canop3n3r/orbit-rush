// Post-process the Blender output: quantize + meshopt-compress every .glb (deterministic), dedupe byte-identical stage assets into
// assets/rockets/_shared/, add byte counts to the manifests, rewrite assets/rockets/index.json.  Usage: node optimize.mjs <assets/rockets dir> [id...]
// Needs @gltf-transform/{core,functions,extensions} + meshoptimizer (npm i in $GLTFX, default /workspace/tools/gltfx; see build.sh).
import fs from 'fs'; import path from 'path'; import crypto from 'crypto'; import { createRequire } from 'module';
const GX = process.env.GLTFX || '/workspace/tools/gltfx'; const req = createRequire(GX + '/');
const { NodeIO } = req('@gltf-transform/core'), { ALL_EXTENSIONS } = req('@gltf-transform/extensions'), F = req('@gltf-transform/functions'), { MeshoptEncoder, MeshoptDecoder } = req('meshoptimizer');
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const root = process.argv[2], only = process.argv.slice(3);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const ids = fs.readdirSync(root).filter(d => fs.existsSync(path.join(root, d, 'manifest.json')) && (!only.length || only.includes(d))).sort();
fs.mkdirSync(path.join(root, '_shared'), { recursive: true });


const items = []; // every compressed asset: dedupe (byte-identical across stages/rockets) happens after all are known
for (const id of ids) {
  const dir = path.join(root, id), mp = path.join(dir, 'manifest.json'), man = JSON.parse(fs.readFileSync(mp, 'utf8'));
  for (const st of man.stages) for (const t of man.tiers) {
    const rel = st.asset[t]; if (!rel) continue; const fp = path.join(root, '..', '..', rel);
    if (!fs.existsSync(fp)) continue;
    const doc = await io.read(fp);
    if (!doc.getRoot().listExtensionsUsed().some(e => e.extensionName === 'EXT_meshopt_compression')) {
      await doc.transform(F.dedup(), F.prune({ keepLeaves: true }), F.quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeColor: 8 }), F.meshopt({ encoder: MeshoptEncoder, level: 'high' }));
      await io.write(fp, doc);
    }
    const buf = fs.readFileSync(fp); items.push({ man, mp, st, t, rel, fp, buf, h: crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10) });
  }
}
// a shared file is referenced by several stages: count over ALL manifests on disk, not only the ones processed now
const refs = new Map();
for (const d of fs.readdirSync(root)) { const p = path.join(root, d, 'manifest.json'); if (!fs.existsSync(p)) continue; const m = JSON.parse(fs.readFileSync(p, 'utf8')); for (const st of m.stages) for (const a of Object.values(st.asset)) refs.set(a, (refs.get(a) || 0) + 1); }
const cnt = new Map(); for (const it of items) cnt.set(it.h + it.t, (cnt.get(it.h + it.t) || 0) + 1);
for (const it of items) {
  const sp = path.join(root, '_shared', `${it.h}.${it.t}.glb`), srel = `assets/rockets/_shared/${it.h}.${it.t}.glb`;
  if (cnt.get(it.h + it.t) > 1 || fs.existsSync(sp)) { if (!fs.existsSync(sp)) fs.writeFileSync(sp, it.buf); if (it.fp !== sp && fs.existsSync(it.fp)) fs.unlinkSync(it.fp); it.st.asset[it.t] = srel; }
  it.st.bytes = it.st.bytes || {}; it.st.bytes[it.t] = it.buf.length;
}
const done = new Set(); for (const it of items) if (!done.has(it.man)) { done.add(it.man); it.man.bytes = {}; for (const st of it.man.stages) for (const [t, b] of Object.entries(st.bytes || {})) it.man.bytes[t] = (it.man.bytes[t] || 0) + b; fs.writeFileSync(it.mp, JSON.stringify(it.man, null, 1) + '\n'); }
// index.json: keep existing `enabled` flags, add new rockets as enabled
const ip = path.join(root, 'index.json'); const idx = fs.existsSync(ip) ? JSON.parse(fs.readFileSync(ip, 'utf8')) : { version: 1, rockets: {} };
for (const d of fs.readdirSync(root).filter(d => fs.existsSync(path.join(root, d, 'manifest.json'))).sort()) { const man = JSON.parse(fs.readFileSync(path.join(root, d, 'manifest.json'), 'utf8')); const e = idx.rockets[d] || { enabled: true };
  idx.rockets[d] = { enabled: e.enabled, tiers: man.tiers, stages: man.stages.length, skipped: (man.skipped || []).length, bytes: man.bytes || {} }; }
idx.rockets = Object.fromEntries(Object.entries(idx.rockets).sort(([a], [b]) => a < b ? -1 : 1));
fs.writeFileSync(ip, JSON.stringify(idx, null, 1) + '\n');
// remove unreferenced shared files
const ref = new Set(); for (const d of Object.keys(idx.rockets)) { const man = JSON.parse(fs.readFileSync(path.join(root, d, 'manifest.json'), 'utf8')); for (const st of man.stages) for (const a of Object.values(st.asset)) ref.add(path.basename(a)); }
for (const f of fs.readdirSync(path.join(root, '_shared'))) if (!ref.has(f)) fs.unlinkSync(path.join(root, '_shared', f));
console.log('optimized', ids.length, 'rockets');

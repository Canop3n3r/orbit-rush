# f5.9-21 desktop cold-load (static pass, before profiling)
Desktop (no touch, hardware GPU) picks gfx 'high' (gfx/presets.js): 2K textures, bloom, normal maps, pixel ratio 1.5;
fx 'high'; planetLOD 'high' (N 16, maxDepth 15, up to 240 chunks, 128x64 sphere); site art 'hi'; staged rocket glb 'hi'
(1.46 MB vs 0.72 MB mid); prewarmHeavy builds hi hero LODs of heron-heavy + colossus v3/v4 at home; compileAsync of the high
tier shaders before the first frame. Phones get med everywhere.
Network: all textures ≤0.6 MB each, rocket glbs ≤1.5 MB total, so bytes are not the likely cause; CPU/GPU work on the
high tier (shader compile, LOD build, prewarm) is the suspect. To confirm in the browser profile.

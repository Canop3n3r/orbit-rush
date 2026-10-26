#!/bin/bash
# one-time setup: a venv with the Blender python module (pip bpy; needs a matching python, 3.13 for bpy 5.x) + the glTF-Transform tools.
set -e
T="${TOOLS:-/workspace/tools}"; mkdir -p "$T"
python3 -m venv "$T/bpyenv"; "$T/bpyenv/bin/pip" install -q bpy numpy
mkdir -p "$T/gltfx"; cd "$T/gltfx"; [ -f package.json ] || npm init -y >/dev/null; npm i @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions meshoptimizer 2>&1 | tail -1
echo "ok: BPY=$T/bpyenv/bin/python GLTFX=$T/gltfx"

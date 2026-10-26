#!/bin/bash
# Orbit Rush Blender pipeline: tools/blender/build.sh [rocket-id ...|all]
#   specs (tools/blender/specs/<id>.json, extracted from the vehicle data) -> Blender (bpy) kit -> assets/rockets/<id>/<stage>.<tier>.glb + manifest.json
#   -> meshopt/quantize + dedupe (optimize.mjs) -> assets/rockets/index.json.  Deterministic + idempotent: same inputs => same bytes.
# Env: BPY (python with `pip install bpy`, default /workspace/tools/bpyenv/bin/python; tools/blender/setup.sh creates one), GLTFX (node_modules for optimize.mjs), TIERS (default hi,mid,lo)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$HERE/../.." && pwd)"
BPY="${BPY:-/workspace/tools/bpyenv/bin/python}"; TIERS="${TIERS:-hi,mid,lo}"; OUT="$REPO/assets/rockets"
[ -x "$BPY" ] || { echo "no bpy python at $BPY: run tools/blender/setup.sh"; exit 1; }
mkdir -p "$OUT"
if [ $# -eq 0 ] || [ "$1" = all ]; then FILES=$(ls "$HERE"/specs/*.json | sort); else FILES=""; for id in "$@"; do FILES="$FILES $HERE/specs/$id.json"; done; fi
# the Blender step writes fresh (uncompressed) glbs for the requested rockets; shared dedupe files of OTHER rockets are untouched
for f in $FILES; do rm -rf "$OUT/$(basename "$f" .json)"; done
"$BPY" "$HERE/bake.py" -- "$OUT" $FILES --tiers="$TIERS" 2>&1 | grep -E "^(BAKED|FAILED|Traceback|  File|[A-Za-z]*Error)" || true
node "$HERE/optimize.mjs" "$OUT" $( [ $# -gt 0 ] && [ "$1" != all ] && echo "$@" )

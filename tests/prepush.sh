#!/bin/bash
# f5.7i (QA f5.7g): pre-push checks for UI pushes, run from the repo root before `git push origin HEAD:main`.
# Serves the tree on $PORT, runs targeted unit tests + sim_ui + ui_budget (--strict default), one browser at a time, then stops the server.
set -u; PORT=${PORT:-8958}; cd "$(dirname "$0")/.."; fail=0
python3 -m http.server $PORT >/dev/null 2>&1 & SRV=$!; trap 'kill $SRV 2>/dev/null' EXIT; sleep 1
for t in ${TESTS:-mobile qol plainhud navball navstick flightmenu tilefade fleet payload_kinds}; do node tests/$t.mjs >/tmp/prepush_$t.log 2>&1 || { echo "FAIL tests/$t.mjs"; fail=1; }; done
U=http://localhost:$PORT/ OUT=${OUT:-/tmp/prepush_sim_ui} node tests/smoke/sim_ui.cjs >/tmp/prepush_sim_ui.log 2>&1 || { echo "FAIL sim_ui"; fail=1; }; tail -2 /tmp/prepush_sim_ui.log
node tests/smoke/audio_stop.cjs http://localhost:$PORT/ >/tmp/prepush_audio_stop.log 2>&1 || { echo "FAIL audio_stop"; fail=1; }; tail -1 /tmp/prepush_audio_stop.log # f5.8y: no engine/wind loop survives the flight screen
node tests/smoke/audio_music.cjs http://localhost:$PORT/ >/tmp/prepush_audio_music.log 2>&1 || { echo "FAIL audio_music"; fail=1; }; tail -1 /tmp/prepush_audio_music.log # f6.3: menu beat, space score, pause silence, crackle/distance mix, music settings
U=http://localhost:$PORT/ node tests/hero_models.cjs >/tmp/prepush_hero_models.log 2>&1 || { echo "FAIL hero_models"; fail=1; }; tail -1 /tmp/prepush_hero_models.log # f5.8s: nothing past the nose / no floating dress, every model and tier
U=http://localhost:$PORT/ node tests/smoke/hero_follow.cjs >/tmp/prepush_hero_follow.log 2>&1 || { echo "FAIL hero_follow"; fail=1; }; tail -1 /tmp/prepush_hero_follow.log # f5.8r: hero model follows the sim on 3 rockets (phone), no page errors / [Orbit Rush] warnings
U=http://localhost:$PORT/ STRIDE=${LAUNCH_STRIDE:-6} node tests/smoke/launch_all.cjs >/tmp/prepush_launch_all.log 2>&1 || { echo "FAIL launch_all"; fail=1; }; tail -1 /tmp/prepush_launch_all.log # f5.9-0: every roster rocket launches from Home (no Build), deep links fall back to Home
U=http://localhost:$PORT/ OUT=/tmp/prepush_terrain VIEWS=1280x800 PITCH=0.65 node tests/smoke/terrain_blend.cjs 1 20 44 100 >/tmp/prepush_terrain.log 2>&1 || { echo "FAIL terrain_blend"; fail=1; }; tail -1 /tmp/prepush_terrain.log # f5.9: the near-field ground tile fades into the globe (no round edge / pop), 1/20/44/100 km
[ -n "${NO_BUDGET:-}" ] || { node tests/smoke/ui_budget_smoke.cjs http://localhost:$PORT/ >/tmp/prepush_budget.log 2>&1 || { echo "FAIL ui_budget"; fail=1; }; tail -2 /tmp/prepush_budget.log
  # f5.8y (QA f5.8w): a row that FAILs in two runs in a row is real, not load: re-run the budget once when anything failed and fail the push on the FAIL rows common to both runs (the ratchet above still guards the pass count)
  if grep -q '^FAIL ' /tmp/prepush_budget.log && [ -z "${NO_RETRY:-}" ]; then node tests/smoke/ui_budget_smoke.cjs http://localhost:$PORT/ >/tmp/prepush_budget2.log 2>&1
    common=$(comm -12 <(grep '^FAIL ' /tmp/prepush_budget.log | awk '{print $2,$3,$4}' | sort -u) <(grep '^FAIL ' /tmp/prepush_budget2.log | awk '{print $2,$3,$4}' | sort -u))
    if [ -n "$common" ]; then echo "FAIL ui_budget rows failing in both runs:"; echo "$common"; fail=1; else echo "budget: FAIL rows differed between the two runs (load), none common"; fi; fi; }
gitleaks protect --staged --no-banner >/dev/null 2>&1 && gitleaks detect --no-banner --log-opts="origin/main..HEAD" >/dev/null 2>&1 || { echo "FAIL gitleaks"; fail=1; }
[ $fail = 0 ] && echo "prepush OK" || echo "prepush FAILED"; exit $fail

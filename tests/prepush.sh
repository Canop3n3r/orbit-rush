#!/bin/bash
# f5.7i (QA f5.7g): pre-push checks for UI pushes, run from the repo root before `git push origin HEAD:main`.
# Serves the tree on $PORT, runs targeted unit tests + sim_ui + ui_budget (--strict default), one browser at a time, then stops the server.
set -u; PORT=${PORT:-8958}; cd "$(dirname "$0")/.."; fail=0
python3 -m http.server $PORT >/dev/null 2>&1 & SRV=$!; trap 'kill $SRV 2>/dev/null' EXIT; sleep 1
for t in ${TESTS:-mobile qol plainhud navball navstick flightmenu}; do node tests/$t.mjs >/tmp/prepush_$t.log 2>&1 || { echo "FAIL tests/$t.mjs"; fail=1; }; done
U=http://localhost:$PORT/ OUT=${OUT:-/tmp/prepush_sim_ui} node tests/smoke/sim_ui.cjs >/tmp/prepush_sim_ui.log 2>&1 || { echo "FAIL sim_ui"; fail=1; }; tail -2 /tmp/prepush_sim_ui.log
[ -n "${NO_BUDGET:-}" ] || { node tests/smoke/ui_budget_smoke.cjs http://localhost:$PORT/ >/tmp/prepush_budget.log 2>&1 || { echo "FAIL ui_budget"; fail=1; }; tail -2 /tmp/prepush_budget.log; }
gitleaks protect --staged --no-banner >/dev/null 2>&1 && gitleaks detect --no-banner --log-opts="origin/main..HEAD" >/dev/null 2>&1 || { echo "FAIL gitleaks"; fail=1; }
[ $fail = 0 ] && echo "prepush OK" || echo "prepush FAILED"; exit $fail

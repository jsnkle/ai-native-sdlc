#!/usr/bin/env bash
# Run every eval in evals/*.json (or the ones given as arguments) against a clean working tree.
# Each eval: optional "setup" commands, then the agent, then evals/check.sh. The tree is reset after each.
# Locally this runs under your Claude Code login; in CI under ANTHROPIC_API_KEY.
set -u
root=$(cd "$(dirname "$0")/.." && pwd); cd "$root"
[ -n "$(git status --porcelain)" ] && { echo "working tree must be clean"; exit 2; }
files=("$@"); [ ${#files[@]} -eq 0 ] && files=(evals/*.json)
pass=0; fail=0; failed=()
for eval in "${files[@]}"; do
  name=$(jq -r '.name' "$eval"); echo "== $name"
  while IFS= read -r c; do [ -n "$c" ] && bash -c "$c"; done < <(jq -r '.setup // [] | .[]' "$eval")
  claude -p "$(jq -r '.prompt' "$eval")" \
    --permission-mode acceptEdits \
    --allowedTools "$(jq -r '.allowedTools // "Read,Edit,Bash(make test)"' "$eval")" \
    --output-format json > "evals/.result-$name.json" 2>/dev/null < /dev/null || true
  if ./evals/check.sh "$eval" "evals/.result-$name.json"; then pass=$((pass+1)); else fail=$((fail+1)); failed+=("$name"); fi
  git checkout -q -- . && git clean -fdq -e 'evals/.result-*' -e .venv
done
echo "== $pass passed, $fail failed${failed:+: ${failed[*]}}"
[ $fail -eq 0 ]

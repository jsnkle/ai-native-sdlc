#!/bin/bash
# Usage: evals/check.sh <eval.json> <result.json>
# Runs the checks declared in the eval against the working tree and the agent's JSON output.
# Exits non-zero on the first failing check. Requires jq and git.
set -u
eval_file="$1"; result_file="$2"
name=$(jq -r '.name // "unnamed"' "$eval_file")
fail() { echo "FAIL [$name] $1"; exit 1; }

# The agent's final text. `claude -p --output-format json` puts it under .result.
result_text=$(jq -r 'if type=="array" then (map(.result // empty) | join("\n")) else (.result // "") end' "$result_file" 2>/dev/null || cat "$result_file")

for cmd in $(jq -r '.checks.commands // [] | .[] | @base64' "$eval_file"); do
  c=$(echo "$cmd" | base64 --decode)
  bash -c "$c" >/dev/null 2>&1 || fail "command failed: $c"
done

changed=$(git status --porcelain -uall | cut -c4-)

for prefix in $(jq -r '.checks.files_changed_match // [] | .[]' "$eval_file"); do
  echo "$changed" | grep -q "^$prefix" || fail "no changed file under $prefix"
done

for prefix in $(jq -r '.checks.files_unchanged // [] | .[]' "$eval_file"); do
  echo "$changed" | grep -q "^$prefix" && fail "protected path changed: $prefix"
done

while IFS= read -r s; do
  [ -n "$s" ] || continue
  grep -qF -- "$s" <<<"$result_text" || fail "output missing: $s"
done < <(jq -r '.checks.output_contains // [] | .[]' "$eval_file")

while IFS= read -r s; do
  [ -n "$s" ] || continue
  grep -qF -- "$s" <<<"$result_text" && fail "output contains forbidden: $s"
done < <(jq -r '.checks.output_not_contains // [] | .[]' "$eval_file")

echo "PASS [$name]"

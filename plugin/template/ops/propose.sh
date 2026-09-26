#!/usr/bin/env bash
# Closing the loop (Stage 6: Maintain), the propose step. Turns the intent.md that the agent wrote on a
# 3-sigma breach into a pull request. No model runs here. The agent committed nothing and, in the
# workflow, ran in a job with no token that can write to GitHub; this script is what commits, pushes and
# opens the PR, and it treats the file and the report as untrusted data.
#
#   ops/propose.sh REPORT DIR
#     REPORT  the detection report for this breach (JSON from ops/detect.py)
#     DIR     a folder that holds exactly one file, intent/<slug>/intent.md
#
# Needs git credentials that can push a branch, and gh credentials (GH_TOKEN or gh auth) that can open a PR.
set -euo pipefail
report=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
dir=$(cd "$2" && pwd)
root=$(cd "$(dirname "$0")/.." && pwd); cd "$root"

metric=$(jq -r .metric "$report"); rule=$(jq -r .rule "$report")
re_rule='^[A-Za-z0-9 -]+$'
if ! jq -e '.tier == 3' "$report" > /dev/null || ! [[ "$metric" =~ ^[A-Za-z0-9_.-]+$ ]] || ! [[ "$rule" =~ $re_rule ]]; then
  echo "$report is not a tier-3 report with the expected metric and rule; not proposing"; exit 1
fi

# One open proposal per metric. If the triage queue already holds one, do not add another.
# Pull requests from forks do not count, so an outside branch named loop/... cannot switch proposals off.
existing=$(gh pr list --state open --limit 500 --json number,url,headRefName,isCrossRepository \
  -q "[.[] | select((.isCrossRepository | not) and (.headRefName | startswith(\"loop/$metric-\")))][0] // empty | \"#\\(.number) \\(.url)\"")
if [ -n "$existing" ]; then
  echo "open proposal already in triage: $existing; not opening another"; exit 0
fi

# Exactly one regular file, at intent/<slug>/intent.md, small, new, and free of credentials.
files=$(cd "$dir" && find . -mindepth 1 ! -type d | sed 's|^\./||')
if [ "$(printf '%s\n' "$files" | grep -c .)" != 1 ] || ! [[ "$files" =~ ^intent/[a-z0-9][a-z0-9-]{0,79}/intent\.md$ ]]; then
  echo "expected exactly one file, intent/<slug>/intent.md, in $dir; found:"; printf '%s\n' "$files"; exit 1
fi
path=$files; src="$dir/$path"
if [ -L "$src" ] || [ ! -f "$src" ]; then echo "$path is not a regular file; not proposing"; exit 1; fi
if [ "$(wc -c < "$src")" -gt 65536 ]; then echo "$path is larger than 64 KB; not proposing"; exit 1; fi
# Reads the whole file (no -q), so pipefail cannot turn a match into a pass.
if grep -E 'sk-ant-[A-Za-z0-9_-]{10,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}' "$src" > /dev/null; then
  echo "$path contains something shaped like a credential; not proposing"; exit 1
fi
if git cat-file -e "HEAD:$path" 2>/dev/null; then
  echo "$path already exists; a proposal only adds a new intent"; exit 1
fi

ts=$(date -u +%Y%m%dT%H%M%SZ)
branch="loop/$metric-$ts"
start=$(git symbolic-ref -q --short HEAD || git rev-parse HEAD)
git switch -q -c "$branch"
trap 'git switch -q "$start" 2>/dev/null || git switch -q --detach "$start" 2>/dev/null || true' EXIT
mkdir -p "$(dirname "$path")"
cp "$src" "$path"
git add -- "$path"
# Hooks off.
git -c core.hooksPath=/dev/null commit -q -m "intent: $metric breached its control band ($ts)" -- "$path"
git push -q -u origin "$branch"
gh pr create --title "intent: $metric breached 3-sigma band ($ts)" --body-file - <<PR
## Change

Opened by \`ops/propose.sh\` after a deterministic 3-sigma breach of \`$metric\` ($rule).
Intent: \`$path\`, written by the agent in \`ops/loop.sh\` and committed here without changes. This PR is the triage queue: fix now, schedule, or dismiss. A dismissal should tune \`ops/bands.yaml\`.

## Detection report

\`\`\`json
$(jq . "$report")
\`\`\`

## Verification output

Not applicable: this PR adds an intent artifact only. The fix follows as its own change through spec, plan and review.

## Departures from plan.md

None; there is no plan yet.
PR
echo "proposal opened as a pull request from $branch"

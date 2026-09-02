#!/usr/bin/env bash
# Closing the loop (Stage 6: Maintain).
# Deterministic detection first; Claude is invoked only when a band is breached, and the tier
# from ops/bands.yaml decides what it may do. Every run is logged under ops/log/ (gitignored).
#
#   ops/loop.sh            run once against the repo's CI history
#   REPO=owner/name ops/loop.sh   run against another repo (needs gh auth)
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd); cd "$root"
log=ops/log; mkdir -p "$log"
ts=$(date -u +%Y%m%dT%H%M%SZ)
report="$log/$ts-detect.json"

set +e
.venv/bin/python ops/detect.py --quiet ${REPO:+--repo "$REPO"} > "$report"
tier=$?
set -e
if [ "$tier" -gt 3 ]; then echo "detection failed (exit $tier)"; cat "$report"; exit 1; fi

metric=$(jq -r .metric "$report"); action=$(jq -r .action "$report"); rule=$(jq -r .rule "$report")
tools=$(jq -r '.tools // ""' "$report")
printf '{"ts":"%s","metric":"%s","tier":%s,"rule":"%s","action":"%s","report":"%s"}\n' \
  "$ts" "$metric" "$tier" "$rule" "$action" "$report" >> "$log/detections.jsonl"
echo "$metric: tier $tier ($rule) -> $action"

case "$tier" in
  0|1)
    exit 0 ;;
  2)
    claude -p "The CI metric $metric has breached its 2-sigma control band. Detection report (deterministic, from ops/detect.py):
$(cat "$report")
Diagnose read-only: inspect the failed runs in the evidence with gh run view --log-failed, the commits behind them, and any PRs. Say what most likely caused the failures, whether they look flaky or real, and what a fix would involve. Do not change any file. Three short paragraphs at most." \
      --permission-mode default --allowedTools "$tools" --output-format text > "$log/$ts-diagnosis.md"
    echo "diagnosis written to $log/$ts-diagnosis.md" ;;
  3)
    branch="loop/$metric-$ts"
    git checkout -q -b "$branch"
    claude -p "The CI metric $metric has breached its 3-sigma control band. Detection report (deterministic, from ops/detect.py):
$(cat "$report")
First diagnose: inspect the failed runs in the evidence with gh run view --log-failed and the commits and PRs behind them. Then use the ai-native-sdlc intent skill to write intent/<slug>/intent.md in the Stage 1 format, where the Problem is the anomaly with its evidence (run ids, urls, branch, what failed), the Proposed outcome is the fix or quarantine you recommend, Affected users and systems names the tests and code involved, Constraints says the fix must go through the normal PR review gate, and Open questions carries anything a human must decide. Author: closing-the-loop (ops/detect.py), Status: draft, Record: none. Commit only that file on the current branch with a message starting 'intent:'. Non-interactive: do not ask questions." \
      --permission-mode acceptEdits \
      --allowedTools "Read,Write,Glob,Grep,Skill,Bash(gh run *),Bash(gh pr view *),Bash(git *),Bash(ls *),Bash(cat *)" \
      --output-format text > "$log/$ts-propose.md"
    intent_file=$(git diff --name-only main..HEAD | grep '^intent/.*/intent.md$' || true)
    if [ -z "$intent_file" ]; then
      echo "no intent.md was committed; see $log/$ts-propose.md"; git checkout -q main; exit 1
    fi
    git push -q -u origin "$branch"
    gh pr create --title "intent: $metric breached 3-sigma band ($ts)" --body-file - <<PR
## Change

Opened by \`ops/loop.sh\` after a deterministic 3-sigma breach of \`$metric\` ($rule).
Intent: \`$intent_file\`. This PR is the triage queue: fix now, schedule, or dismiss. A dismissal should tune \`ops/bands.yaml\`.

## Detection report

\`\`\`json
$(cat "$report")
\`\`\`

## Verification output

Not applicable: this PR adds an intent artifact only. The fix follows as its own change through spec, plan and review.

## Departures from plan.md

None; there is no plan yet.
PR
    git checkout -q main
    echo "proposal opened as a pull request; transcript at $log/$ts-propose.md" ;;
esac

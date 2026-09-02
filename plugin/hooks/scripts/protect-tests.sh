#!/bin/bash
# protect-tests.sh — PreToolUse hook on Write|Edit.
# While a fix task is active, block edits to test files so the agent fixing
# code cannot weaken the check on that code. (Playbook, Stage 4: Test.)
#
# A fix task is active when either:
#   - ${CLAUDE_PROJECT_DIR:-.}/.claude/fix-task exists   (touch to start, rm to finish)
#   - CLAUDE_FIX_TASK=1 is set in the environment
#
# Exit 2 blocks the action and sends the message on stderr to Claude.
set -u

root="${CLAUDE_PROJECT_DIR:-.}"
if [ "${CLAUDE_FIX_TASK:-0}" != "1" ] && [ ! -e "$root/.claude/fix-task" ]; then
  exit 0
fi

input=$(cat)
path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)
[ -z "$path" ] && exit 0

base=$(basename "$path")
is_test=0
case "$base" in
  test_*.py|*_test.py|*_test.go|*.test.*|*.spec.*|conftest.py) is_test=1 ;;
esac
case "$path" in
  */test/*|*/tests/*|*/__tests__/*|*/spec/*|test/*|tests/*|__tests__/*|spec/*) is_test=1 ;;
esac

if [ "$is_test" = "1" ]; then
  cat >&2 <<MSG
Blocked: a fix task is active and '$path' is a test file.
During a fix the test is the proof the bug is gone, so the agent may not edit it.
Fix the code, not the test. If the test itself is wrong, stop and tell the engineer;
they can lift the guard with 'rm $root/.claude/fix-task' (or unset CLAUDE_FIX_TASK).
MSG
  exit 2
fi
exit 0

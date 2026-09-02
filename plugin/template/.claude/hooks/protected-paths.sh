#!/bin/bash
# Block edits to protected paths. PreToolUse hook on Write|Edit.
# Globs come from .claude/protected-paths, one per line, relative to the repo root. Lines starting with # are ignored.
# Exit 2 blocks the action and sends the reason to Claude.
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
list="$root/.claude/protected-paths"
[ -f "$list" ] || exit 0

path=$(jq -r '.tool_input.file_path // empty' < /dev/stdin)
[ -n "$path" ] || exit 0
rel="${path#$root/}"

# In [[ ... == pattern ]] a "*" matches across "/" so "**" needs no globstar (bash 3.2 on macOS lacks it).
while IFS= read -r pattern || [ -n "$pattern" ]; do
  pattern="${pattern%%#*}"; pattern="${pattern## }"; pattern="${pattern%% }"
  [ -n "$pattern" ] || continue
  # shellcheck disable=SC2053
  if [[ "$rel" == $pattern || "$path" == $pattern ]]; then
    echo "Blocked: '$rel' matches protected path '$pattern' (see .claude/protected-paths). Changes here need a change ticket and a code owner; ask the tech lead rather than editing directly." >&2
    exit 2
  fi
done < "$list"
exit 0

#!/bin/bash
# Block edits to protected paths. PreToolUse hook on Write|Edit.
# Globs come from .claude/protected-paths, one per line, relative to the repo root. Lines starting with # are ignored.
# Exit 2 blocks the action and sends the reason to Claude.
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
list="$root/.claude/protected-paths"
[ -f "$list" ] || exit 0

# Read the hook payload with $(cat), never '< /dev/stdin': on Linux, opening /dev/stdin when fd 0 is a socket
# fails, jq sees nothing, and the hook silently allows the action. Found by the sandbox's evals in CI.
input=$(cat)

# Fail closed: an edit this hook cannot read is blocked, never waved through.
if ! command -v jq >/dev/null 2>&1; then
  echo "Blocked: protected-paths.sh needs jq to read which file this edit changes, and jq is not installed. Tell the engineer: install jq (brew install jq, or apt-get install jq), then retry." >&2
  exit 2
fi
path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // .tool_input.path // empty' 2>/dev/null)
if [ -z "$path" ]; then
  echo "Blocked: protected-paths.sh could not read which file this edit changes, so it cannot check it against .claude/protected-paths. Tell the engineer which tool made the edit." >&2
  exit 2
fi
rel="${path#"$root"/}"

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

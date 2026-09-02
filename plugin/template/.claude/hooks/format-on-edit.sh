#!/bin/bash
# Run the formatter on the file that just changed. PostToolUse hook on Write|Edit.
# Keep this fast and scoped to one file; the full lint belongs at commit or PR.
# Replace the detection below with your project's formatter.
# Read the hook payload with $(cat), never '< /dev/stdin': on Linux, opening /dev/stdin when fd 0 is a socket
# fails, jq sees nothing, and the hook silently allows the action. Found by the sandbox's evals in CI.
input=$(cat)
path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
[ -n "$path" ] && [ -f "$path" ] || exit 0

if [ -f Makefile ] && grep -qE '^fmt-file:' Makefile; then
  make -s fmt-file FILE="$path" >/dev/null 2>&1 || true
elif command -v prettier >/dev/null 2>&1 && [[ "$path" =~ \.(ts|tsx|js|jsx|json|md|yaml|yml)$ ]]; then
  prettier --write "$path" >/dev/null 2>&1 || true
elif command -v black >/dev/null 2>&1 && [[ "$path" == *.py ]]; then
  black -q "$path" >/dev/null 2>&1 || true
elif command -v gofmt >/dev/null 2>&1 && [[ "$path" == *.go ]]; then
  gofmt -w "$path" >/dev/null 2>&1 || true
fi
exit 0

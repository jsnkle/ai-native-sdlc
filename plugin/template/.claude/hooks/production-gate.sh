#!/bin/bash
# Production deploys require a named release authorization.
# PreToolUse hook on Bash. Exit 2 blocks the action; the message on stderr goes to Claude.
# Read the hook payload with $(cat), never '< /dev/stdin': on Linux, opening /dev/stdin when fd 0 is a socket
# fails, jq sees nothing, and the hook silently allows the action. Found by the sandbox's evals in CI.
input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
if [[ "$cmd" == *"deploy"* && "$cmd" == *"production"* ]]; then
  if [ -z "$RELEASE_APPROVAL" ]; then
    echo "Production deploys need a release authorization. Ask the release manager to set RELEASE_APPROVAL=<change-ticket-id> for this session, then retry." >&2
    exit 2
  fi
  echo "Production deploy authorized by RELEASE_APPROVAL=$RELEASE_APPROVAL" >&2
fi
exit 0

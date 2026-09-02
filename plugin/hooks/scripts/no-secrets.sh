#!/bin/bash
# no-secrets.sh — PreToolUse hook on Write|Edit.
# Keep credentials out of the diff: scan only the content about to be written
# for obvious secret shapes. Fast, scoped to the one file. (Playbook, Stage 3:
# Build, hooks as build-time guardrails.)
#
# Exit 2 blocks the action and sends the message on stderr to Claude.
set -u

input=$(cat)
path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)
# Write sends .content; Edit sends .new_string.
content=$(printf '%s' "$input" | jq -r '.tool_input.content // .tool_input.new_string // empty' 2>/dev/null)
[ -z "$content" ] && exit 0

# Example/fixture files that legitimately hold fake keys can opt out by name.
case "$path" in
  *.example|*.sample|*/fixtures/*|*/testdata/*) exit 0 ;;
esac

hit=""
if printf '%s' "$content" | grep -Eq 'AKIA[0-9A-Z]{16}'; then
  hit="AWS access key id (AKIA...)"
elif printf '%s' "$content" | grep -Eq -- '-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----'; then
  hit="private key block"
elif printf '%s' "$content" | grep -Eq '\bsk-(ant-)?[A-Za-z0-9_-]{16,}'; then
  hit="sk- style API token"
elif printf '%s' "$content" | grep -Eq '\bgh[pousr]_[A-Za-z0-9]{30,}'; then
  hit="GitHub token"
elif printf '%s' "$content" | grep -Eiq '(password|passwd|secret|api[_-]?key|token)[[:space:]]*[=:][[:space:]]*["'"'"']?[A-Za-z0-9/+_.@#-]{8,}["'"'"']?'; then
  # Ignore obvious placeholders and env lookups.
  if ! printf '%s' "$content" | grep -Eiq '(password|passwd|secret|api[_-]?key|token)[[:space:]]*[=:][[:space:]]*["'"'"']?(\$\{?[A-Z_]+|<[^>]*>|xxx+|changeme|placeholder|your[_-]|example|os\.environ|process\.env|getenv)'; then
    hit="literal credential assignment (password=/secret=/api_key=/token=)"
  fi
fi

if [ -n "$hit" ]; then
  cat >&2 <<MSG
Blocked: the content for '${path:-<unknown>}' looks like it contains a credential ($hit).
Secrets never go in the diff. Read them from the environment or a secrets manager,
reference a placeholder in a .example file, or ask the engineer how this project
injects credentials. If this is a fake value in a test fixture, put it under a
fixtures/ or testdata/ directory or name the file *.example.
MSG
  exit 2
fi
exit 0

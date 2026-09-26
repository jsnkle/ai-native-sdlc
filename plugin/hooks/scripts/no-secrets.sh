#!/bin/bash
# no-secrets.sh — PreToolUse hook on Write|Edit.
# Keep credentials out of the diff: scan only the content about to be written
# for obvious secret shapes. Fast, scoped to the one file. (Playbook, Stage 3:
# Build, hooks as build-time guardrails.)
#
# Exit 2 blocks the action and sends the message on stderr to Claude.
set -u

input=$(cat)

# Fail closed: an edit this hook cannot read is blocked, never waved through.
if ! command -v jq >/dev/null 2>&1; then
  cat >&2 <<MSG
Blocked: no-secrets.sh needs jq to read this edit, and jq is not installed,
so the edit cannot be checked for credentials. Tell the engineer: install jq
(brew install jq, or apt-get install jq), then retry.
MSG
  exit 2
fi
path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // .tool_input.path // empty' 2>/dev/null)
# The new text: Write sends .content, Edit .new_string, MultiEdit .edits[].new_string, NotebookEdit .new_source.
# jq fails when none of them is there.
if ! content=$(printf '%s' "$input" | jq -r '.tool_input
    | [.content, .new_string, .new_source, (.edits // [] | .[]? | .new_string)]
    | map(select(type == "string"))
    | if length == 0 then error("no new text") else join("\n") end' 2>/dev/null); then
  cat >&2 <<MSG
Blocked: no-secrets.sh could not read the new text of this edit to '${path:-<unknown>}',
so it cannot be checked for credentials. Tell the engineer which tool made the edit.
MSG
  exit 2
fi
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
# Ignore obvious placeholders and env lookups, judging each assignment on its own value: a placeholder
# elsewhere in the file must not excuse a literal one.
elif printf '%s' "$content" \
    | grep -Eio '(password|passwd|secret|api[_-]?key|token)[[:space:]]*[=:][[:space:]]*["'"'"']?[A-Za-z0-9/+_.@#-]{8,}["'"'"']?' \
    | grep -Eivq '(password|passwd|secret|api[_-]?key|token)[[:space:]]*[=:][[:space:]]*["'"'"']?(\$\{?[A-Z_]+|<[^>]*>|xxx+|changeme|placeholder|your[_-]|example|os\.environ|process\.env|getenv)'; then
  hit="literal credential assignment (password=/secret=/api_key=/token=)"
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

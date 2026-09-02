# Hooks as build-time guardrails

Stage 3, Build. A skill is an advisory control. A hook is the deterministic layer behind it. Most of what Claude does during implementation is file edits and shell commands, so build is where hooks fire most often.

## What changes

**Traditional.** Protected paths, formatting, and "never commit a secret" are conventions enforced by habit, by a linter someone remembers to run, or by a reviewer who notices. They drift.

**AI-native.** A hook is a script that runs before or after an action Claude takes and can allow it, block it, or ask. It runs on every matching action, for every session, with no one watching. Build-phase hooks block edits to protected paths, run the formatter and linter after edits so drift never accumulates, and keep credentials out of the diff.

## Who runs it

The platform engineer, or the tech lead for a single repo. Engineers do not write their own guardrails; they inherit them from the repo.

## Prerequisites

None.

## Infrastructure

Claude Code, and the hooks configuration in the repo's `.claude/settings.json` or the plugin's `hooks/hooks.json`.

## How to execute it

1. List what must never happen during implementation: edits to generated classes, edits to a frozen package, a credential landing in a file, an unformatted file being saved.
2. Write each as a hook script that reads the tool input from stdin, decides, and exits 0 to allow or 2 to block with a reason on stderr. A block should explain itself: the reason and the route to approval appear in Claude's output.
3. Back any skill whose policy must hold without exception with a hook. The skill applies the policy; the hook makes it impossible to skip.
4. Keep hooks fast and scoped to the file that changed. A hook runs on each action that matches it. Heavier checks like the full test suite belong at the commit or the PR.
5. Do not put approval prompts here. A hook that asks a human belongs with the gates in [deploy-approval-gates.md](deploy-approval-gates.md); an approval prompt during build puts a person back on the critical path of every parallel session.

## What it looks like

Two generic hooks ship in the plugin at `plugin/hooks/`: one that blocks edits to test files while a fix task is in progress ([test-feedback-loop.md](test-feedback-loop.md)), and one that keeps secrets out of the diff. Repo-specific guardrails go in `plugin/template/.claude/hooks/protected-paths.sh`, wired in `plugin/template/.claude/settings.json`:

```json
{ "hooks": { "PreToolUse": [ { "matcher": "Write|Edit",
  "hooks": [ { "type": "command",
    "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/protected-paths.sh" } ] } ] } }
```

**Two things the sandbox taught about writing hooks.** Read the payload with `input=$(cat)` and pipe it to `jq`, not `jq < /dev/stdin`: on a Linux runner the latter can see no input, so the hook exits 0 and silently allows the action, while every test on a Mac passes. And on workspace trust: the hooks reference says project hooks run after the trust dialog is accepted, but a non-interactive `claude -p` run on a fresh CI runner invoked the project hooks without any trust entry, which we verified with an invocation log. What trust does gate there is the project's `permissions.allow` list, which is why CI runs pass `--allowedTools` explicitly. Plugin hooks run regardless of trust.

## Governance

Hooks apply to every session that runs against the repo, so controls scale with the number of sessions without adding reviewers. Team hooks live in `.claude/settings.json` in git and are reviewed like code. Non-negotiable hooks go in managed settings owned by the platform team (`org/`), where individual engineers cannot switch them off. Every allow and block decision is logged with a timestamp.

## How to measure it

- **Leading.** Block rate per hook over time, from the hook logs or the OpenTelemetry export. A hook that never fires may be redundant; one that fires constantly may mean the skill in front of it is not triggering.
- **Lagging.** Review findings and incidents in the category the hook guards, which should fall to zero for that category.

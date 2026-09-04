# ai-native-sdlc plugin

The shared, versioned half of the AI-native SDLC. Every project installs this
plugin instead of copying skills, agents and hooks into its own `.claude/`
folder, so a policy change ships to all projects on the next session.

The per-repo half (CLAUDE.md, REVIEW.md, `intent/`, `.claude/settings.json`,
project hooks, CI workflows, the eval suite, and the `ops/` detector, loop and
bands) is copied from [`template/`](template/) and customised per project. The
template lives inside the plugin because installing a plugin copies only the
plugin directory; that is how the `adopt` skill finds it in any project.

## Install

```sh
# once per machine: register the marketplace served from this repo
claude plugin marketplace add jsnkle/ai-native-sdlc

# per project (or user-wide)
claude plugin install ai-native-sdlc@jsnkle
```

Or declare it in the project's `.claude/settings.json` (the template does this)
so anyone cloning the repo gets it on first launch.

## What's inside

Every user-facing entry point is a skill. Each one can be invoked by name as
`/ai-native-sdlc:<name>` and also triggers on its description when the task
comes up in conversation.

| Piece | Path | Play it implements |
|---|---|---|
| Skill `intent` | `skills/intent/` | [Plan: capture as intent.md](../docs/plays/plan-intent.md) |
| Skill `spec` | `skills/spec/` | [Design: requirements and design](../docs/plays/design-spec.md) |
| Skill `plan` | `skills/plan/` | [Build: plan mode as the default](../docs/plays/build-plan-mode.md) |
| Skill `babysit-pr` | `skills/babysit-pr/` | [Deploy: AI in the PR review loop](../docs/plays/deploy-pr-review.md) |
| Skill `adopt` | `skills/adopt/` | [Brownfield runbook](../brownfield/README.md), the mechanical half |
| Skill `secure-api-review` | `skills/secure-api-review/` | [Build: skills as institutional knowledge](../docs/plays/build-skills.md). The playbook's example policy skill; replace it with your own and name its owner |
| Agent `verifier` | `agents/verifier.md` | [Build: parallel sessions and subagents](../docs/plays/build-parallel-sessions.md), [Test: feedback loop](../docs/plays/test-feedback-loop.md). Runs the app and checks the change in fresh context before the session reports done |
| Agent `simplifier` | `agents/simplifier.md` | Build: parallel sessions and subagents. Strips needless complexity after a change without altering behaviour |
| Agent `researcher` | `agents/researcher.md` | Build: parallel sessions and subagents. Read-only codebase exploration that reports back concisely |
| Hook `protect-tests.sh` | `hooks/scripts/` | [Test: feedback loop](../docs/plays/test-feedback-loop.md), the fix-task guard |
| Hook `no-secrets.sh` | `hooks/scripts/` | [Build: hooks as guardrails](../docs/plays/build-hooks-guardrails.md) |
| Reference | `references/artifact-formats.md` | The artifact chain in one page |
| Template | `template/` | The per-repo files; see [`template/README.md`](template/README.md) |

## Hooks

Both hooks run on `PreToolUse` for `Write` and `Edit`. They are fast and scoped
to the single file being written, and they exit 2 with an explanation Claude
can act on.

- **protect-tests.sh** blocks edits to test files while a fix task is active.
  A fix task is active when `.claude/fix-task` exists in the project root or
  `CLAUDE_FIX_TASK=1` is set. Start a fix with `touch .claude/fix-task`, finish
  with `rm .claude/fix-task`. Hooks that must hold without exception belong in
  managed settings; see [`org/`](../org/).
- **no-secrets.sh** blocks writes whose content matches obvious credential
  shapes: AWS access key ids, private key blocks, `sk-` API tokens, GitHub
  tokens, and literal `password=`, `secret=`, `api_key=` or `token=`
  assignments that are not placeholders or environment lookups. Files named
  `*.example` or `*.sample`, and anything under `fixtures/` or `testdata/`,
  are exempt so test fixtures can hold fake values.

Both read their payload with `$(cat)`. Reading `< /dev/stdin` looks identical
on a Mac and silently fails open on a Linux runner; the template's evals in CI
are what caught it.

## Non-interactive use

The template's CI workflows run these skills through `claude -p`, and each
skill has a rule for the parts that need a human:

- **intent** says so when it cannot take answers, writes the draft with every
  guess marked as an assumption, and ends with the numbered questions it would
  have asked, for the originator to answer on resume.
- **plan** writes `plan.md` after the plan is accepted in an interactive
  session. Without an acceptance step it writes the file directly and says at
  the top that it was produced without review.
- **adopt** emits its hook step as a patch when writes under `.claude/` are
  refused, with the `git apply` line to finish by hand.

A `claude -p` run never sees the project's `permissions.allow` list, so the
template's workflows and its `ops/loop.sh` pass `--allowedTools` themselves.

## Versioning

Bump `version` in `.claude-plugin/plugin.json` and the root
`.claude-plugin/marketplace.json` together, and record the change in the root
`CHANGELOG.md`. Projects pick up the new version on their next
`claude plugin update`. Skill and hook changes go through PR review like code,
and the template's eval workflow re-runs whenever CLAUDE.md, REVIEW.md,
`.claude/` or the eval cases change.

## Why there is no `commands/` directory

Claude Code puts commands and skills in one namespace, so a `commands/adopt.md`
next to `skills/adopt/` produced two `/ai-native-sdlc:adopt` entries and the
command won, without the skill body. Every user-facing entry point is therefore
a skill with an `argument-hint`.

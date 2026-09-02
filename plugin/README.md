# ai-native-sdlc plugin

The shared, versioned half of the AI-native SDLC. Every project installs this
plugin instead of copying skills, agents and hooks into its own `.claude/`
folder, so a policy change ships to all projects on the next session.

The per-repo half (CLAUDE.md, REVIEW.md, `intent/`, `.claude/settings.json`,
project hooks, CI workflows, evals, `ops/bands.yaml`) is copied from
[`plugin/template/`](../plugin/template/) and customised per project.

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

| Piece | Path | Play it implements |
|---|---|---|
| Skill `intent` | `skills/intent/` | [Plan: capture as intent.md](../docs/plays/plan-intent.md) |
| Skill `spec` | `skills/spec/` | [Design: requirements and design](../docs/plays/design-spec.md) |
| Skill `plan` | `skills/plan/` | [Build: plan mode as the default](../docs/plays/build-plan-mode.md) |
| Skill `adopt` | `skills/adopt/` | [Brownfield runbook](../brownfield/README.md), mechanical half |
| Skill `secure-api-review` | `skills/secure-api-review/` | [Build: skills as institutional knowledge](../docs/plays/build-skills.md) (example policy, replace it) |
| Agent `verifier` | `agents/verifier.md` | [Build: parallel sessions and subagents](../docs/plays/build-parallel-sessions.md), [Test: feedback loop](../docs/plays/test-feedback-loop.md) |
| Agent `simplifier` | `agents/simplifier.md` | Build: parallel sessions and subagents |
| Agent `researcher` | `agents/researcher.md` | Build: parallel sessions and subagents |
| `/ai-native-sdlc:intent` | `skills/intent/` | Plan |
| `/ai-native-sdlc:spec` | `skills/spec/` | Design |
| `/ai-native-sdlc:plan` | `skills/plan/` | Build |
| `/ai-native-sdlc:babysit-pr` | `skills/babysit-pr/` | [Deploy: AI in the PR review loop](../docs/plays/deploy-pr-review.md) |
| `/ai-native-sdlc:adopt` | `skills/adopt/` | Brownfield |
| Hook `protect-tests.sh` | `hooks/scripts/` | [Test: feedback loop](../docs/plays/test-feedback-loop.md), the fix-task guard |
| Hook `no-secrets.sh` | `hooks/scripts/` | [Build: hooks as guardrails](../docs/plays/build-hooks-guardrails.md) |
| Reference | `references/artifact-formats.md` | The artifact chain in one page |

## Hooks

Both hooks run on `PreToolUse` for `Write` and `Edit`. They are fast and scoped
to the single file being written.

- **protect-tests.sh** blocks edits to test files while a fix task is active.
  A fix task is active when `.claude/fix-task` exists in the project root or
  `CLAUDE_FIX_TASK=1` is set. Start a fix with `touch .claude/fix-task`, finish
  with `rm .claude/fix-task`. Hooks that must hold without exception belong in
  managed settings; see [`org/`](../org/).
- **no-secrets.sh** blocks writes whose content matches obvious credential
  shapes (AWS access keys, private key blocks, `sk-` API tokens, literal
  `password=` assignments). It explains what matched and how to proceed.

## Versioning

Bump `version` in `.claude-plugin/plugin.json` and the root
`.claude-plugin/marketplace.json` together. Projects pick up the new version on
their next `claude plugin update`. Skill and hook changes go through PR review
like code, and the eval workflow in the template re-runs on any change under
`.claude/`.

## Why there is no `commands/` directory

Claude Code puts commands and skills in one namespace, so a `commands/adopt.md` next to `skills/adopt/` produced two `/ai-native-sdlc:adopt` entries and the command won, without the skill body. Every user-facing entry point is therefore a skill with an `argument-hint`, invoked as `/ai-native-sdlc:<name>`; the same skill also triggers on its description when the task comes up in conversation.

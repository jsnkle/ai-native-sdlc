# Brownfield: adopting the AI-native SDLC in an existing repo

Brownfield is not a different process. It is the same plays, adopted in dependency order, into a repo that already has habits, records and controls. The plugin does the mechanical work through `/ai-native-sdlc:adopt`; this runbook is what the humans decide and check.

## Before you start

1. Run through `assessment.md` with the engineer who knows the codebase best.
2. Record the five decisions at the bottom of it. The source-of-truth decision matters most: existing trackers stay because auditors accept them, so name one system per artifact as authoritative and link the rest.
3. Confirm who plays each role: product owner (accepts intent and spec), engineer (accepts plan), tech lead (owns `CLAUDE.md`, `REVIEW.md`, higher-risk gates), platform engineer (CI, hooks, managed settings).

## Phase 0: install the plugin

- **Add:** in the target repo, `/plugin marketplace add jsnkle/ai-native-sdlc` then `/plugin install ai-native-sdlc@jsnkle`. Or copy `plugin/template/.claude/settings.json`, which declares the marketplace and enables the plugin for everyone who opens the repo.
- **Who:** any engineer.
- **Run:** `/ai-native-sdlc:adopt`. It assesses the repo and offers the phase 1 files.
- **Worked when:** `/ai-native-sdlc:intent` appears in the command list for every team member.

## Phase 1: the foundation

Plays: the CLAUDE.md, give Claude a feedback loop, capture as intent.md. None has prerequisites.

- **Add:** `CLAUDE.md` (run `/init`, then cut to one page using `plugin/template/CLAUDE.md` as the shape), `intent/README.md`, and the single-command build/test/lint targets the assessment found missing.
- **Who:** tech lead for `CLAUDE.md`; product owner picks the intent home and decides who may write to it; a technical team member sets up the version-control connector so non-engineers can commit from claude.ai or Cowork.
- **Run:** `/ai-native-sdlc:adopt` copies the files that don't exist yet and skips the ones that do. Then write the first `intent.md` for a real, small change with `/ai-native-sdlc:intent`.
- **Worked when:** time from first conversation to committed `intent.md` is hours, not weeks. Claude stops repeating a mistake `CLAUDE.md` should have caught.

## Phase 2: plan before code, review every PR

Plays: plan mode as the default, requirements and design, AI in the PR review loop, skills as institutional knowledge.

- **Add:** `REVIEW.md`, `.github/CODEOWNERS`, `.github/pull_request_template.md`. Enable the managed Code Review service on the repo, or `claude-code-action` in CI. Write the first policy skill from a policy with a named owner (`plugin/skills/secure-api-review` is the shape).
- **Who:** tech lead writes `REVIEW.md` and sets the human threshold; product owner runs `/ai-native-sdlc:spec` on the accepted intent; engineers start every session in plan mode with `/ai-native-sdlc:plan` and commit `plan.md`.
- **Run:** the phase 1 change through spec, plan and PR end to end.
- **Worked when:** intent-to-spec time falls to a day; time to first review falls to minutes; share of changes merging from the first implementation pass rises.

## Phase 3: guardrails

Plays: hooks as build-time guardrails, parallel sessions and subagents.

- **Add:** `.claude/settings.json` hooks block, `.claude/hooks/protected-paths.sh`, `.claude/protected-paths`, `.claude/hooks/format-on-edit.sh`. Tune `permissions.allow` so sessions stop waiting on prompts for safe commands.
- **Who:** platform engineer or tech lead. Any skill whose policy must hold without exception gets a hook behind it.
- **Run:** two parallel sessions in worktrees on independent tasks from one plan. Use the plugin's `verifier` agent before reporting done.
- **Worked when:** review findings citing a policy fall toward zero; concurrent sessions per engineer rises while review quality holds.

## Phase 4: gates and pipeline

Plays: continuous evals, hooks as approval gates, CI/CD integration.

- **Add:** `evals/` with 20 to 50 real tasks, `.github/workflows/agent-evals.yml`, `.claude/hooks/production-gate.sh`, `.github/workflows/triage-failed-build.yml`, then `spec-on-intent-merge.yml`. Decide the model access route (API, Bedrock, Vertex, Foundry) and the sandbox profile for agent jobs.
- **Who:** engineering leadership with change management lists the human gates that must survive; platform engineer expresses each as a hook, with non-negotiable ones in managed settings (see `org/`). Rollback becomes the most rehearsed path.
- **Run:** a configuration change (edit `CLAUDE.md`) through the eval gate. A dry production deploy that the hook blocks, then authorizes.
- **Worked when:** first-pass CI success rate for agent-written changes rises; wait time per approval gate is visible; pipeline failures triaged without paging a human.

## Phase 5: close the loop

Plays: maintenance and closing the loop, recurring codebase scans, Claude on call.

- **Add:** `ops/bands.yaml` and a detection script for one metric; a scheduled workflow or webhook to invoke `claude -p` at the 2σ and 3σ tiers. Connect the repo to Claude Security on a weekly schedule. Add Claude Tag to the incident channel.
- **Who:** service owner picks the metric and triages the queue; security lead owns scan findings.
- **Run:** a synthetic breach end to end: the agent writes `intent.md`, the queue is triaged, the fix ships through the review gate, an eval is added.
- **Worked when:** time from breach to `intent.md` in the queue is minutes; repeat incidents of the same class fall.

## Coexisting with what is already there

- Keep the legacy record as the audit system if auditors expect it. Put the record ID in every artifact and the commit SHA in every record.
- Do not remove an existing human gate until its hook equivalent has run for a while and the wait time per gate is visible.
- Existing static analysis and dependency scanning stay in CI. The model-driven review and scans cover what those are not built to find.

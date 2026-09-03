# The AI-native SDLC handbook

This handbook explains the process to the humans who run it. It is adapted from Anthropic's *AI-Native SDLC playbook* (August 2026) and tailored to the plugin and template in this repo. Nothing here is required reading for Claude; the agent reads `CLAUDE.md`, the skills in `plugin/`, and the files in `intent/`.

## What is here

| File | One line |
|---|---|
| [00-why.md](00-why.md) | Why the process has to change once code is no longer the bottleneck. |
| [01-artifact-chain.md](01-artifact-chain.md) | The loop of committed artifacts (intent, spec, plan, diff, PR, incident) and who approves each one. |
| [02-adoption-order.md](02-adoption-order.md) | The dependency graph between plays, the maturity ladder, and what greenfield and brownfield mean. |
| [plays/](plays/README.md) | One page per play: what changes, who runs it, how to execute it, governance, how to measure it. |
| [roles/](roles/README.md) | What each role owns, approves, and never does. |
| [source-of-truth.md](source-of-truth.md) | Repo versus Jira: deciding where each artifact's authoritative record lives. |
| [metrics.md](metrics.md) | Every leading and lagging indicator in one table. |

## Reading order by audience

**Product owner** (you write and approve intent and spec; you never touch code)
1. [00-why.md](00-why.md)
2. [01-artifact-chain.md](01-artifact-chain.md)
3. [roles/product-owner.md](roles/product-owner.md)
4. [plays/plan-intent.md](plays/plan-intent.md) and [plays/design-spec.md](plays/design-spec.md)
5. [source-of-truth.md](source-of-truth.md), because you decide where intent lives relative to Jira.

**Engineer** (you plan, build, and verify inside Claude Code)
1. [01-artifact-chain.md](01-artifact-chain.md)
2. [roles/engineer.md](roles/engineer.md)
3. [plays/build-plan-mode.md](plays/build-plan-mode.md), [plays/build-claude-md.md](plays/build-claude-md.md), [plays/test-feedback-loop.md](plays/test-feedback-loop.md)
4. [plays/build-parallel-sessions.md](plays/build-parallel-sessions.md) once the first three are habit.
5. [plays/deploy-pr-review.md](plays/deploy-pr-review.md), so you know what the reviewer will check your diff against.

**Tech lead and platform engineer** (you own the controls: skills, hooks, review policy, pipeline, managed settings)
1. [00-why.md](00-why.md) and [02-adoption-order.md](02-adoption-order.md)
2. [roles/tech-lead.md](roles/tech-lead.md) and [roles/platform-engineer.md](roles/platform-engineer.md)
3. Every play in [plays/](plays/README.md), in the order given by the dependency graph.
4. [metrics.md](metrics.md), because you report on whether it is working.
5. `../brownfield/README.md` if you are adopting this into an existing repo, `../org/` for the settings that live outside any repo.
- [Retrospective, 2026-09-03](retrospective-2026-09-03.md) — lessons from proving the kit on a sandbox, and a play-by-play score against the article

# Continuous evals in CI

Stage 4, Test. The configuration that steers the agent gets regression-tested like the code it writes.

## What changes

**Traditional.** QA is a gate at a stage boundary. A change to the process, a new tool, a new reviewer, is not tested at all; you find out it regressed when the defects show up.

**AI-native.** Evals are the equivalent of stage-gate QA for the agent's configuration. A suite of real tasks with defined acceptance runs whenever `CLAUDE.md`, a skill, or a hook changes, and on a schedule. When a new model is swapped in or a prompt is rewritten, the suite says whether the agent still does the work to the same standard.

The suite is live. As models improve, cases that once discriminated stop doing so and new ones are added from ongoing monitoring. Some teams run evals offline on a cadence rather than on every change; the steps below are for the continuous version.

## Who runs it

The platform engineer builds and owns the suite. The team that owned an incident writes the eval for it.

## Prerequisites

`CLAUDE.md` ([build-claude-md.md](build-claude-md.md)) and the feedback loop ([test-feedback-loop.md](test-feedback-loop.md)).

## Infrastructure

CI that can run Claude Code non-interactively, and an API key with budget for eval runs.

## How to execute it

1. Collect twenty to fifty real tasks from recent work, each with its expected or accepted outcome.
2. Write each as an eval: the prompt plus the checks that define acceptable (tests pass, lint clean, behavior unchanged, policy followed).
3. Run the suite non-interactively in CI on a schedule and on any change to `CLAUDE.md`, skills, or hooks.
4. Gate configuration changes on the results. A skill change that drops the pass rate gets reviewed before it merges.
5. Each production incident gets an eval, written by the team that owned it, and stays in the suite as a regression test.

## What it looks like

`plugin/template/evals/` holds a `check.sh`, one example eval, and a README on the eval file format. `plugin/template/.github/workflows/agent-evals.yml` is the article's workflow: it triggers on pull requests that touch `CLAUDE.md` or `.claude/**` and nightly, installs Claude Code, and loops over `evals/*.json` running `claude -p` with a restricted tool list.

## Governance

Evals give QA a gate that keeps up with agent output. The pass-rate threshold is enforced as a merge check. Runs are logged so results can be compared over time. The team that owns the configuration change approves it.

## How to measure it

- **Leading.** Eval pass rate over time, reported by the suite on every run, and how long a production incident takes to become a permanent eval.
- **Lagging.** Regressions caught in CI compared with regressions found in production, from the incident tracker.

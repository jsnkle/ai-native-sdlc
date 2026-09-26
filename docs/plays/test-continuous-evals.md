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

## Ready, not adopted

**Judge what the agent's report means instead of matching strings in it.** `output_contains` and `output_not_contains` look for exact substrings in the agent's final text. They stand in for questions about meaning: did it say the tests passed, did it say it skipped a test. This is predicted, not observed. No string check has misfired in a run, and the two cases the sandbox's first run found broken failed for other reasons. The risk is easy to construct, though. The template README's example, `"output_not_contains": ["skip"]`, fails an agent that reports "no tests were skipped". The sandbox's protected-paths eval requires the word "protected", so it fails an agent that says "the hook blocked the edit".

The proposal is an `output_judgments` field beside the two string checks. Each entry is a yes/no question about the report, such as "Does the report say that a test was skipped, deleted or weakened?", with the answer it must have. A decision model answers it with the task prompt and the final text as input: [TypeSafe](https://docs.typesafe.ai)'s Jev, asked a Noul question, returns the probability of yes rather than text. `check.sh` passes above one threshold, fails below another, and prints anything in between as uncertain for a person to read, rather than calling it either way. The commands and file checks stay in code, because they check facts, not meaning. Claude with a JSON schema could answer the same questions. The reasons to prefer a decision model are a probability to set thresholds on, no text to parse, and a grader that is not the model being graded.

If it is adopted:

- Pin the model version (`jev-1.13.0`, not `jev-latest`). The suite exists to catch changes in the configuration, and a grader that changes underneath it would look like one.
- Make it opt-in. Without `TYPESAFE_API_KEY` the field is skipped with a notice, and the string checks run as they do today. Adopting it adds a second vendor and a CI secret to every project and sends the agent's report to that vendor, which is a data-handling decision for any company fork.
- Set the thresholds from the suite's own past results.
- Adopt it when a string check passes or fails a report whose meaning says otherwise.

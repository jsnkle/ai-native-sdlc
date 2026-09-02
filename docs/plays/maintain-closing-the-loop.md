# Closing the loop

Stage 6, Maintain. A trigger invokes Claude with no person in the invocation path, and what it finds re-enters the pipeline as `intent.md`.

## What changes

**Traditional.** Maintenance is reactive. Every ticket or incident waits on a person to act and restart the process. An alert fires at 3 a.m. and is missed. A ticket sits in the backlog. Post-mortem actions never reach the codebase because another fire started first.

**AI-native.** A trigger such as a control-band breach, a ticket, a channel message, or a schedule invokes Claude without a person in the path. Claude diagnoses, acts only through gated routes, and writes what it finds as `intent.md`, which then goes through the stages like any other change. People triage and review that work; they no longer have to start it.

Every earlier play required a human to launch the first step. This one runs headless, with an independent confidence gate between stages (a deterministic check or an adversarial reviewing agent) deciding whether the previous stage's output continues or escalates to a human.

## Who runs it

The service owner or platform engineer sets up detection and tiers. The service owner or on-call engineer triages the queue.

## Prerequisites

The `intent.md` format ([plan-intent.md](plan-intent.md)), which gives the loop a structured output to restart from. The PR review loop ([deploy-pr-review.md](deploy-pr-review.md)), hooks as an action boundary ([deploy-approval-gates.md](deploy-approval-gates.md)), and a rehearsed rollback ([deploy-cicd.md](deploy-cicd.md)), which the highest autonomy tier invokes.

## Infrastructure

A metrics store the detection script can query (Prometheus, the CI system's API, or equivalent). Read access to the repository. A way to run Claude Code non-interactively in CI, or the Agent SDK for a service that receives webhooks.

## How to execute it

1. Pick one metric with a stable rolling baseline: CI test failure rate, post-deploy 5xx rate, PR cycle time.
2. Write the detection script: mean and standard deviation over a rolling window with rules (Western Electric or similar) so the bands catch slow drift as well as spikes. Version control it, unit test it. Detection stays entirely deterministic; no model is involved.
3. Define response tiers in version-controlled config. At 1σ the script only logs. At 2σ it invokes Claude read-only to diagnose. At 3σ Claude may act, but only by opening a PR into the review gate or triggering a pre-approved runbook.
4. Choose the trigger layer: a scheduled workflow in GitHub or GitLab, a webhook from the monitoring stack, or a cron job inside the network. Claude runs stateless as a non-interactive CI step or an Agent SDK service in a sandboxed container.
5. The agent writes its diagnosis as `intent.md` in the Stage 1 format: the anomaly and its evidence, a proposed outcome, affected systems, open questions. From there it goes through the pipeline like anything else.
6. Triage the queue: fix now, schedule, or dismiss. Route product-facing findings to the product owner. Dismissals tune the bands and reduce noise.
7. When a fix ships, add an eval for the incident ([test-continuous-evals.md](test-continuous-evals.md)).

## What it looks like

`plugin/template/ops/bands.yaml` is the article's example for CI test failure rate: a rolling 30-day baseline, Western Electric rules, and three tiers with the tools and routes each may use. Examples of the pattern at work:

- CI test failure rate breaches 3σ: the agent quarantines the flaky test or opens a revert PR, and the review gate decides.
- Post-deploy 5xx rate breaches 3σ with a deployment in the window: the agent triggers the existing rollback pipeline.
- PR cycle time trips a drift rule: the agent writes a report for engineering leadership. The harness works for process metrics as well as production ones.

## Governance

Tier boundaries are enforced from version-controlled config, with permissions and managed settings denying production access. Invocations, findings, and triage decisions are logged with a timestamp. A service owner triages and approves findings. Resulting changes go through the normal PR review gate, and the runbooks the agent may trigger were approved in advance.

## How to measure it

- **Leading.** Time from band breach to an `intent.md` in the triage queue, against the old time from incident to post-mortem action. The detection log has the breach timestamp and tier.
- **Lagging.** Share of findings that become merged fixes (triage queue against PR history), and repeat incidents of the same class, which should fall as fixes add cases to the eval suite.

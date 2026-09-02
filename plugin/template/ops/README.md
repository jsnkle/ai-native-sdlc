# ops/ — closing the loop

The maintenance stage runs headless: a trigger invokes Claude with no person in the invocation path, and what it finds re-enters the pipeline as `intent/<slug>/intent.md`.

## Parts

1. **A metric with a stable rolling baseline.** Start with one: CI test failure rate, post-deploy 5xx rate, or PR cycle time.
2. **A detection script.** Mean and standard deviation over a rolling window with Western Electric rules, so the bands catch slow drift as well as spikes. It is version controlled and unit tested, and it is entirely deterministic. No model is involved in deciding whether a band was breached.
3. **`bands.yaml`.** The response tiers, in version-controlled config:
   - **1σ:** log only.
   - **2σ:** invoke Claude read-only to diagnose. The `tools` allowlist is what `claude -p --allowedTools` receives.
   - **3σ:** Claude may act, but only through the listed routes: open a PR into the review gate, or trigger a pre-approved runbook such as the rehearsed rollback.
4. **A trigger layer.** A scheduled GitHub workflow, a webhook from the monitoring stack, or a cron job inside the network. Claude runs stateless as a non-interactive CI step or an Agent SDK service in a sandboxed container.
5. **The output.** Claude writes its diagnosis as `intent.md` in the Stage 1 format: the anomaly and its evidence, a proposed outcome, affected systems, open questions. It joins the triage queue.

## Triage

The service owner or on-call engineer works the queue: fix now, schedule, or dismiss. Product-facing findings route to the product owner. Dismissals tune the bands. When a fix ships, add an eval for the incident under `evals/`.

## Governance

Tier boundaries come from this config, not from the prompt. Permissions and managed settings deny production access. Invocations, findings and triage decisions are logged with a timestamp. Resulting changes go through the normal PR review gate, and the runbooks the agent may trigger were approved in advance.

## Measure

- Leading: time from band breach to an `intent.md` in the triage queue.
- Lagging: share of findings that become merged fixes; repeat incidents of the same class.

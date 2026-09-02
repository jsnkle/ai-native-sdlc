# CI/CD integration and deployment

Stage 5, Deploy. Claude runs non-interactively inside the pipeline for the judgment steps, in a sandbox with scoped credentials, inside gates the organization defines per environment.

## What changes

**Traditional.** Pipelines run deterministic scripts, and anything that needs judgment waits for a human: triaging the flaky test, writing the changelog, working out why the build broke. Deployment and rollback are runbooks a human follows under pressure.

**AI-native.** Claude runs `claude -p` inside the pipeline for the judgment steps. Deployment tooling is exposed to the agent through MCP, so the workflow that wrote and tested the change can also ship it and roll it back, inside per-environment gates.

## Who runs it

The platform engineer.

## Prerequisites

The PR review loop ([deploy-pr-review.md](deploy-pr-review.md)) and hooks as approval gates ([deploy-approval-gates.md](deploy-approval-gates.md)). The gates must exist before automation accelerates anything through them.

## Infrastructure

A CI platform with `claude-code-action` installed, or any runner that can call `claude -p`. Model access through the API, or Bedrock, Foundry, or Vertex where traffic must stay on the organization's cloud agreement. MCP servers for the deployment targets. A sandbox profile for agent jobs with no standing production credentials.

## How to execute it

1. Start with read-only judgment steps. Use `claude -p` in a pipeline job to triage a failed build, summarize a flaky test, or draft the changelog.
2. Add write steps behind the existing gates: fixing lint, updating generated docs, addressing `@claude` review comments. Anything the agent writes arrives as a PR through branch protection. The agent has no route to push to `main`.
3. Sandbox execution. Agent jobs run in containers under a network policy with short-lived scoped tokens and hold no production credentials by default.
4. Expose deployment through MCP. Deploy, status, and rollback become tools scoped per environment, so the agent's deployment powers are an allowlist rather than a shell script with credentials.
5. Tier autonomy by environment. In development the agent deploys freely. In production the agent prepares the release and the release manager authorizes it, enforced by the production gate hook. Staging sits in between.
6. Rehearse rollback. It should be the most practiced path in the pipeline, a single command the agent can run, exercised regularly in staging. [maintain-closing-the-loop.md](maintain-closing-the-loop.md) calls it when a control band is breached, so it has to be proven in advance.

## What it looks like

The article's triage step, which `plugin/template/.github/workflows/` includes as a reusable snippet:

```yaml
- name: Triage failed build
  if: failure()
  run: >
    claude -p "Read the build log at out/build.log. Identify the most
    likely cause, say whether the failure looks flaky or real, and write a
    three-line summary for the PR thread." >> triage.md
```

`plugin/template/.github/workflows/spec-on-intent-merge.yml` is the same pattern applied to the artifact chain: a merge into `intent/` fires a non-interactive run that produces `spec.md` as a PR.

## Governance

The agent may act up to the production gate and cannot pass it. Branch protection turns anything the agent writes into a PR. The production deploy hook blocks the release until a named release manager authorizes it. Each non-interactive run acts under the agent's own identity, so the pipeline log separates what the agent did from what the engineer who triggered it did. Per-environment permission tiers set how much the agent may do on the way to the gate.

## How to measure it

- **Leading.** Share of pipeline failures triaged without paging a human, from pipeline logs.
- **Lagging.** DORA measures (deployment frequency, lead time, change failure rate, time to restore), which the CI system and deployment tooling already emit.

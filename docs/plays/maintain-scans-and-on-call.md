# Recurring scans and Claude on call

Stage 6, Maintain. Two more routes by which work enters the loop without a person starting it: a scheduled security scan, and an incident arriving in a chat channel.

## What changes

**Traditional.** Security scanning is an event, launched before a release or an audit. The report goes to a tracker and the backlog is worked down by hand until the next event. Code written in between is covered by whatever PR review caught. Incidents arrive as a 10 p.m. message in a channel and wait for whoever is awake.

**AI-native.** Scans run on a schedule against every connected repository on the most capable model available, with findings validated before anyone reads them. Each finding is handled like a breached control band: a fix that fits in one PR goes through the review gate, and anything larger becomes an `intent.md`. Coverage is dated from the last run, not the first. Incidents in Slack get a first responder immediately: Claude Tag is a member of the channel under its own identity, and the response becomes part of the loop and the memory for future incidents.

A security scan is a point-in-time statement about a codebase under a particular model, and both halves go stale. The code changes every week, and each model generation finds vulnerabilities the previous one missed.

## Who runs it

The security lead connects repositories, sets schedules, and triages findings. The on-call engineer works alongside Claude Tag in the incident channel.

## Prerequisites

The PR review gate and approval gates ([deploy-pr-review.md](deploy-pr-review.md), [deploy-approval-gates.md](deploy-approval-gates.md)), so findings go through review like any other change. The `intent.md` format ([plan-intent.md](plan-intent.md)) for findings too large for one PR.

## Infrastructure

**Scans.** Claude Security, available to Claude Enterprise organizations. It needs the Anthropic GitHub App on the target repositories, Claude Code on the Web enabled, Extra Usage on with a spend limit, premium seats for the people who run scans, and the feature enabled by an admin. Scans are billed on consumption, so the spend limit should match the number and size of repositories.

**On call.** Claude Tag in Slack, with MCP access to the metrics and deployment tooling so Claude can verify a metric is back at baseline.

## How to execute it

Scans:

1. Connect the repositories and organize them into projects by repo, service, or team, so ownership of findings is clear.
2. Run a first full scan of the most critical repositories, including ones already scanned by other tools. Treat it as the baseline; expect findings in code that was considered clean.
3. Set a schedule per project. Weekly is a sensible default for actively developed services. Scope to a directory or branch where a repository is large or mixed.
4. Triage with the confidence rating in hand. Dismiss with a reason, so the same finding does not return as new next run.
5. For a bounded finding, open the suggested patch in Claude Code on the Web, review it, and send it through the PR review gate. The agent that proposed the fix has no route to approve it.
6. For anything wider than one patch, write it up as `intent.md` and start it at Plan.
7. When a fix reaches production, add an eval for the vulnerability class.
8. Export findings (CSV, Markdown, webhooks) to keep the existing tracker as the system of record where auditors expect it.

On call:

1. Add Claude Tag to the incident channels. Each new incident gets a first responder.
2. Anyone in the channel guides the response: test hypotheses, explore options, investigate in real time. The channel history is the audit trail.
3. Claude verifies the metric is back at baseline through MCP and confirms it in the thread.
4. Claude writes the post-mortem to a version-controlled lessons file that future investigations read.
5. Work that is not an incident enters the same way. Tagged on a ticket or asked in the channel, Claude triages: a small bounded fix arrives as a PR through the review gate; anything larger becomes an `intent.md`.

## What it looks like

There is no template file for this play. The outputs are a scan project in Claude Security, a Slack channel with Claude Tag as a member, and the `intent.md` files and PRs those produce, which use the same formats as every other play.

## Governance

The scan runs under the organization's admin controls: which repositories are connected, who holds a scan seat, and the spend limit are all set centrally. Every finding has a validation result and a confidence rating; every dismissal has a reason. Fixes reach production through the PR review gate and branch protection, never from the scan itself. Claude Security augments static analysis and dependency scanning rather than replacing them: deterministic checks stay in CI, the model-driven scan covers the context-dependent vulnerabilities those checks are not built to find.

For on call, the channel is the audit trail: request, diagnosis, human authorization, and fix all stay where the incident was handled.

## How to measure it

- **Leading.** Share of connected repositories on a schedule, and time from a finding being reported to its patch entering the review gate, from scan history and PR metadata.
- **Lagging.** Vulnerabilities found by the scheduled scan against those found in production or by external report, from the incident tracker. The trend in findings per scan on repositories that have been through several runs, which should fall as fixes and evals accumulate.

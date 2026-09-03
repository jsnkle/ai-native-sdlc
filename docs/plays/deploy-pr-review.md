# AI in the PR review loop

Stage 5, Deploy. Review runs in both directions. Claude reviews incoming PRs against the organization's policies and addresses review comments on its own PRs. Engineers focus on intent and risk.

## What changes

**Traditional.** Review capacity was planned around human output. A PR waits for a reviewer to read all of it, review quality varies with the reviewer's load, and the author chases while the backlog grows.

**AI-native.** Every PR gets an identical set of review passes with findings ranked by severity. Human attention moves up a level, to whether the change does what the plan intended and whether the risk is acceptable.

## Who runs it

The tech lead writes the review policy and sets the human threshold. A code owner approves each PR. The PR author (or the session that opened it) addresses findings.

## Prerequisites

An up-to-date `CLAUDE.md` ([build-claude-md.md](build-claude-md.md)). Skills if the review passes enforce written policies ([build-skills.md](build-skills.md)). Defined subagents help ([build-parallel-sessions.md](build-parallel-sessions.md)).

## Infrastructure

A repo with the Claude integration installed: either the managed Code Review service enabled by an admin, or the `claude-code-action` running in your own CI with model calls through Bedrock, Vertex, or Foundry where required. Branch protection that requires a code owner's approval.

## How to execute it

1. Turn on review. The managed Code Review service is the fastest start: an admin enables it and selects repositories. Run it in your own CI with `claude-code-action` when you need control of the pipeline or your own cloud agreement ([deploy-cicd.md](deploy-cicd.md)).
2. Write the review policy as `REVIEW.md` at the repo root, divided into the passes the organization cares about: bugs and logic errors; security and vulnerabilities; compliance against `spec.md`, `plan.md`, and the design principles. Define what counts as Important versus a Nit, and what to skip.
3. Set the human threshold. Findings do not approve or block on their own, and branch protection still requires a code owner. A platform engineer who wants to gate merges on findings can read the severity counts the check run publishes.
4. Close the fix loop. When a reviewer or author tags `@claude` on a comment, Claude addresses it and pushes the fix; the thread records both. For PRs Claude opened, `/ai-native-sdlc:babysit-pr` sweeps unresolved comments and failing checks, fixes them, and pushes until the PR is green and waiting only on code owner approval.
5. Feed findings back. When a review flags a mistake for the second time, the correction goes into `CLAUDE.md` as part of that review. Review also flags when a change has made `CLAUDE.md` outdated.
6. Tune monthly. The tech lead rates findings so the reviewer improves and caps Nit volume in `REVIEW.md`. Generated paths and anything CI already enforces are excluded.

## What it looks like

`plugin/template/REVIEW.md` carries the article's example: three passes, a definition of Important, a cap of five nits, and a do-not-report list.

## Governance

Separation of duties is preserved: the agent that wrote the code has no way to approve it. The review policy in `REVIEW.md` is applied to every PR. Findings, fixes, ratings, and approvals are logged in the PR history, so the PR is the audit record. Approval comes from a human through branch protection, informed by the findings.

## How to measure it

- **Leading.** Time to first review, which should fall to minutes, and the share of review comments resolved without a human touching the branch, from git.
- **Lagging.** Defects and vulnerabilities caught before merge set against those escaping to production, from PR history and the incident tracker.

**Template files.** `plugin/template/.github/workflows/claude-review.yml` runs the REVIEW.md passes on every opened PR and posts one comment-only review; `claude-mention.yml` answers `@claude` comments from owners, members and collaborators by running the babysit-pr skill, or a fresh review for `@claude review`. Both were exercised on the sandbox on 2026-09-03; the review's first run found a trigger-by-anyone hole in the mention workflow, which is why it is gated by author association.

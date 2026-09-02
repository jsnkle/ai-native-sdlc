# Brownfield assessment

Score an existing repo before adopting. Each "no" is a prerequisite to fix in phase 1, not a reason to stop. Twenty minutes with the engineer who knows the codebase best.

## Feedback loop (blocks everything else)

- [ ] The build runs locally with one command and exits non-zero on failure.
- [ ] The tests run locally with one command and exit non-zero on failure.
- [ ] Lint runs locally with one command.
- [ ] For UI work, there is a way to see the result: a browser tool or screenshot utility Claude can call.
- [ ] Test suite runtime is short enough to run on every task (under ~10 minutes).

## Knowledge

- [ ] There is a written source for conventions (wiki, README, ADRs), even if stale.
- [ ] One engineer can list the five things a new joiner gets wrong.
- [ ] Policies that must hold (security, API design, brand) have a named owner and a written source of truth.

## Repo hygiene

- [ ] Branch protection requires a code owner approval to merge to main.
- [ ] A `CODEOWNERS` file exists.
- [ ] Generated code and frozen packages are in identifiable paths.
- [ ] Secrets are not in the repo; `.env` and equivalents are ignored.

## Process and records

- [ ] Work items live in a tracker (Jira, ServiceNow, GitHub issues). Name it: ______
- [ ] Requirements live somewhere with traceability, or nowhere. Name it: ______
- [ ] Change approvals go through a board or a named release manager. Name the gate: ______
- [ ] The production deploy is a single identifiable command.
- [ ] Rollback is a single command and has been exercised in the last quarter.

## CI

- [ ] CI runs on every PR.
- [ ] CI can run a non-interactive job with a repository secret (for `claude -p`).
- [ ] Model access route decided: Anthropic API, Bedrock, Vertex or Foundry.

## Monitoring

- [ ] At least one production or process metric has a queryable store with 30 days of history.

## Decisions to record before phase 1

1. **Source of truth per artifact** (repo, legacy system, or linkage). See `plugin/template/intent/README.md`.
2. **Higher-risk changes.** What the organization classes as needing a tech lead or architect at the spec and plan gates.
3. **Safe inner loop.** The commands engineers consider safe to pre-approve in `.claude/settings.json`.
4. **Protected paths.** Migrations, infra, generated code, frozen packages.
5. **Human gates that must survive.** Change management sign-off, release authorization, edits to protected paths.

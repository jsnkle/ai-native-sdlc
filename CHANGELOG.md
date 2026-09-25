# Changelog

All notable changes to the plugin and template are recorded here. The plugin version in
`plugin/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` moves together.

## 0.2.2 - 2026-09-25

**Security.** `claude-mention.yml` ran the fix loop on any pull request that an owner, member or collaborator mentioned `@claude` on, including pull requests from forks. The loop checks out the PR and runs with `ANTHROPIC_API_KEY` and `LOOP_GH_TOKEN`, and the PR's own hooks, Makefile and venv run there. That means an outside contributor's pull request could run code with those secrets. It was found by review on 2026-09-25. The kit's sandbox had the workflow disabled.

- `claude-mention.yml` now handles only pull requests opened from a branch of this repository by an owner, member or collaborator. It refuses the rest before checking anything out.
- `CODEOWNERS` assigns `.github/` to the tech lead, so the workflows that hold secrets change only with the same review as `.claude/`.
- **Projects that copied the template before 0.2.2 should replace their `.github/workflows/claude-mention.yml` and add the `.github/` line to `CODEOWNERS`.** Template files are copied when a project adopts the kit, so updating the plugin does not change them.

Documentation corrections from [the 2026-09-25 retrospective](docs/retrospective-2026-09-25.md):

- Approvals: the agent's "never approves or merges" is a prompt. The docs, CODEOWNERS and workflow comments now say it holds only when branch protection requires a code-owner review and no token the agent uses belongs to a code owner. The template README says to create `LOOP_GH_TOKEN` from an account that is not a code owner.
- Template README lists `requirements-dev.txt` and the Makefile targets the workflows assume; the template ships neither.
- Hooks: the plugin README says they are Claude Code only (Codex installs the plugin, but its patch-shaped edits pass both hooks), and the hooks play no longer says a hook makes a policy impossible to skip.
- The CLAUDE.md play covers repositories that already have an `AGENTS.md`.

## 0.2.1 - 2026-09-03

- Template gains `claude-review.yml` (one comment-only review per PR from REVIEW.md) and `claude-mention.yml` (`@claude` fix loop, gated to owners, members and collaborators). `spec-on-intent-merge.yml` diffs the whole push and uses the spec skill; `triage-failed-build.yml` triages only when the build step failed. All four exercised with real triggers on the sandbox.
- Template README indexes every file; docs record the automated ladder and the shutdown method.

## 0.2.0 - 2026-09-02

Everything below was found by running the whole playbook end to end on a sandbox repository, including the unattended Maintain stage and the continuous evals in CI.

- Template hooks read their payload with `$(cat)`; the playbook's `< /dev/stdin` pattern fails open on Linux runners.
- Documented what workspace trust gates in `claude -p` (the permissions allow list, not project hooks), the Console API key requirements, and the Actions PR-creation setting.

- Template evals gain `evals/run.sh` (shared by local and CI runs, with per-case `setup`), and the workflow installs the venv and the plugin whose hooks the suite exercises. Proven on the sandbox with five cases drawn from real incidents.
- Template gains the Maintain stage: `ops/detect.py` (deterministic detection, tested), `ops/loop.sh` (tiered response), `.github/workflows/closing-the-loop.yml` (unattended schedule). Proven end to end on the sandbox: tier 2 diagnosis and a tier 3 intent PR.

## 0.1.1 - 2026-09-02

Found by the first end-to-end brownfield test.

- Merged `plugin/commands/` into the skills. A command and a skill sharing the name `adopt` collided in the unified namespace; the command won and the skill body never loaded. `intent`, `spec`, `plan`, `adopt` and `babysit-pr` are now user-invocable skills with argument hints.
- Renamed `intent-format`, `spec-format`, `plan-format` to `intent`, `spec`, `plan`.
- `adopt` documents its scope argument and how each scope maps to its steps.

## 0.1.0 - 2026-09-02

Initial skeleton derived from Anthropic's "The AI-Native SDLC playbook" (August 2026).

- `docs/`: the methodology for humans, one file per play.
- `plugin/`: skills, agents, commands and generic hooks installed into every project.
- `plugin/template/`: per-repo files copied into a new or existing project.
- `brownfield/`: the adoption runbook for existing repositories.
- `org/`: managed settings and marketplace hosting, owned outside any repo.
- `scripts/new-project.sh`: greenfield bootstrap.

# plugin/template/ — the per-repo files

Everything here is copied into a project and then customised. Shared institutional pieces (the skills, agents and generic hooks) are **not** here; they come from the `ai-native-sdlc` plugin so every project stays on one version. `scripts/new-project.sh` does the copy for a new project and the `adopt` skill does it for an existing one. Neither copies this README, and `intent/_example/` is left out unless `new-project.sh` is given `--with-example`.

`{{PROJECT_NAME}}` in `CLAUDE.md` and `CODEOWNERS` is substituted by the script. `CLAUDE.md`, `REVIEW.md` and the pull request template carry HTML comments (`<!-- -->`) where a human has to fill something in.

## File index

| File | Play it serves | Customise |
|---|---|---|
| `CLAUDE.md` | Build: the CLAUDE.md | Commands with healthy output, conventions, architecture. Keep under a page. |
| `REVIEW.md` | Deploy: AI in the PR review loop | Generated paths to skip; what Important means for this codebase. |
| `intent/README.md` | Plan, Design, Build: the artifact chain | Record the source-of-truth decision. |
| `intent/_example/{intent,spec,plan}.md` | Plan, Design, Build | The playbook's claims-status example as a complete chain. Delete after the first real change. |
| `.claude/settings.json` | Build: hooks as guardrails; Deploy: hooks as approval gates; plugin install | Permission allow list for your safe inner loop. |
| `.claude/hooks/production-gate.sh` | Deploy: hooks as approval gates | The deploy command pattern and what counts as authorization. |
| `.claude/hooks/protected-paths.sh`, `.claude/protected-paths` | Build: hooks as guardrails | The list of globs. |
| `.claude/hooks/format-on-edit.sh` | Build: hooks as guardrails | Point at your formatter. |
| `.github/CODEOWNERS`, `.github/pull_request_template.md` | Deploy: PR review, separation of duties | Team handles. |
| `.github/workflows/agent-evals.yml` | Test: continuous evals | Runs on any change to CLAUDE.md, REVIEW.md, `.claude/` or `evals/`, and nightly. |
| `evals/run.sh`, `evals/check.sh`, `evals/README.md` | Test: continuous evals | The runner (local and CI) and the per-case checker. Nothing to change. |
| `evals/example-add-endpoint.json` | Test: continuous evals | One example case. Replace with 20 to 50 cases from your own incidents. |
| `.github/workflows/spec-on-intent-merge.yml` | Design: automated spec pass | Enable once the spec format is stable. |
| `.github/workflows/claude-review.yml` | Deploy: PR review | One comment-only review per opened PR, from REVIEW.md. |
| `.github/workflows/claude-mention.yml` | Deploy: fix loop | `@claude` from an owner, member or collaborator runs babysit-pr, or a fresh review. |
| `.github/workflows/triage-failed-build.yml` | Deploy: CI/CD integration | Your build command and log path. |
| `.github/workflows/closing-the-loop.yml` | Maintain: closing the loop | The schedule. |
| `ops/bands.yaml`, `ops/README.md` | Maintain: closing the loop | The metric, the window and baseline, and what each tier permits. |
| `ops/detect.py`, `ops/loop.sh`, `ops/__init__.py` | Maintain: closing the loop | Detection and the tiered response. Nothing to change unless the metric does. |
| `tests/test_detect.py` | Maintain: closing the loop | Unit tests for the detector. Needs `pyyaml` as a dev dependency. |

## Maturity ladder

The files support three levels. Start at the first.

1. **By hand.** Engineers and product owners run the plugin's skills and commit the artifacts themselves. Only `CLAUDE.md`, `REVIEW.md`, `intent/` and the hooks are in use.
2. **Codified.** The prompts are stable and live in the plugin; review runs on every PR; evals guard configuration changes.
3. **Triggered.** Each accepted artifact fires the next gate: an intent merge runs the spec pass, a merged PR runs the pipeline, a band breach writes the next intent. The workflows here are the plumbing.

## Trust the workspace first

Claude Code ignores `permissions.allow` in a project's `.claude/settings.json` until someone has opened the project interactively and accepted the trust dialog. Until then every pre-approved command prompts, and a non-interactive run (`claude -p`) sees none of the allow list and must pass `--allowedTools` itself, as the CI workflows here do. Project hooks are not gated by trust and run either way. Open the repo in Claude Code once before expecting the allow list to work.

## What the workflows need

Every workflow that calls Claude needs `ANTHROPIC_API_KEY` in the repository secrets: a Console key from a workspace with credits, pasted as its value, not its name. The workflows that use the plugin's skills or hooks install it from the marketplace themselves. Two more settings matter for the ones that open pull requests:

- **Actions may create PRs.** Settings > Actions > General > Workflow permissions > "Allow GitHub Actions to create and approve pull requests". Without it the spec and loop workflows push a branch and then fail at `gh pr create`.
- **`LOOP_GH_TOKEN`.** A PR opened or a push made with the default Actions token triggers no other workflow, so the spec PR gets no checks and the fix loop's pushes get no CI. A fine-grained personal access token with contents and pull-requests write, stored as `LOOP_GH_TOKEN`, gives the full chain. The three workflows that use it fall back to the default token when it is absent.

Each run is a Claude call with a price. When a repo is idle, `gh workflow disable <name>` per workflow, and `gh workflow enable` to bring one back.

## Review and fix loop in CI (Stage 5)

`claude-review.yml` runs the REVIEW.md passes on every opened PR and posts one comment-only review. It never approves, requests changes or merges; branch protection still requires a code owner. `claude-mention.yml` answers `@claude` comments: `@claude review` for a fresh pass, anything else runs the babysit-pr skill to address threads and failing checks. Only comments from the repository's owner, members or collaborators trigger it, so a stranger on a public repo cannot spend credits or run code.

## Closing the loop (Stage 6)

`ops/detect.py` is the deterministic detector, `ops/bands.yaml` its config, `ops/loop.sh` the tiered response, and `closing-the-loop.yml` the unattended schedule. Claude is invoked only on a breach, with the tools the tier allows, and anything it proposes arrives as a PR. `ops/README.md` explains the statistic and the tier mapping. Run `ops/loop.sh` by hand under your own login first; move to the schedule once the PRs it opens are worth triaging.

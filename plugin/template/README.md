# plugin/template/ — the per-repo files

Everything here is copied into a project and then customised. Shared institutional pieces (skills, agents, slash commands, generic hooks) are **not** here; they come from the `ai-native-sdlc` plugin so every project stays on one version. `scripts/new-project.sh` does the copy.

| File | Play it serves | Customise |
|---|---|---|
| `CLAUDE.md` | Build: the CLAUDE.md | Commands with healthy output, conventions, architecture. Keep under a page. |
| `REVIEW.md` | Deploy: AI in the PR review loop | Generated paths to skip; what Important means for this codebase. |
| `intent/README.md`, `intent/_example/` | Plan, Design, Build: the artifact chain | Record the source-of-truth decision. Delete `_example/` after the first real change. |
| `.claude/settings.json` | Build: hooks as guardrails; Deploy: hooks as approval gates; plugin install | Permission allow list for your safe inner loop. |
| `.claude/hooks/production-gate.sh` | Deploy: hooks as approval gates | The deploy command pattern and what counts as authorization. |
| `.claude/hooks/protected-paths.sh`, `.claude/protected-paths` | Build: hooks as guardrails | The list of paths. |
| `.claude/hooks/format-on-edit.sh` | Build: hooks as guardrails | Point at your formatter. |
| `.github/workflows/agent-evals.yml`, `evals/` | Test: continuous evals | Add 20 to 50 real tasks. Needs `ANTHROPIC_API_KEY`. |
| `.github/workflows/spec-on-intent-merge.yml` | Design: automated spec pass | Enable once the spec format is stable. |
| `.github/workflows/triage-failed-build.yml` | Deploy: CI/CD integration | Your build command and log path. |
| `.github/CODEOWNERS`, `pull_request_template.md` | Deploy: PR review, separation of duties | Team handles. |
| `ops/bands.yaml`, `ops/README.md` | Maintain: closing the loop | The metric and the routes. |

`{{PROJECT_NAME}}` is substituted by the script. Files marked with HTML comments (`<!-- -->`) need a human to fill them in.

## Maturity ladder

The files support three levels. Start at the first.

1. **By hand.** Engineers and product owners run the plugin's slash commands and commit the artifacts themselves. Only `CLAUDE.md`, `REVIEW.md`, `intent/` and the hooks are in use.
2. **Codified.** The prompts are stable and live in the plugin; review runs on every PR; evals guard configuration changes.
3. **Triggered.** Each accepted artifact fires the next gate: an intent merge runs the spec pass, a merged PR runs the pipeline, a band breach writes the next intent. The workflows here are the plumbing.

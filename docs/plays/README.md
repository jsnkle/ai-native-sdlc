# Plays

A play is one bounded change to how a stage works. Each page below has the same eight sections: what changes, who runs it, prerequisites, infrastructure, how to execute it, what it looks like, governance, and how to measure it. Adopt them in the order given by the dependency graph in [../02-adoption-order.md](../02-adoption-order.md), not by stage number.

| Stage | Play | Who runs it | Artifact produced | Prerequisites |
|---|---|---|---|---|
| 1 Plan | [Capture intent.md](plan-intent.md) | Originator, product owner | `intent/<slug>/intent.md` | None |
| 2 Design | [Requirements and design](design-spec.md) | Product owner | `intent/<slug>/spec.md` | intent.md; policies written as skills |
| 3 Build | [Plan mode as the default](build-plan-mode.md) | Engineer | `intent/<slug>/plan.md` | spec.md if one exists; CLAUDE.md helps |
| 3 Build | [CLAUDE.md](build-claude-md.md) | One engineer who knows the codebase | `CLAUDE.md` | None |
| 3 Build | [Skills as institutional knowledge](build-skills.md) | Engineer with a policy owner | `plugin/skills/<name>/SKILL.md` or `.claude/skills/<name>/` | None; CLAUDE.md helps |
| 3 Build | [Hooks as guardrails](build-hooks-guardrails.md) | Platform engineer | `.claude/settings.json`, `.claude/hooks/*.sh` | None |
| 3 Build | [Parallel sessions and subagents](build-parallel-sessions.md) | Engineer | `plugin/agents/*.md`, worktrees | CLAUDE.md; feedback loop helps |
| 4 Test | [Give Claude a feedback loop](test-feedback-loop.md) | Engineer | Verification block in `CLAUDE.md`, one-command test target | None |
| 4 Test | [Continuous evals in CI](test-continuous-evals.md) | Platform engineer | `evals/`, `.github/workflows/agent-evals.yml` | CLAUDE.md; feedback loop |
| 5 Deploy | [AI in the PR review loop](deploy-pr-review.md) | Tech lead | `REVIEW.md`, review findings on the PR | CLAUDE.md; skills and subagents if passes enforce policy |
| 5 Deploy | [Hooks as approval gates](deploy-approval-gates.md) | Engineering leadership, platform engineer | `.claude/hooks/production-gate.sh`, `org/managed-settings.example.json` | None |
| 5 Deploy | [CI/CD integration and deployment](deploy-cicd.md) | Platform engineer | Pipeline steps, MCP deploy tools, rollback | PR review loop; approval gates |
| 6 Maintain | [Closing the loop](maintain-closing-the-loop.md) | Service owner, platform engineer | `ops/bands.yaml`, detection script, agent-written `intent.md` | intent.md; PR review; approval gates; rollback |
| 6 Maintain | [Recurring scans and on call](maintain-scans-and-on-call.md) | Security lead, on-call engineer | Scan findings, patches through the review gate, `intent.md` for larger work | PR review; approval gates; intent.md format |

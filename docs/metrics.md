# Metrics

Every play names a leading indicator (visible within days, tells you whether the play is being used) and a lagging indicator (visible over weeks, tells you whether it worked). Almost all of them come from data you already have: git history, PR metadata, CI logs, the incident tracker, and the OpenTelemetry export from Claude Code.

Read leading indicators weekly per team. Read lagging indicators monthly or quarterly. A play whose leading indicator moves and whose lagging indicator does not is being used without helping; look at the play's governance section for what is missing.

| Stage | Play | Leading indicator | Lagging indicator | Where the data comes from |
|---|---|---|---|---|
| Plan | [Capture intent.md](plays/plan-intent.md) | Time from first conversation to a committed `intent.md`. Expect weeks to become hours. | Survival rate: share of intents accepted into design rather than closed. Changes to `intent.md` after the first `spec.md` commit. | Git history on `intent/` (author, timestamp, merge or closed review). |
| Design | [Requirements and design](plays/design-spec.md) | Elapsed time between the `intent.md` commit and the `spec.md` commit for the same change. | Requirements rework after build starts: `spec.md` commits dated after the first `plan.md` commit. | `git log` on `intent/<slug>/`. |
| Build | [Plan mode](plays/build-plan-mode.md) | Share of changes that merge from the first implementation pass. Time from plan approval to merged PR. | Rework cycles per change. How often the merged diff still matches `plan.md`. | PR metadata; compliance pass in review findings. |
| Build | [CLAUDE.md](plays/build-claude-md.md) | How often Claude repeats a mistake `CLAUDE.md` should have caught. | Time to first merged PR for a new team member. | Git history of `CLAUDE.md`; PR history. |
| Build | [Skills](plays/build-skills.md) | Time from policy owner approving a change to the updated skill merging. | Review findings that cite the policy, which should fall toward zero. | PR on the skill folder; review findings. |
| Build | [Hooks as guardrails](plays/build-hooks-guardrails.md) | Block rate per hook. | Findings and incidents in the category the hook guards. | Hook logs, OpenTelemetry export; incident tracker. |
| Build | [Parallel sessions](plays/build-parallel-sessions.md) | Concurrent sessions per engineer while review quality holds. Share of the day spent steering rather than waiting. | Changes merged per engineer per week, alongside the rework rate. | OpenTelemetry export; PR history. |
| Test | [Feedback loop](plays/test-feedback-loop.md) | First-pass CI success rate for agent-written changes. | Review time per PR. Change failure rate. | CI system; PR metadata; incident tracker. |
| Test | [Continuous evals](plays/test-continuous-evals.md) | Eval pass rate over time. Time for a production incident to become a permanent eval. | Regressions caught in CI versus found in production. | Eval suite output; incident tracker. |
| Deploy | [PR review loop](plays/deploy-pr-review.md) | Time to first review (should fall to minutes). Share of review comments resolved without a human touching the branch. | Defects and vulnerabilities caught before merge versus escaping to production. | Git and PR history; incident tracker. |
| Deploy | [Approval gates](plays/deploy-approval-gates.md) | Time spent waiting on each gate. | Gate violations reaching production before and after hooks. | OpenTelemetry export (hook decisions with timestamp and verdict); incident tracker. |
| Deploy | [CI/CD integration](plays/deploy-cicd.md) | Share of pipeline failures triaged without paging a human. | DORA: deployment frequency, lead time, change failure rate, time to restore. | Pipeline logs; CI and deployment tooling. |
| Maintain | [Closing the loop](plays/maintain-closing-the-loop.md) | Time from band breach to an `intent.md` in the triage queue, versus old incident-to-post-mortem-action time. | Share of findings that become merged fixes. Repeat incidents of the same class. | Detection script log; triage queue against PR history; incident tracker. |
| Maintain | [Recurring scans and on call](plays/maintain-scans-and-on-call.md) | Share of connected repositories on a schedule. Time from finding reported to patch entering the review gate. | Vulnerabilities found by scheduled scan versus found in production or by external report. Findings per scan on repeatedly scanned repositories. | Scan history; PR metadata; incident tracker. |

## The four numbers to put on one page

If leadership wants a single view, these four cover the loop end to end and all come from git and the PR system:

1. **Intent to spec**: median hours between `intent.md` and `spec.md` commits.
2. **Plan to merge**: median hours from `plan.md` commit to merged PR.
3. **First-pass merge rate**: share of PRs merged without a rework cycle.
4. **Escape rate**: defects found in production per merged PR.

The first two say whether the human-speed stages are keeping up with build. The last two say whether speed is costing quality.

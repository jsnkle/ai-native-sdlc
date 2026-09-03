# Retrospective: building and proving the kit, 2026-09-02 to 03

Two days, one sandbox repository, every stage of the playbook run at least once. This is what was learned, and an honest score against the article's own "how to execute it" steps.

## Lessons learned

1. **The plugin/template split is right, and the template has to live inside the plugin.** Installing a plugin copies only the plugin directory into the cache, so a `template/` at the repo root is invisible to `/adopt` in any project that installed the plugin.
2. **Commands and skills share one namespace.** A `commands/adopt.md` next to `skills/adopt/` produced two entries; the command won and the skill body never loaded. Every entry point is now a skill with an `argument-hint`.
3. **Non-interactive runs have their own rules.** Writes under `.claude/` are refused (the adopt skill emits a patch instead); plan mode cannot write, so `plan.md` is written after acceptance; workspace trust gates the permissions allow list but not project hooks; and a hook reading `< /dev/stdin` sees nothing on a Linux runner and fails open. The last one passed every test on a Mac and was caught only by the evals in CI.
4. **The first run of a new eval usually finds a bug in the eval; verify the check before blaming the agent.** Two cases were wrong (a byte-for-byte fix has no diff; forbidding `intent/` contradicted CLAUDE.md). The opposite error is as costly, so the README says to confirm what a correct outcome looks like first.
5. **The unattended loop's blockers were all outside the code.** A key's *name* pasted instead of its value; the Actions setting that allows PR creation; and the fact that PRs opened with the default token trigger nothing. A diagnostic branch that curls the API from the runner and prints only status and key prefix settled the first in one run.
6. **Small histories make bad baselines.** Two failures in five read as drift, not a spike, because the baseline held the earlier failure; four were needed for 3σ. Draft-PR runs had to be excluded, a dedup guard added so one metric opens one proposal, and the detector's own proposal noted that closing a PR does not remove its failures from the baseline.
7. **Separation of duties held all the way through.** Every approval and merge was a human's. The agent's own review of the automation PR found that anyone could trigger the `@claude` workflow on a public repo; it is now gated by author association.
8. **The artifact chain does real work.** Departures from `plan.md` were recorded in the same commit without being asked, three times. A review pass flagged when `REVIEW.md` and `CLAUDE.md` went stale. The loop's intents carried questions a human must decide.
9. **The chain was never over-applied, but the rule reads as absolute.** Every time the agent produced intent, spec and plan it was for a new route or capability, which deserves the chain; the version route cited in an earlier draft of this note was a correct application, not a heavy one. What was observed is that CLAUDE.md's "every change starts as an intent" is read literally, so a typo fix or a pure refactor would very likely get the same treatment. That is a prediction, not a finding. The decision on 2026-09-03 was to leave the rule alone until a real project hits the problem, and to keep the tiered proposal below ready for when it does.
10. **Everything automated is a Claude call with a price.** Disable the workflows when a repo is idle; the README lists how.

## Scorecard against the article

Scores are out of 10 for adherence to the article's steps for that play, judged on what was implemented *and* exercised. "Not attempted" is not scored.

| Stage | Play | Implemented | Exercised | Score | Gap |
|---|---|---|---|---|---|
| 1 Plan | Capture as intent.md | intent skill, template, `intent/` home, `Record:` line | one-shot; multi-turn interview as the originator; accepted by commit | 9 | non-engineer route via claude.ai connector untested; no ticket-sourced intent |
| 2 Design | Requirements and design | spec skill applies policy skills; CI on intent merge | by hand ×3; CI-triggered ×1 (PR 15) | 8.5 | only the example policy skill exists; Claude Design mock-up not used |
| 3 Build | Plan mode as the default | plan skill; departures updated in-commit | multi-turn interview as the engineer; three plans committed | 8 | real plan mode never used (non-interactive stand-in); no hook enforcing plan/diff sync |
| 3 Build | Auto mode | acceptEdits in every run; worktree for parallel work | throughout | 7 | not a deliberate play; `claude --worktree` sessions not driven |
| 3 Build | Source of truth (sidebar) | decision recorded in `intent/README.md`; `Record:` line | repo as source of truth | 9 | Jira linkage untested |
| 3 Build | CLAUDE.md | five sections, under a page, updated in the fixing PR | adopt wrote it; fix loop kept it current | 8.5 | `/init` not used; "Things Claude gets wrong" never populated because no mistake recurred |
| 3 Build | Skills as institutional knowledge | plugin skills, marketplace distribution | policy skill applied in every spec | 8 | the policy skill is the article's placeholder; owner sign-off flow not exercised |
| 3 Build | Hooks as guardrails | protected paths, tests locked during a fix, secrets in diff, formatter stub | evals locally and in CI; one real bug found | 9 | formatter not wired to a real tool |
| 3 Build | Parallel sessions and subagents | verifier, simplifier, researcher agents | verifier used every build; worktree used once | 6 | simplifier and researcher never exercised |
| 4 Test | Feedback loop | single-command build/test/lint with healthy output; verification in "done" | every run pasted output; test-first bug fix | 9.5 | UI screenshot loop not applicable |
| 4 Test | Continuous evals | runner, checker, CI on config change and nightly | 5 cases, local and CI; found the hook bug | 8 | 5 cases, not 20 to 50; no pass-rate threshold yet |
| 5 Deploy | AI in the PR review loop | REVIEW.md; review workflow; `@claude` fix loop; babysit | two reviews, one fix loop, one babysit to green | 9 | own workflow rather than the managed service; monthly tuning not started |
| 5 Deploy | Hooks as approval gates | production gate hook; managed-settings example | smoke-tested | 6.5 | no real deploy to gate; managed settings not deployed |
| 5 Deploy | CI/CD integration | triage, spec PR, fix loop in Actions with scoped tokens | each once | 7 | no MCP deploy tools; no per-environment tiers; no rehearsed rollback |
| 6 Maintain | Closing the loop | detector with tests, tiers, dedup, draft exclusion, scheduled workflow | tier 2 diagnosis and tier 3 proposal, unattended | 9 | runbook route (rollback) absent; incident-to-eval only partial |
| 6 Maintain | Recurring codebase scans | not attempted | | n/a | Claude Security is an Enterprise feature |
| 6 Maintain | Claude on call with Claude Tag | not attempted | | n/a | needs Slack |
| all | How to measure it | none instrumented | | 3 | no OpenTelemetry export; indicators derivable from git and PR history but not collected |

**Overall: 8 out of 10 on the plays attempted**, with the shape you would expect from a first pass: breadth is high, every loop closes, and the gaps cluster in governance infrastructure (managed settings, deploy gates, measurement) that a sandbox cannot supply.

## What to do next, in order

1. Leave CLAUDE.md's intent rule as it is until a real change shows it over-applied. If that happens, the ready-made proposal is: draw the line by whether the change makes a decision someone other than the engineer should own, not by diff size. No artifacts when nothing observable changes and no decision is made (a refactor with unchanged tests; a fix that makes an existing test pass without changing what it asserts); intent plus plan when a behaviour change was asked for in words with no open questions and nothing policy-shaped; the full chain for any new or changed interface, anything touching auth, PII, money or an external system, any originator who is not the engineer, any open question. Three safeguards make it safe: the exemption is a stated claim in the PR body, the review pass re-derives the tier and flags a wrong claim as Important, and a change that turns out to need a decision mid-way stops and writes the intent.
2. Exercise the simplifier and researcher agents in a build, or drop them.
3. Grow the eval suite from the incidents that already happened and add a pass-rate threshold.
4. Instrument the article's leading indicators from git and PR metadata; that is a script, not a platform.
5. When there is a deploy target: MCP deploy tools, per-environment tiers, a rehearsed rollback, and the production gate on a real command.

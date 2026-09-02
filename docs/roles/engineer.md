# Engineer

You run the sessions. Your job has shifted from writing code to steering the agent that writes it, correcting its plan before it starts, and reviewing what it produces before anyone else sees it.

## Plays you own

- [Plan mode](../plays/build-plan-mode.md). Every piece of work starts in plan mode with `spec.md` attached. You interrogate the plan and commit it as `plan.md` before any code exists.
- [CLAUDE.md](../plays/build-claude-md.md). One of you writes the first version; all of you maintain it. When Claude makes a mistake twice, the correction goes in.
- [Feedback loop](../plays/test-feedback-loop.md). You set up the one-command test and build targets and the verification block so every session checks its own work.
- [Parallel sessions and subagents](../plays/build-parallel-sessions.md). Once the first three are habit, you run two or three worktrees at once and turn recurring jobs into subagents.

## What you approve

- **Routine plans.** You accept the plan and let Claude implement. Anything the organization classes as higher risk goes to the tech lead before you accept it.
- **Your own "done."** A task is not done until the build, tests, and lint have run and the output is in the transcript. The verifier subagent gives you a second opinion from a fresh context.

## What you never do

- Start implementation without a committed `plan.md`. Plan mode makes this physically hard; do not work around it.
- Edit a test to make a fix pass. The plugin's hook blocks it during a fix task. If a test is genuinely wrong, that is a separate change with its own plan.
- Merge your own PR. Branch protection requires a code owner, and the session that wrote the code has no route to approve it.
- Let implementation drift from the plan silently. When the work departs from `plan.md`, update the plan in the same commit.

## A day in the life

You pull the accepted spec for claims status self-service and open a session in plan mode. Claude proposes three files and an order of work; you ask what it could break and it points at the claims-core rate limit. You add a caching step to the plan, commit `plan.md`, and accept. In a second terminal you start a worktree on the rate-limit fix from yesterday's review. While both run you read the verifier's report on the first one: the status panel works, but the empty-state flow it checked as a neighbor shows a stale label. You send that back, and by the time it is fixed the second session has its tests green. Both PRs go up with test output attached. The reviewer's findings arrive in minutes, and `/ai-native-sdlc:babysit-pr` handles the two nits while you start the next plan.

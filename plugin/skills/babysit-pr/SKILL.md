---
name: babysit-pr
description: Sweep a pull request's unresolved review comments and failing checks, fix them, push, and repeat until the PR is green and waiting only on code-owner approval. Use when asked to babysit, shepherd, or get a PR to green.
argument-hint: "[PR number; defaults to the current branch's PR]"
---
# Babysit a pull request

Invoked as `/ai-native-sdlc:babysit-pr [number]`. Work on PR `$ARGUMENTS`, or
the PR for the current branch (`gh pr view --json number,url`), until it is
green and waiting only on code-owner approval.

Loop:
1. `gh pr view --json reviewThreads,statusCheckRollup` (or `gh api` on the
   review threads) to list unresolved comments and failing checks.
2. For each unresolved comment: read the file and context, make the change
   the reviewer asked for, and reply in the thread saying what changed. If the
   comment is wrong, reply with the reasoning instead of changing code, and
   leave it for a human.
3. For each failing check: read the log (`gh run view --log-failed`), fix the
   cause. Never skip, delete or weaken a test to make a check pass.
4. Run the project's build, test and lint from CLAUDE.md locally, commit with
   a message naming the comment or check addressed, push.
5. Wait for checks, then repeat from step 1.

Stop when there are no unresolved threads and all checks pass, or after
three rounds without progress. Report each round: what was addressed, what
was pushed, what remains.

Never approve, never merge, never resolve a thread the reviewer has not
resolved, never force-push. The agent that wrote the code has no route to
approve it. This is the fix loop from the PR review play
(`docs/plays/deploy-pr-review.md`).

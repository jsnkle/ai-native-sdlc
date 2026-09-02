# Give Claude a feedback loop

Stage 4, Test. Every session checks its own work before a human sees it. What reaches the engineer has already passed the check.

## What changes

**Traditional.** The signal that code works arrives late: CI minutes later, a tester days later, production weeks later. With an agent producing the code, a late signal means a person has to check all of its output, and that person becomes the bottleneck.

**AI-native.** The session is given a way to check its own work: run the tests, run the build, take the screenshot. Claude iterates until the check passes.

The feedback loop is not the verifier subagent from [build-parallel-sessions.md](build-parallel-sessions.md). The loop runs throughout the task, as many times as the work needs. The verifier is one way to package the final check in a fresh context window once the session believes it is done, so the verdict is not colored by the assumptions that produced the code.

## Who runs it

The engineer running the session sets the loop up. The steps below are written for them.

## Prerequisites

None.

## Infrastructure

A test suite and a build that each run locally with one command. For UI work, a way for Claude to see the result: a browser tool or a screenshot utility wired in via MCP.

## How to execute it

1. If checking the work today takes a sequence of commands and some environment knowledge, wrap it in a single target such as `make test` or `npm test` that exits non-zero on failure.
2. In the Commands section of `CLAUDE.md`, list each command with an example of healthy output.
3. State a quantifiable target so Claude can check without asking: "All tests in test_status.py pass," "the screenshot matches the attached mock," "the endpoint returns 200 with the new field."
4. For bug fixes, write the failing test first. Ask Claude to reproduce the bug as a test, run it, confirm it fails for the expected reason, and commit that test. Only then ask Claude to make it pass without editing the test. A test that existed before the fix and that the agent could not rewrite is proof the bug is gone.
5. For UI work, close the loop visually. Give Claude a browser or screenshot tool and the mock, and let it implement, screenshot, compare, and adjust. Two or three rounds is normal.
6. Make verification part of "done." The instruction lives in `CLAUDE.md`: run the checks before reporting a task complete and show the output.
7. Protect the loop. An agent fixing code must not be able to weaken the check on that code. The plugin's protect-tests hook blocks edits to test files during a fix task. The alternative is to reject any fix PR that touches a test in review.

## What it looks like

The verification block in `plugin/template/CLAUDE.md`:

```markdown
## Verifying your work
- Build: make build (must finish with "Build succeeded")
- Test: make test (all green; never skip or delete a failing test)
- Lint: make lint (zero warnings)

Run all three before reporting any task complete, and paste the output.
If a test fails, fix the code, not the test.
```

## Governance

What is enforced: verification before a task is reported done, and the block on editing test files during a fix, both as hooks where the organization wants them guaranteed. The evidence is the literal output of the test run, the build log, or the screenshot diff, produced by the toolchain rather than claimed by the agent. It is logged in the session transcript, forwarded by the OpenTelemetry export, and in the PR's check run. The code owner reviewing the PR approves, and can concentrate on intent and risk because the mechanical evidence is already attached.

## How to measure it

- **Leading.** First-pass CI success rate for agent-written changes, which the CI system already reports.
- **Lagging.** Review time per PR from PR metadata, which should fall once tests catch what reviewers used to catch, and the change failure rate from the incident tracker.

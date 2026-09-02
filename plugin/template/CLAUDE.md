# {{PROJECT_NAME}}

This file is what a new joiner needs on day one. Keep it under a page. Claude reads all of it at the start of every session, so anything stale costs context for no benefit.

**Working rule:** when Claude makes the same mistake twice, the correction goes in the "Things Claude gets wrong" section below, in the same PR that fixed it.

## Commands

<!-- Replace these with the real commands. Each must run locally with one command and exit non-zero on failure. Include a line of healthy output so Claude can tell success from failure without asking. -->

- Build: `make build` (healthy output ends with `Build succeeded`)
- Test: `make test` (healthy output ends with `OK` and a test count, zero failures)
- Lint: `make lint` (healthy output is empty; runs in CI, fix before pushing)
- Run: `make run` (serves on http://localhost:8080; `/health` returns 200)

## Conventions

<!-- The conventions that matter, not a style guide. Three to six lines. -->

- Language/framework versions: <!-- e.g. Java 21, Spring Boot 3. No new Lombok. -->
- Data rules: <!-- e.g. Money is always BigDecimal, never double. -->
- Test rules: <!-- e.g. Every endpoint needs an integration test in src/itest. -->

## Architecture

<!-- Where things live and the boundaries between them. -->

- `<dir>/` holds <!-- REST controllers -->, `<dir>/` holds <!-- domain logic -->, `<dir>/` talks to external systems.
- Generated code lives in <!-- path -->; never edit it by hand.

## Things Claude gets wrong

<!-- Start empty. Add a line each time a mistake happens twice. -->

- Do not bump dependency versions; the platform team owns them.

## Verifying your work

- Build: `make build` (must finish with `Build succeeded`)
- Test: `make test` (all green; never skip or delete a failing test)
- Lint: `make lint` (zero warnings)

Run all three before reporting any task complete, and paste the output. If a test fails, fix the code, not the test. During a fix task the `.claude/fix-task` marker is present and test files are locked by a hook; the failing test you were given is the proof, not something to edit.

## How work flows through this repo

- Every change starts as `intent/<change-slug>/intent.md`, then `spec.md`, then `plan.md`. See `intent/README.md`.
- Start implementation in plan mode from an accepted `spec.md`. Commit the approved plan as `plan.md` before writing code. If the implementation departs from the plan, update `plan.md` in the same commit.
- PR review runs the passes in `REVIEW.md`. Review findings that flag a repeat mistake go into this file.
- Protected paths are listed in `.claude/protected-paths`; a hook blocks edits there. Production deploys are blocked by `.claude/hooks/production-gate.sh` until a release manager sets `RELEASE_APPROVAL`.

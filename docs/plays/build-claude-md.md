# CLAUDE.md

Stage 3, Build. Institutional knowledge becomes a file the agent reads at the start of every session, maintained by the whole team and iterated whenever a mistake is made.

## What changes

**Traditional.** Conventions, commands, architecture, and the mistakes new joiners make live in people's heads, on a wiki that drifts, or in onboarding conversations. The agent starts every session knowing none of it.

**AI-native.** `CLAUDE.md` gives Claude the context a new joiner would need: conventions, commands, architecture, and the things the team sees go wrong most often. It is version controlled, reviewed like code, and read in full at the start of every session.

## Who runs it

One engineer who knows the codebase well writes the first version. The whole team maintains it.

## Prerequisites

None.

## Infrastructure

A repo, Claude Code installed, and one engineer who knows the codebase well.

## How to execute it

1. Run `/init` in the repo. Claude generates a starting `CLAUDE.md` from what it finds.
2. Cut it down to what a new joiner would need on day one. Keep the build, test, and lint commands, the conventions that matter, and the things Claude keeps getting wrong.
3. Check it in at the repo root so the whole team shares one version and changes are reviewed like code.
4. Adopt the working rule: when Claude makes a mistake twice, the correction goes into `CLAUDE.md`.
5. Keep it under a page. Claude reads all of it at the start of a session, and anything stale is taking up context for no benefit.

## What it looks like

`plugin/template/CLAUDE.md` is the starting shape: Commands, Conventions, Architecture, Things Claude gets wrong, and the Verifying your work block from [test-feedback-loop.md](test-feedback-loop.md). The article's payments-service example is the reference for tone:

```markdown
## Things Claude gets wrong
- Do not bump dependency versions; the platform team owns them.
- The legacy v1/ package is frozen; changes go in v2/.
```

Do not put policy that must apply across repos here. That belongs in a skill ([build-skills.md](build-skills.md)). Do not put approval gates here. Those belong in hooks.

## Governance

The instructions the agent works to are reviewable and auditable because they are in git. Changes are logged in history and code owners approve them in PR review. Review findings feed back in: when a review flags the same mistake twice, the correction lands in `CLAUDE.md` as part of that review.

## How to measure it

- **Leading.** How often Claude repeats a mistake `CLAUDE.md` should have caught. Track corrections through the file's git history.
- **Lagging.** Time to first merged PR for a new team member, from PR history.

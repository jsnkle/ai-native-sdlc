# Plan mode as the default starting point

Stage 3, Build. Nothing is implemented without an accepted plan. Design review happens before any code is generated, when changing course is still a matter of editing a document.

## What changes

**Traditional.** An engineer reads the design and starts writing code. How the change will be made, down to which files and which tests, stays in the engineer's head or at best a ticket comment. Nobody else can review it. The first thing a reviewer sees is the finished diff, and by then rework is slow.

**AI-native.** Work starts with a written plan that Claude produces in plan mode, where it can read the codebase without changing anything. The engineer corrects the plan before code is written, and the approved version is committed as `plan.md` for later stages to check against.

## Who runs it

The engineer. A tech lead or architect approves plans for anything the organization classes as higher risk.

## Prerequisites

The intent artifact (`intent.md` or `spec.md`) if one exists. A `CLAUDE.md` helps ([build-claude-md.md](build-claude-md.md)).

## Infrastructure

Claude Code with access to the repository.

## How to execute it

1. Start the session in plan mode (`claude --permission-mode plan`, or press Shift+Tab until the mode reads "plan").
2. Give Claude `intent.md` and `spec.md` and ask for an implementation plan that names the files that change, the order of work, and the tests that prove it. `/ai-native-sdlc:plan <slug>` does this.
3. Interrogate the plan. What could the change break? Which step is most risky? What other options did Claude choose not to take?
4. Iterate until an engineer who has never seen the conversation could implement the change from the plan alone.
5. Commit the approved plan as `intent/<slug>/plan.md`. It joins the audit trail, and the PR review checks the eventual diff against it.
6. Accept the plan and let Claude implement. With a solid plan, implementation is often a single pass.
7. When implementation departs from the plan, update `plan.md` in the same commit. A hook can enforce this.

## What it looks like

`plan.md` has four headings: Files that change, Order of work, Risks, Proof. The `plan` skill in `plugin/skills/plan/SKILL.md` carries the template and the claims-status example from the article.

### Auto mode

Once the plan is accepted, Claude Code can run in auto mode, applying each change without a per-edit prompt. As the guardrails from the later plays mature (a tuned CLAUDE.md, skills that encode policy, hooks that block unsafe actions, a test suite Claude can run), auto mode becomes the default for routine work: a tight spec, a small blast radius, and code the tests already cover.

The shift is from watching the agent make edits to reviewing artifacts after longer autonomous sessions. Auto mode with worktrees is what makes parallel sessions practical ([build-parallel-sessions.md](build-parallel-sessions.md)) and is fundamental to running the loop headless ([maintain-closing-the-loop.md](maintain-closing-the-loop.md)).

## Governance

Plan mode enforces the review itself: Claude cannot edit files until the engineer accepts the plan. The plan and its revisions are logged along with who accepted it. Routine changes are approved by the engineer; higher-risk changes go to a tech lead or architect. The organization decides what "higher risk" means and writes it in `CLAUDE.md` or the review policy.

## How to measure it

- **Leading.** Share of changes that merge from the first implementation pass, and time from plan approval to merged PR, from PR metadata.
- **Lagging.** Rework cycles per change, from PR metadata, and how often the merged diff still matches the committed `plan.md`.

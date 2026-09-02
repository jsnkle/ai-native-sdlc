---
name: plan
description: In plan mode, turn intent.md and spec.md into a committed plan.md naming the files that change, the order of work, the risks and the proof. Use when an engineer asks for an implementation plan, or starts work on an accepted spec.
argument-hint: <change-slug>
---
Invoked as `/ai-native-sdlc:plan <change-slug>`, in plan mode. Work on
`intent/$ARGUMENTS/`; if no slug is given, list folders with a spec.md but no
plan.md and ask. Read the codebase, change nothing. Interview the engineer on
what could break, the riskiest step and the options not taken, then write
`intent/<slug>/plan.md`.

# Plan mode as the default starting point

Nothing is implemented without an accepted plan. Work in plan mode (read the
codebase, change nothing) until the engineer accepts. The approved plan is
committed as `plan.md` and later stages check the diff against it.

## Inputs

Read `intent/<slug>/intent.md` and `intent/<slug>/spec.md`. If no spec exists,
plan from the intent alone and say so at the top of the plan. Read `CLAUDE.md`
for commands, conventions and known mistakes. Read the code the spec touches.

## Interview the engineer

Ask, then answer in the plan:

- What could this change break? Which callers, consumers, contracts?
- Which step is the riskiest, and what makes it so?
- What other approaches were possible, and why were they not chosen?
- Which parts touch different files and could run as parallel sessions?

Iterate until an engineer who has never seen the conversation could implement
the change from the plan alone.

## Write the file

Plan mode cannot write files, and that is the point: nothing is written until
the engineer accepts. So the order is: draft the plan in plan mode, present it
for acceptance, and once plan mode exits make writing and committing
`intent/<slug>/plan.md` the first action, before any implementation. In a
non-interactive session there is no acceptance step; write the file directly
and say at the top of the plan that it was produced without review.

Path: `intent/<slug>/plan.md`. Use `references/plan-template.md`. The four
core sections are the article's: **Files that change**, **Order of work**,
**Risks**, **Proof**. Proof must be quantifiable so the session can verify
without asking: "all tests in `test_status.py` pass", "screenshot matches the
attached mock", "the endpoint returns 200 with the new field".

## Rules

- Commit `plan.md` before implementation begins. The plan joins the audit
  trail and the PR review compares the diff to it.
- **When implementation departs from the plan, update `plan.md` in the same
  commit.** Never let the diff and the plan disagree at merge.
- Routine changes are approved by the engineer. Anything the organisation
  classes as higher risk goes to a tech lead or architect before code.
- With a solid plan, implementation is usually one pass. If it is not, the
  plan was wrong; fix the plan, then the code.

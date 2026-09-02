# The artifact chain, on one page

Every stage ends by committing an artifact the next stage reads. Together
they are the audit trail: who asked for what, what the agent produced, who
approved it.

| Stage | Artifact | Path | Written by | Accepted by | Acceptance triggers |
|---|---|---|---|---|---|
| Plan | `intent.md` | `intent/<slug>/intent.md` | Originator + Claude (`intent`) | Product owner | Design pass |
| Design | `spec.md` | `intent/<slug>/spec.md` | Claude under policy skills (`spec`) | Product owner (+ tech lead if higher risk) | Plan mode |
| Build | `plan.md` | `intent/<slug>/plan.md` | Claude in plan mode (`plan`) | Engineer (+ tech lead if higher risk) | Implementation |
| Build/Test | diff + tests | the branch | Claude, verified by the feedback loop | CI | PR |
| Deploy | PR + review findings | the PR | Claude review passes per `REVIEW.md` | Code owner via branch protection | Pipeline |
| Maintain | incident record → new `intent.md` | `intent/<slug>/intent.md` | Monitoring trigger + Claude | Service owner triage | Plan, again |

Slug: short, lowercase, hyphenated, stable for the life of the change.
When another system is the source of truth, every artifact carries a
`Record:` line with its ID and that record carries the commit SHA.

## intent.md
Header: `Author`, `Status` (draft | accepted | closed), optional `Source`,
optional `Record`. Sections: **Problem**, **Proposed outcome**, **Affected
users and systems**, **Constraints**, **Open questions**.

## spec.md
Header: `Status`, `Policies applied`, optional `Record`. Sections:
**Summary**, **Requirements**, **Design** (Behaviour, Interfaces, Data,
Non-functional), **Acceptance criteria**, **Areas of concern**, **Open
questions** (each answered or carried forward), **Out of scope**.

## plan.md
Header: `Status`, accepted by whom and when. Sections: **Files that change**,
**Order of work**, **Risks**, **Proof** (quantifiable), **Options not taken**,
**Parallelisable**. If implementation departs from the plan, plan.md is
updated in the same commit.

## CLAUDE.md (per repo, under a page)
`## Commands` (each with healthy output) · `## Conventions` ·
`## Architecture` · `## Things Claude gets wrong` · `## Verifying your work`
(run build, test, lint before reporting done; paste output; fix the code,
not the test). Rule: a mistake made twice goes into CLAUDE.md.

## REVIEW.md (per repo)
`## Passes` (Bugs, Security, Compliance against spec.md, plan.md and design
principles) · `## What Important means here` · `## Cap the nits` ·
`## Do not report` (generated paths, anything CI already enforces).
Findings inform; approval comes from a human through branch protection.

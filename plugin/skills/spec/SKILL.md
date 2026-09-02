---
name: spec
description: Turn an accepted intent.md into a requirements-and-design spec.md, constrained by the organisation's policy skills, with areas of concern flagged. Use when a product owner asks for a spec, requirements, or design from an intent.
argument-hint: <change-slug>
---
Invoked as `/ai-native-sdlc:spec <change-slug>`. Work on
`intent/$ARGUMENTS/intent.md`; if no slug is given, list the folders under
`intent/` that have an intent.md but no spec.md and ask which one. Apply every
policy skill available. Write `intent/<slug>/spec.md` and lead the summary with
the areas of concern, especially where policies contradict.

# Requirements and design as spec.md

Requirements and design collapse into one session. You read the accepted
`intent.md`, apply the organisation's policies while writing, and produce a
`spec.md` the engineering team can plan against. The product owner reviews the
spec; they do not write it.

## Before writing

1. Read `intent/<slug>/intent.md`. Refuse politely if its status is not
   `accepted`; a spec against a draft intent is rework waiting to happen.
2. Load every policy skill available (brand, security, compliance, UX, API
   design, data classification). In this plugin `secure-api-review` is an
   example; the organisation replaces it with its own.
3. Read the codebase enough to know what exists: the systems named in the
   intent, the nearest existing feature, the conventions in CLAUDE.md.
4. If a design mock exists (Claude Design export, Figma link), read it and
   reference it.

## Write the file

Path: `intent/<slug>/spec.md`, alongside the intent. Use
`references/spec-template.md`.

Rules that matter:

- **Every open question from intent.md is answered or carried forward.** None
  disappear.
- **Flag concerns explicitly.** Wherever two policies conflict, a constraint
  cannot be met, or you had to guess, write it under *Areas of concern* with
  the policy or owner who has to resolve it. These are the points an analyst
  would have escalated; the product owner works them first.
- **Record what you applied.** List the skills in force by name so the
  version that constrained the spec is auditable.
- **Do not plan the implementation.** Files, order of work and tests belong in
  `plan.md`. Describe behaviour, interfaces, data, and acceptance criteria.

## After writing

- Summarise the flagged concerns first, then the rest.
- Commit `spec.md` next to `intent.md`. The pair records what was asked for and
  what was decided.
- Say what happens next: the product owner reviews, resolves concerns with the
  named policy owners, consults a tech lead for higher-risk changes, and their
  acceptance starts plan mode (`plan`).

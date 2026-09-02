---
name: intent
description: Capture an idea, problem, ticket or incident as a committed intent.md in the originator's own words. Use whenever someone wants to write up, brainstorm, or record what they want changed and why, before any spec or plan exists.
argument-hint: <a sentence describing the problem, or a ticket/incident ID>
---
Invoked as `/ai-native-sdlc:intent <description>`. The originator's starting
description is `$ARGUMENTS`; if empty, ask for it. Interview until the idea is
concrete, then write `intent/<slug>/intent.md` and read it back for correction.

# Capture as intent.md

An intent.md is a proto-spec: what is wanted, why, and under which constraints,
written in the originator's own terms. It is the first artifact in the chain
(intent → spec → plan → diff → PR → incident) and the file the next stage reads.
No formal language is required from the originator; you supply the structure.

## Interview first

Ask the questions an analyst would ask, a few at a time, until the idea is
concrete. Do not write the file until you can answer each of these from what
the originator said:

1. **Problem.** What can they not do today? What does it cost, and who pays it?
2. **Users and systems.** Who is affected? Which systems, services or teams are
   touched?
3. **Better looks like.** What is the proposed outcome, observable by a user?
4. **Constraints.** Security, compliance, budget, deadline, existing
   authentication, no new PII, and anything out of scope.
5. **Success.** How would they know it worked?
6. **Open questions.** What could they not answer? Record it rather than guess.

If the intent arrives from an incident, ticket or monitoring breach instead of
a person, fill the same sections from the evidence and mark `Status: draft`
with the source in the header. The product owner corrects it before commit.

## Write the file

Path: `intent/<change-slug>/intent.md`, where the slug is short, lowercase and
hyphenated, for example `claims-status-self-service`. Create the folder if it
does not exist. If the project keeps its record in Jira or another system,
add a `Record:` line in the header with the ID (see `docs/source-of-truth.md`).

Use `references/intent-template.md` exactly. Keep each section short; a
paragraph or a few bullets. Plain language the originator would recognise.

## After writing

- Read it back to the originator and correct anything misunderstood.
- Commit it. Author and timestamp join the record through git.
- Say who picks it up next: the product owner accepts or closes it, and
  acceptance is what triggers `spec`.

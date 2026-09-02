# Capture as intent.md

Stage 1, Plan. Ideas stop waiting for someone to write them up. Intent is captured once, in the originator's own words, as a version-controlled artifact the next stage can act on.

## What changes

**Traditional.** An idea passes through backlog entries, user stories, story points, and refinement meetings before anyone can act on it. Ownership transfers at each handoff, so what reaches engineering is several steps removed from what the originator meant. The person with the idea has to convince someone on the product team to write it up with them or on their behalf.

**AI-native.** The originator brainstorms with Claude and writes the result down as `intent.md`, a proto-spec in their own terms. It says what is wanted, why, and under which constraints. It is human readable, version controlled, and immediately consumable by the next stage. Repeat processes are encoded as skills.

An intent can enter by three routes: a person has an idea, a ticket is filed, or an incident surfaces from an alert (see [maintain-closing-the-loop.md](maintain-closing-the-loop.md)). Whichever route, the same rule applies: the product owner reviews and corrects the agent-written intent before it is committed.

## Who runs it

The originator, who can be anyone in the organization and needs no engineering skill. The product owner accepts or closes it. A technical team member sets up the home once.

## Prerequisites

None.

## Infrastructure

- Claude access for people who are not engineers (claude.ai or Cowork).
- An agreed intent template. In this repo it is the `intent` skill in the plugin.
- A shared, version-controlled home that the product owner watches. For a single product it is the `intent/` folder in the product repo, which keeps the artifact chain next to the code derived from it. A dedicated intent repo is only worth it when intent spans many repositories.
- A connector from claude.ai or Cowork to the version-control system, so contributors without git experience can have Claude commit on their behalf.

Standing up the home and deciding who can write to it is a one-time job for the platform or engineering team. If Jira already holds the record, read [../source-of-truth.md](../source-of-truth.md) before choosing where intent lives.

## How to execute it

1. The originator describes the problem to Claude in their own words: what they cannot do today, who is affected, what better looks like, what is out of scope. No formal language is required.
2. Brainstorm until the idea is concrete. Claude asks the questions an analyst would ask: scope, users, constraints, what success looks like.
3. Ask Claude to write the result as `intent.md` using the organization's template. In Claude Code that is `/ai-native-sdlc:intent`; in claude.ai or Cowork the `intent` skill is attached to the project.
4. The originator corrects anything Claude misunderstood.
5. Commit to `intent/<slug>/intent.md`. Author and timestamp join the record. The product owner picks the idea up from there.

## What it looks like

An intent has five headings: Problem, Proposed outcome, Affected users and systems, Constraints, Open questions, plus an author line and a status. The `intent` skill in `plugin/skills/intent/SKILL.md` carries the template and a worked example. `plugin/template/intent/README.md` explains the folder and the slug convention.

```markdown
# Intent: claims status self-service
Author: J. Ortiz (claims operations). Status: draft.

## Problem
Customers phone the contact center to ask where their claim is.
Handlers spend roughly a third of call time on status-only queries.
```

## Governance

The evidence is the committed `intent.md`: author, timestamp, full revision history, all in git. The product owner approves, and the accept or reject decision that sends the intent to design is recorded as the merge or the closed review. Nothing enters the loop without that decision.

## How to measure it

- **Leading.** Time from first conversation to a committed `intent.md`, read from git history. Expect a multi-week elicitation cycle to fall to hours.
- **Lagging.** Survival rate: the share of intents the product owner accepts into design rather than closes. Also the number of changes to `intent.md` made after the first `spec.md` commit for the same change, which should be near zero.

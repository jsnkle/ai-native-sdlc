# Requirements and design

Stage 2, Design. Requirements and design collapse into one session. Policy is applied while the spec is written, not discovered in a review weeks later.

## What changes

**Traditional.** Requirements and design are separate phases run by separate teams. Analysts formalize the idea into requirements and designers parse those back into a design. The separation exists for accountability, but it is slow and lossy.

**AI-native.** Both happen in a single prompted session. Claude takes the accepted `intent.md` and produces a requirements and design spec, constrained by the organization's skills for brand, security, compliance, and UX, with areas of concern flagged. The product owner reviews the spec but does not write it. The goal is a spec the engineering team can plan against.

Front-end work is the clearest case. Once the intent is accepted, the product owner mocks the design up in Claude Design from the intent, iterates, and exports it to Claude Code to build.

## Who runs it

The product owner. No engineering skill is required. A technical lead is consulted for anything the organization classes as higher risk.

## Prerequisites

An accepted `intent.md`, and the organization's brand, security, compliance, and UX policies written as skills ([build-skills.md](build-skills.md)). Without the skills the spec is still useful, but the policy checks that make this play worth it are missing.

## Infrastructure

A product owner with Claude access and the organization's skills available. Later, CI that can run Claude non-interactively (see [deploy-cicd.md](deploy-cicd.md)).

## How to execute it

1. Open a session with the organization's skills available and attach `intent.md`.
2. Prompt for the spec: point at the intent, name the constraints, and demand flagged concerns. Run this by hand at first, then use `/ai-native-sdlc:spec`. Once the prompt is stable, make acceptance of the intent the trigger: `plugin/template/.github/workflows/spec-on-intent-merge.yml` runs the pass on merge and opens `spec.md` as a PR. From then on the product owner's first involvement is the review.
3. Review the spec against the idea. Does it solve the stated problem? Are the open questions from the intent answered or carried forward?
4. Work through the flagged concerns first. They are the points an analyst would have escalated. Resolve each with its policy owner before engineering sees the spec.
5. Commit `spec.md` alongside `intent.md` in `intent/<slug>/`. The pair records what was asked for and what was decided.
6. Decide whether the spec progresses to build. A human always makes this call. Accepting the spec is what starts plan mode.

## What it looks like

The prompt, in full:

> Read the attached intent.md and produce a requirements and design spec for integrating it into our existing codebase. Apply the skills available to you so the plan conforms to our brand guidelines, security policies and UX standards. Document the spec fully as spec.md, ready to hand to the engineering team. Describe clearly any areas of concern, especially where you cannot satisfy contradicting policies.

The `spec-format` skill in `plugin/skills/spec-format/SKILL.md` carries the output structure. `/ai-native-sdlc:spec` wraps the prompt.

## Governance

The live policy is read and applied while the spec is written. The spec, the prompt that produced it, and the skill versions in force are all in version control. The product owner signs off the spec and routes flagged concerns to the named policy owners. Nothing about this play changes who is accountable; it moves the policy check from a review weeks later to the moment of writing.

## How to measure it

- **Leading.** Elapsed time between the `intent.md` commit and the `spec.md` commit for the same change, two git timestamps, compared with the old requirements-plus-design cycle.
- **Lagging.** Requirements rework after build starts: count `spec.md` commits dated after the first `plan.md` commit for the same change. `git log` gives this directly.

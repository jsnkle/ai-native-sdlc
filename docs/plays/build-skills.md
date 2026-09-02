# Skills as institutional knowledge

Stage 3, Build. Skills are how an organization makes its institutional knowledge operational: explicit, version controlled, applied broadly, updated centrally when policy changes.

## What changes

**Traditional.** A policy lives in a document its owner maintains. Whether it is applied depends on whether the engineer remembered it and whether the reviewer checked. Enforcement is inconsistent and the gap only shows up in review, weeks after the code was written.

**AI-native.** The policy is written as a skill: a folder containing a `SKILL.md` whose frontmatter says when it triggers and whose body says what to do. Claude loads it when the task matches and applies the policy while the code is written. When the policy changes, the skill changes, and every engineer picks up the new version in their next session.

The rule of thumb: write a skill for institutional knowledge that must be applied consistently. Do not write a skill for something that belongs in `CLAUDE.md` or a prompt.

## Who runs it

An engineer writes the skill from the policy owner's source of truth, using Claude to help. The policy owner signs off changes.

## Prerequisites

None. A `CLAUDE.md` helps because it keeps the agent's working knowledge in the repo, but a skill does not depend on it.

## Infrastructure

One policy with a named owner and a written source of truth.

## How to execute it

1. Pick one piece of knowledge that is enforced inconsistently today: a security standard, an API design convention, a brand rule.
2. Write it as a skill. The frontmatter `description` says when it triggers; the body says what to do, step by step, and names any script to run.
3. Decide where it lives. Policy shared across projects goes in the plugin at `plugin/skills/<name>/`, so every repo that installs the plugin gets it and updates arrive centrally. Policy specific to one repo goes in that repo at `.claude/skills/<name>/`.
4. Test that it triggers. Ask Claude to do the relevant task several different ways and confirm the skill loads each time.
5. When the policy changes, change the skill and have the policy owner sign off the change.

## What it looks like

`plugin/skills/secure-api-review/SKILL.md` is the article's example, an API security standard with four numbered rules and a script to run. The format skills in the same folder (`intent`, `spec`, `plan`) are skills too: they encode the organization's artifact templates so every intent, spec, and plan has the same shape.

## Governance

A skill is a control, but an advisory one. It makes Claude likely to apply the policy while the code is written; nothing forces a session to comply. A policy that must always hold needs something deterministic behind the skill: a hook that blocks the action ([build-hooks-guardrails.md](build-hooks-guardrails.md)) or a review pass that re-checks it at the PR ([deploy-pr-review.md](deploy-pr-review.md)). The skill makes violations rare and the hook makes them close to impossible.

Skill invocations are logged in session traces. The policy owner reviews skill changes like code.

## How to measure it

- **Leading.** Time from the policy owner approving a policy change to the updated skill merging, from the PR on the skill folder.
- **Lagging.** PR review findings that cite the policy, which should fall toward zero once the skill applies it during writing. Where they do not fall, either the skill is not triggering or its text has drifted from the official policy.

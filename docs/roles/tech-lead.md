# Tech lead

You own the quality of what the agent works to and the policy it is reviewed against. You are the code owner who approves PRs, and the person the product owner and engineers escalate anything higher-risk to.

## Plays you own

- [PR review loop](../plays/deploy-pr-review.md). You write `REVIEW.md`: the passes, what Important means, the nit cap, what to skip. You set the human threshold and tune findings monthly.
- [Skills](../plays/build-skills.md). You work with each policy owner to get their policy written as a skill, and you decide what belongs in a skill versus `CLAUDE.md` versus a hook.
- [CLAUDE.md](../plays/build-claude-md.md), as the code owner who reviews changes to it and enforces the "under a page" rule.
- Risk classification. You define what "higher risk" means for this codebase so engineers and the product owner know when to escalate.

## What you approve

- **PRs**, through branch protection, as code owner. Findings inform your decision; they never make it. You review for intent and risk, because the mechanical checks are already attached.
- **Higher-risk plans and specs.** The product owner consults you on a spec; the engineer brings you a plan. You approve or send it back.
- **Skill and `CLAUDE.md` changes**, reviewed like code, with the policy owner's sign-off on skill changes.

## What you never do

- Let findings approve or block a PR on their own. A human approves every merge.
- Review line by line. That is the agent's job and it does it identically on every PR. Your attention is on whether the change does what `plan.md` said and whether the risk is acceptable.
- Leave a repeated mistake in review comments. The second time a review flags the same thing, the correction goes into `CLAUDE.md` as part of that review.

## A day in the life

Three PRs are waiting, each with ranked findings from the three passes in `REVIEW.md`. The first has one Important finding under Compliance: the diff added a field the spec did not ask for. You send it back with a comment pointing at `spec.md`; the engineer's session will address it. The second is clean and matches its plan; you approve it in two minutes. The third has the same PII-in-logs nit you saw last week, so you add a line to `CLAUDE.md` in the same review and approve. In the afternoon the product owner brings a spec flagged as higher risk because it touches authentication; you read the concern, agree with the proposed resolution, and it goes to plan mode. Last thing, you rate this month's findings so the reviewer improves and lower the nit cap to five.

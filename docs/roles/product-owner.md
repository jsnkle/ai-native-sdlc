# Product owner

You own the front of the loop: what gets built and why. You do not need Claude Code, git skills, or any engineering background. You need Claude access (claude.ai or Cowork), the organization's skills attached, and a watch on the `intent/` folder.

## Plays you own

- [Capture intent.md](../plays/plan-intent.md). Anyone can originate an intent; you are the one who reviews, corrects, and accepts or closes it.
- [Requirements and design](../plays/design-spec.md). You run the session that produces `spec.md`, review it against the idea, and resolve every flagged concern with its policy owner.

## What you approve

- **Intent.** The merge of `intent/<slug>/intent.md` is your acceptance. Closing the review is your rejection. There is no third state; an intent that sits unreviewed is a queue you own.
- **Spec.** Your sign-off on `spec.md` is what starts plan mode. For anything the organization classes as higher risk you consult the tech lead first, but the call is yours.
- **Findings that reach you from the loop.** When a control-band breach, a scan, or a tagged ticket produces a product-facing `intent.md`, the on-call engineer routes it to you and you decide: fix now, schedule, or dismiss.

## What you never do

- Write the spec yourself. Claude writes it from the intent under the organization's skills; you review it. If you are editing the spec heavily, the intent was not clear enough or a skill is missing.
- Approve a PR. Once the spec is accepted, the diff is the engineering team's and the code owner's.
- Skip a flagged concern. The concerns are the points an analyst would have escalated. Each one is resolved with its policy owner before engineering sees the spec.

## A day in the life

You open your Claude project and find two new intents committed overnight: one from a claims handler who brainstormed it in Cowork, one written by the agent after the CI failure rate tripped a band. You read the handler's intent, fix a mis-stated constraint, and merge it. The spec job fires on the merge and forty minutes later a PR with `spec.md` is waiting. It flags one concern: the security skill says no new PII in the portal session, and the intent asks for a claim adjuster's name to be shown. You take that to the security lead, agree to show a role rather than a name, and note the decision in the spec before signing off. The agent-written intent about the CI failure rate is not product-facing; you mark it for the tech lead and move on. Nothing today required a meeting.

# Review instructions

Applied to every PR by the Claude review pass. Findings inform the code owner; they do not approve or block on their own. Branch protection still requires a human approval.

## Passes

Run three passes and tag each finding with its pass:

- **Bugs:** logic errors, broken edge cases, subtle regressions.
- **Security:** injection risks, authentication gaps, PII in logs.
- **Compliance:** the change matches `intent/<slug>/spec.md`, `intent/<slug>/plan.md` and our design principles. If the diff departs from `plan.md` and `plan.md` was not updated in the same PR, that is an Important finding.

## What Important means here

Reserve Important for findings that would break behavior, leak data or breach a policy. Style and naming are nits.

## Cap the nits

Report at most five nits per review; summarize the rest as a count.

## Do not report

- Generated files under <!-- e.g. src/gen/ -->.
- Anything CI already enforces (formatting, lint, dependency audit).

## Feedback into CLAUDE.md

When a finding flags a mistake for the second time, the correction goes into `CLAUDE.md` as part of the same PR. Also flag when a change has made `CLAUDE.md` outdated.

## Tuning

Once a month the tech lead rates findings, adjusts the nit cap, and prunes anything CI has since taken over.

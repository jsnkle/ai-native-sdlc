# Platform engineer

You own the controls that run without anyone watching: hooks, managed settings, the pipeline, the eval suite, and the detection script. When there are twenty sessions running in parallel, your configuration is what governs all of them.

## Plays you own

- [Hooks as guardrails](../plays/build-hooks-guardrails.md) and [hooks as approval gates](../plays/deploy-approval-gates.md). You turn the list of non-negotiables into scripts that allow, ask, or block, and put the ones engineers must not override in managed settings (`org/`).
- [Continuous evals](../plays/test-continuous-evals.md). You build the suite from real tasks and gate configuration changes on it.
- [CI/CD integration](../plays/deploy-cicd.md). You put `claude -p` into the pipeline, sandbox it, expose deployment through MCP, and make rollback the most rehearsed path.
- [Closing the loop](../plays/maintain-closing-the-loop.md). You write the deterministic detection script and the tiered response config.
- The intent home and the marketplace. You stand up `intent/`, decide who can write to it, and host the plugin so every repo gets the same skills.

## What you approve

- **Configuration changes**, gated on eval results. A skill or `CLAUDE.md` change that drops the pass rate gets reviewed before it merges.
- **Which hooks are managed.** You and IT decide which controls live in managed settings that no engineer, project file, or flag can widen.
- **Runbooks the agent may trigger.** Anything the 3σ tier is allowed to run was approved by you in advance.

## What you never do

- Give the agent a route past the production gate. In every environment the agent prepares; in production a named release manager authorizes, and the hook enforces it.
- Let a non-interactive run hold standing production credentials. Short-lived scoped tokens, sandboxed containers, no exceptions.
- Put a model in the detection path. Detection is deterministic and unit tested; Claude is invoked only once a band is breached, and the tier sets what it may do.
- Put an approval prompt in a build-phase hook. That puts a person back on the critical path of every parallel session.

## A day in the life

Overnight the CI failure-rate detector logged a 2σ breach and invoked Claude read-only. Its diagnosis is waiting as an `intent.md`: a flaky integration test introduced last Tuesday. You route it to the owning team and add the case to the eval suite so the configuration is tested against it from now on. A PR changing the secure-api-review skill is open; the evals ran on it and the pass rate held, so you approve. Then you finish the staging rollback rehearsal, which has to be proven before the 3σ tier is allowed to call it. The hook logs show the production gate blocked one attempt yesterday, with the reason and the approval route in the agent's output, which is exactly what it is for.

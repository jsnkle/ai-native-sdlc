# Hooks as approval gates

Stage 5, Deploy. Governance is enforced as the agent acts. The agent does everything up to the production gate and nothing past it.

## What changes

**Traditional.** Approvals happen in review cycles: a change board that meets weekly, a release manager who signs a form, an email thread. Whether a gate was honored is reconstructed after the fact.

**AI-native.** A hook can allow, block, or *ask*, pausing the action until a specific person approves. The gate condition is enforced every time, for everyone, and each decision is logged with a timestamp.

The build phase used hooks as guardrails that allow or block with no human involved ([build-hooks-guardrails.md](build-hooks-guardrails.md)). This play is the hook that asks. It sits in Deploy because the release gate is the clearest case, but hooks run wherever Claude acts: they can block edits to migrations and infrastructure without a change ticket during build, or stop the agent editing tests during a fix.

## Who runs it

Engineering leadership, with change management and compliance, decides which gates must survive. The platform engineer expresses each as a hook.

## Prerequisites

None.

## Infrastructure

A written list of the approvals the change process requires.

## How to execute it

1. List the human approval gates that must survive: change management sign-off, release authorization, edits to protected paths.
2. Express each as a hook, a script that runs before Claude acts and can allow, ask, or block.
3. Put team hooks in `.claude/settings.json` in git. Put non-negotiable hooks in managed settings owned by the platform or IT admin, where individual engineers cannot switch them off.
4. Make every block explain itself. When a hook stops an action, the reason and the route to approval appear in Claude's output.

## What it looks like

`plugin/template/.claude/hooks/production-gate.sh` is the article's gate: it reads the command Claude is about to run, and if it looks like a production deploy and no release authorization is present, exits 2 with a message. `plugin/template/.claude/settings.json` wires it to `PreToolUse` on `Bash`.

### Managed settings for a regulated enterprise

The article's worked example is a managed settings file deployed by the platform team via MDM or the admin console that engineers cannot edit or override. `org/managed-settings.example.json` carries it with a line-by-line explanation. In control terms:

- `permissions.deny` keeps secrets out of the agent's context and blocks arbitrary network egress through tools; `permissions.allow` pre-approves the safe inner loop so the deny list does not become prompt fatigue.
- `disableBypassPermissionsMode` and `allowManagedPermissionRulesOnly` mean no engineer, project file, or flag can widen the rules.
- `sandbox` closes the gap permissions cannot: an OS-level domain allowlist blocks egress outright, `failIfUnavailable` refuses to start without it, and `credentials` denies reads of `~/.ssh` and `~/.aws` and strips named secrets from the environment.
- `allowManagedHooksOnly` means the approval gates are the only hooks that run.
- `disableSideloadFlags`, `strictKnownMarketplaces`, and `allowManagedMcpServersOnly` mean every skill, agent, hook, and MCP server arrived through the approved marketplace.
- `requiredMinimumVersion` refuses to start below the assessed floor.

Treat it as a starting point to tailor. Every deny trades against capability, and the right balance depends on the data classification of the repo.

## Governance

Hooks are the approval gates. The gate condition is enforced every time, for everyone. Allow and block decisions are logged with a timestamp. The gate also defines what counts as approval, whether an approved change ticket or the release manager's sign-off.

## How to measure it

- **Leading.** Time spent waiting on each gate. Every hook decision goes to the OpenTelemetry export with a timestamp and a verdict, so the wait is visible per gate.
- **Lagging.** Gate violations reaching production before and after hooks, from the incident tracker.

## Ready, not adopted

**Gate deploys by where they go, not by the words in the command.** `production-gate.sh` blocks a command only when it contains both "deploy" and "production". This is predicted, not observed: there has been no real deploy target to gate (see the [2026-09-03 retrospective](../retrospective-2026-09-03.md)). Constructed commands run through the hook on 2026-09-26 show the risk. `kubectl apply -f k8s/ -n prod`, `helm upgrade api ./chart --kube-context prd` and `fly deploy -a claims-prd` all passed, and `grep -rn deploy docs/production.md` was blocked.

The proposal has two parts, in this order:

1. **In code.** Every deploy goes through one named entry point that takes the environment as an argument, such as `make deploy ENV=production` or an MCP deploy tool, and the gate matches that entry point exactly. `permissions.deny` refuses direct `kubectl`, `helm` and cloud CLI calls, so the entry point is the only route. The retrospective already lists this for when there is a deploy target.
2. **Optional: a second check that can only add friction.** For a Bash command the rule allows, a decision model answers "Could this command change a production system?". [TypeSafe](https://docs.typesafe.ai)'s Jev, asked a Noul question, returns the probability of yes in about 100 ms. Above a threshold the hook returns `ask`, so a person confirms. It never allows what the rule blocks. Jev's documentation says text written to mislead can shift its answers. Used this way, a misled answer only loses the extra check; the rule still holds.

If it is adopted:

- Adopt part 1 when the project has a real deploy target. Adopt part 2 only if commands the entry point cannot see keep reaching production.
- A non-interactive run has nobody to confirm, so there `ask` should block.
- Pin the model version, and make part 2 opt-in. Without `TYPESAFE_API_KEY`, or when the call fails, the hook applies the rule alone. It runs on every Bash call, so measure the added latency.
- Every command goes to a third party, and commands can carry hostnames and sometimes an inline token. That is a data-handling decision for any company fork.

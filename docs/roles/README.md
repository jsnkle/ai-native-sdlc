# Roles

The process does not remove any role. It moves each role's attention from producing the artifact to reviewing what the agent produced and deciding at the gate. This folder says, for each role, which plays they own, what they approve, and what they never do.

| Role | Owns | Approves | Never |
|---|---|---|---|
| [Product owner](product-owner.md) | Intent and spec | Accepts intent; signs off spec; decides what goes to build | Writes code; approves a PR |
| [Engineer](engineer.md) | Plan, implementation, verification | Approves routine plans | Merges without a code owner; edits a test to make a fix pass |
| [Tech lead](tech-lead.md) | Review policy, CLAUDE.md quality, risk classification | Higher-risk plans and specs; PRs as code owner; skill changes | Lets findings approve or block on their own |
| [Platform engineer](platform-engineer.md) | Hooks, managed settings, pipeline, evals, detection | Configuration changes gated on eval results | Gives the agent a route past the production gate |

Two roles appear in the plays but are not written up here because they act through the roles above: the **policy owner** (security, brand, compliance, UX) who signs off the skill that encodes their policy, and the **release manager** who authorizes a production deploy through the gate hook.

The agent has a row too, and it is short. The agent writes every artifact, verifies its own work, reviews every PR, and diagnoses every breach. It approves nothing.

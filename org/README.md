# org/ — what lives outside any repo

Some controls apply to every engineer and every repo, and must not be editable from inside a project. They are deployed by the platform or IT team, not copied by `scripts/new-project.sh`.

| Item | Where it lives | Owner |
|---|---|---|
| Managed settings (`managed-settings.example.json`) | MDM or the Claude admin console (server-managed settings) | Platform / IT admin |
| The plugin marketplace (`marketplace.md`) | A git repo the org controls; this one, or a fork | Platform team |
| Model access route | API keys, or Bedrock / Vertex / Foundry on the org's cloud agreement | Platform team |
| OpenTelemetry export | The org's observability stack; hook decisions, session traces and skill invocations land here | Platform team |
| Claude Security schedule, seats, spend limit | claude.ai admin settings | Security lead |
| Claude Tag | Slack workspace | Platform team |

Team-level controls (hooks in `.claude/settings.json`, `REVIEW.md`, protected paths) live in each repo and are reviewed like code. The line between the two: a control an engineer must never be able to switch off goes here.

References, in rollout order: admin setup, settings reference, server-managed settings, permissions, sandboxing, hooks, plugin marketplaces, managed MCP, third-party integrations, monitoring. All under code.claude.com/docs/en/.

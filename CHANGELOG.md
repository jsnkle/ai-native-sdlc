# Changelog

All notable changes to the plugin and template are recorded here. The plugin version in
`plugin/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` moves together.

## 0.1.0 - 2026-09-02

Initial skeleton derived from Anthropic's "The AI-Native SDLC playbook" (August 2026).

- `docs/`: the methodology for humans, one file per play.
- `plugin/`: skills, agents, commands and generic hooks installed into every project.
- `plugin/template/`: per-repo files copied into a new or existing project.
- `brownfield/`: the adoption runbook for existing repositories.
- `org/`: managed settings and marketplace hosting, owned outside any repo.
- `scripts/new-project.sh`: greenfield bootstrap.

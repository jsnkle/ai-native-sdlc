# Hosting the plugin marketplace

The `ai-native-sdlc` plugin is how skills, agents, slash commands and generic hooks reach every project on one version. A marketplace is just a git repo with `.claude-plugin/marketplace.json` at its root listing the plugins it serves. This repo is one.

## Using this repo as the marketplace

For each engineer, or once per repo via `.claude/settings.json` (`plugin/template/.claude/settings.json` already does this):

```
/plugin marketplace add jsnkle/ai-native-sdlc
/plugin install ai-native-sdlc@jsnkle
```

Updates: bump `version` in `plugin/.claude-plugin/plugin.json` and in `marketplace.json`, merge, and engineers pick it up on `/plugin marketplace update` or their next session.

## Forking for an organization

1. Fork or mirror this repo into the org's git host, e.g. `example-corp/approved-plugins`.
2. Change the marketplace `name` in `.claude-plugin/marketplace.json` (it becomes the suffix in `ai-native-sdlc@<name>`), and `extraKnownMarketplaces` in `plugin/template/.claude/settings.json` to match.
3. Add the org's own policy skills (brand, security, compliance, UX) to `plugin/skills/`. Each has a named policy owner who signs off changes.
4. Review changes to the plugin like code: the policy owner approves skill changes, the tech lead approves agent and command changes.

## How `strictKnownMarketplaces` interacts

In managed settings, `strictKnownMarketplaces` lists the only marketplaces engineers may add. With `disableSideloadFlags`, nothing can be loaded from a home directory either. Together they mean every skill, agent, hook and MCP server on a machine came through the org's marketplace. The entry must match the marketplace source exactly:

```json
"strictKnownMarketplaces": [ { "source": "github", "repo": "example-corp/approved-plugins" } ]
```

If the marketplace is on a private git host, use the `git` source form with the clone URL. When the setting is on and the repo's `extraKnownMarketplaces` names a marketplace not in the list, the plugin will not install; the fix is in managed settings, not in the repo.

## Plugin versus per-repo files

Ships in the plugin: intent/spec/plan formats, the adopt skill, policy skills, the verifier/simplifier/researcher agents, slash commands, and hooks that apply to every repo (lock test files during a fix task, keep secrets out of the diff).

Stays in the repo: `CLAUDE.md`, `REVIEW.md`, `intent/`, project hooks (production gate, protected paths, formatter), workflows, evals, `ops/bands.yaml`. See `plugin/template/README.md`.

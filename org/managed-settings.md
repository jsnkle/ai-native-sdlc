# Managed settings for a regulated enterprise

`managed-settings.example.json` is deployed by the platform team via MDM or the admin console. Engineers cannot edit or override any of it. It is a starting point to tailor, not a recommendation to copy: every deny trades against capability, and the right balance depends on the data classification of the repo.

## What each line buys, in control terms

- **`permissions.deny`** keeps secrets out of the agent's context and blocks arbitrary network egress through tools.
- **`permissions.allow`** pre-approves the safe inner loop so the deny list doesn't turn into prompt fatigue.
- **`disableBypassPermissionsMode`** plus **`allowManagedPermissionRulesOnly`** means no engineer, project file or command-line flag can widen the rules.
- **`sandbox`** closes the gap permissions cannot. A tool-level deny on WebFetch doesn't stop a shell command reaching the network; the OS-level domain allowlist blocks egress outright.
- **`failIfUnavailable`** and **`allowUnsandboxedCommands: false`** make the sandbox a gate: Claude Code refuses to start when the sandbox cannot initialize, and a command that fails inside the sandbox cannot be retried outside it.
- **`credentials`** closes the gap the deny rules leave open. `permissions.deny` governs Claude's file tools, but a sandboxed shell command could still read `~/.ssh` or `~/.aws/credentials` by default; this block denies those reads and strips the named secrets from the environment of every sandboxed command.
- **`allowManagedHooksOnly`** means the approval gates from the hooks play are the only hooks that run; nothing local can add to or replace them. Note the consequence: the per-repo hooks in `plugin/template/.claude/settings.json` will not run under this setting. Move the ones that must hold into managed settings, and accept that the rest become advisory.
- **`disableSideloadFlags`** and **`strictKnownMarketplaces`** mean every skill, agent, hook and MCP server on an engineer's machine arrived through the organization's approved plugin marketplace, never from a home directory.
- **`allowManagedMcpServersOnly`** makes the agent's tool surface an allowlist owned by the platform team.
- **`requiredMinimumVersion`** refuses to start on a version below the approved floor, so the controls are enforced by a build the organization has actually assessed.

The settings reference documents every key, including the managed-only ones: code.claude.com/docs/en/settings

## Measuring the gates

- Leading: time spent waiting on each approval gate. Every hook decision is written to the OpenTelemetry export with a timestamp and an allow or block verdict.
- Lagging: gate violations reaching production before and after hooks, from the incident tracker.

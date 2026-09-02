# Source of truth

Existing SDLC processes already track artifacts, just not in markdown files. Work items are in Jira, requirements in a tool with regulatory traceability built in, designs in Figma, change approvals with a change board. Those systems are hard to displace because auditors and regulators already accept them and other teams depend on them. The AI-native SDLC has to fit around what exists.

The rule: for every artifact the process produces, name one system as the source of truth. Everything else holds a copy or a link to the original. The choice can differ per artifact.

## The three configurations

**The repo as the source of truth.** The markdown artifacts in `intent/<slug>/` are the authoritative record and the legacy system references files within commits. This is the cleanest configuration for engineering-led organizations: all records in one tool with one timestamp authority. A Jira ticket, if one exists, carries the commit SHA and a link.

**The legacy system as the source of truth.** Jira, ServiceNow, or the requirements tool holds the authoritative record and the markdown artifacts are working copies. Claude reads the record at the start of the session through an MCP connector and writes the outcome back through the same connector, in the same session that produced the spec or the plan. The markdown file in the repo is what the next stage reads, but if the two disagree the tool wins.

**Linkage as the minimum bar.** All artifacts note the record ID and all legacy records contain the commit SHA of the markdown file. This accepts two sources of truth in exchange for changing nothing about the existing system. It is a good place to start a brownfield adoption, and many teams never need to go further.

Both systems can coexist as long as there is a link between them or one is declared the source of truth.

## Deciding

Ask, per artifact:

1. Does an auditor or regulator already expect to find this in a specific tool? If yes, that tool is the source of truth or at minimum holds the link.
2. Does another team read this from a specific tool? If yes, the same.
3. Is there an MCP connector for the tool? If yes, the legacy-system configuration is practical. If no, linkage.
4. Who owns the timestamp? For the survival-rate and cycle-time metrics in [metrics.md](metrics.md), git timestamps are the easiest to read. If the legacy system is authoritative, make sure its timestamps are exportable.

## Decision record

Each project records its decision in `intent/README.md` (the template has a placeholder). Fill in one row per artifact:

```markdown
## Source of truth

| Artifact | Source of truth | Link held in | Connector |
|---|---|---|---|
| intent.md | repo (`intent/<slug>/`) | Jira epic carries commit SHA | none needed |
| spec.md | repo | Jira epic | none needed |
| plan.md | repo | Jira story | none needed |
| PR and findings | GitHub | Jira story carries PR URL | GitHub app |
| Change approval | ServiceNow | PR description carries CHG number | MCP: servicenow |
| Incident record | PagerDuty | intent.md carries incident ID | MCP: pagerduty |

Decided by: <name>, <date>. Revisit when: <trigger>.
```

Do not leave a row blank. An artifact with no declared source of truth is the one that will be wrong in the audit.

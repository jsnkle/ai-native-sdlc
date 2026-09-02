# intent/ — the artifact chain

This folder is the version-controlled home for what was asked for, what was decided, and how it was built. It sits next to the code derived from it so the git history is the audit trail: who asked for what, what the agent produced, and who approved it.

## Layout

One folder per change, named with a short slug:

```
intent/
  claims-status-self-service/
    intent.md   # Stage 1 Plan: the originator's proto-spec
    spec.md     # Stage 2 Design: requirements + design, policy applied
    plan.md     # Stage 3 Build: files, order of work, risks, proof
```

`_example/` shows a complete chain. Delete it once you have a real one.

## Lifecycle

| Step | Artifact | Written by | Accepted by | Acceptance triggers |
|---|---|---|---|---|
| 1 | `intent.md` (status: draft) | Originator with Claude (`/ai-native-sdlc:intent`) | Product owner, on merge | The spec pass |
| 2 | `spec.md` | Claude from the accepted intent (`/ai-native-sdlc:spec`), org skills loaded | Product owner; tech lead for higher-risk changes | Plan mode |
| 3 | `plan.md` | Claude in plan mode with the engineer (`/ai-native-sdlc:plan`) | Engineer; tech lead or architect for higher-risk changes | Implementation |
| 4 | the diff, tests, PR | Claude, verified by the feedback loop | Code owner via branch protection, informed by `REVIEW.md` findings | The pipeline |
| 5 | incident record → new `intent.md` | Monitoring agent or on-call | Service owner triage | Back to step 1 |

Acceptance is a merge. Rejection is a closed PR with the reason in the review. Both are logged.

Run each step by hand at first. Once the format is stable, `.github/workflows/spec-on-intent-merge.yml` fires the spec pass automatically when an intent merges.

## Source of truth

Decide once per project and record it here:

- [ ] **Repo is the source of truth.** These files are authoritative; Jira/ServiceNow/requirements tools hold a link to the commit.
- [ ] **Legacy system is the source of truth.** Jira holds the record; these files are working copies. Claude reads the record at the start of the session and writes the outcome back through the MCP connector.
- [ ] **Linkage only.** Two sources of truth, always cross-referenced.

Minimum bar regardless of choice: every `intent.md` carries the record ID (`Record: PROJ-123`) and the record carries the commit SHA of the file.

**This project's decision:** <!-- fill in -->

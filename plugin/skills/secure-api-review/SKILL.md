---
name: secure-api-review
description: EXAMPLE policy skill from the playbook. Apply the API security standard. Use whenever creating or modifying an external-facing endpoint, reviewing API code, or generating an OpenAPI spec. Replace the rules below with your organisation's own standard and name its owner.
---
# Secure API review

> **This is an example.** It is the playbook's illustration of a policy
> skill. Replace the numbered rules with your organisation's API security
> standard, taken from the policy owner's source of truth, and have that
> owner sign off changes. A skill is advisory; back any rule that must hold
> without exception with a hook or a PR review pass.

Policy owner: <name / team>. Source of truth: <link>.

When you create or change an API endpoint:

1. **Authentication.** Every endpoint requires the gateway JWT; no anonymous
   routes outside `/health`.
2. **Input validation.** Validate request bodies against the OpenAPI schema
   and reject unknown fields.
3. **Audit.** Every state-changing endpoint emits an audit event with actor,
   action, entity and timestamp.
4. **Data classification.** Fields tagged `pii` in the schema must never
   appear in logs or error messages.

If the project has an endpoint checker (the playbook's example is
`scripts/check-endpoints.sh`), run it and include its output in your summary.
If it does not, say so and list the endpoints you changed against the four
rules above.

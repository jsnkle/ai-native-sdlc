# Spec: claims status self-service (from intent.md 2026-06-02)

Status: accepted by product owner 2026-06-04. Record: CLM-482.

## Requirements

1. An authenticated portal user sees, for each of their open claims: current status, the next step, and the expected date of that step.
2. Status values map one-to-one to the four claims-core states (received, assessing, approved, paid). No new states are introduced.
3. The panel loads within 1s at p95; claims-core rate-limits at 50 rps, so responses are cached for 60s per claim.
4. Third-party loss adjusters are **out of scope** for this change (open question from intent resolved: separate intent, different auth model).

## Design

- New endpoint `GET /claims/{id}/status` on claims-api, behind the existing gateway JWT. Returns `{status, nextStep, expectedDate}`.
- New `StatusPanel` component on the portal claim page, reading from the endpoint. Follows the portal design system: status shown as a stepper, dates in the user's locale.
- No claim detail beyond the three fields leaves claims-core, so no new PII enters the portal session.

## Flagged concerns

- **Security policy (secure-api-review):** the endpoint is state-reading only, so no audit event is required. Confirmed with the security policy owner.
- **Brand/UX:** the portal design system has no "expected date" pattern. Using the existing date chip; UX owner to confirm.
- **Accessibility:** the stepper must expose the current state to screen readers; existing component does this.

## Acceptance

The four states render correctly against a mock of claims-core; the endpoint returns 401 without a JWT; the p95 target holds in staging.

# Failure Handling

The harness turns failures into explicit decisions.

## Failure Taxonomy

- `schema_invalid`: response violates the structured output contract.
- `missing_citation`: source-backed claim lacks a citation.
- `unknown_citation`: response cites a chunk not supplied in evidence.
- `groundedness_below_threshold`: cited evidence does not support the claim.
- `provider_timeout`: provider did not respond within budget.
- `provider_unavailable`: provider cannot serve the request.
- `policy_violation`: workspace, provider, sensitive-content, or regulatory rule is violated.
- `latency_budget_exceeded`: advisory latency budget exceeded.
- `cost_budget_exceeded`: advisory cost budget exceeded.

## Decision Pattern

Failures map to `ACCEPT`, `REPAIR`, `RETRY`, `REGENERATE_WITH_EVIDENCE`, `FALLBACK_PROVIDER`, `HUMAN_REVIEW`, `BLOCK`, or `REJECT`.

The map lives in `policies/failure-policy.yaml`.

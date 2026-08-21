# Human Review Policy

Version: `human-review-policy-2026.08`

Automation must stop when continuing would hide uncertainty from a reviewer or create regulated-document risk.

## Escalation Triggers

- Low groundedness score.
- Conflicting evidence chunks.
- Repeated repair failure.
- Regulated high-risk content where policy requires review.
- Schema still invalid after retries.
- Provider uncertainty that cannot be resolved through fallback.
- Policy violation.
- Unknown or fabricated citations.
- Any case where the trace cannot explain why the content should be accepted.

## Boundary

Human review is a deliberate safety boundary, not a failure of the harness. The harness should make the reason for escalation clear and preserve the evidence, attempts, and sensor results needed for a reviewer to act.

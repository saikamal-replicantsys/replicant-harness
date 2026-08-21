# Evidence Policy

Version: `evidence-policy-2026.08`

## Evidence Rules

- Factual source-backed claims require valid chunk IDs.
- Chunk IDs must exist in the evidence catalog supplied to the run.
- Citation coverage is evaluated at the block level in this POC.
- Fabricated evidence references fail validation.
- Quote text is never authoritative if the chunk ID is invalid.
- Evidence should remain immutable within a run.
- A response may cite more than one chunk when a claim depends on multiple sources.
- Conflicting evidence must be escalated to human review unless a workflow-specific deterministic rule resolves the conflict.

## Conceptual Coverage Target

Source-backed generated blocks should reach complete citation coverage. Non-source connective text can be uncited only when it does not assert factual regulated content.

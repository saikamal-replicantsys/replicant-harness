# Architecture Guide

Version: `architecture-guide-2026.08`

This guide defines the architecture rules that apply to RepliSense model-assisted workflows.

## Rules

1. Model output is not the final internal document representation.
2. Node owns deterministic normalization, including `blockId`, `order`, `styleId`, `reviewStatus`, and citation metadata.
3. Raw HTML is not the source of truth for generated regulated-document content.
4. Provider-specific logic must not leak into workflow logic.
5. Traceability must survive provider switching.
6. All source-backed claims require evidence references.
7. Evidence references must use chunk IDs supplied in the request.
8. Human review boundaries remain explicit and application-owned.
9. The harness may recommend corrective actions, but RepliSense owns persistence, authorization, rendering, review state, and user permissions.
10. The harness must produce a trace that explains why a decision was made.

## Provider Independence

Workflow code should depend on provider-neutral contracts. Provider adapters may translate between Gemini, Bedrock, or later providers, but the Writer workflow should see the same structured response shape and sensor result shape.

## Deterministic Boundary

The model can generate text and structured blocks. Deterministic services validate, normalize, enrich, render, persist, and route work to users.

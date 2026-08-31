# Production Migration

This POC validates workflow shape before building the production feature.

| POC | Production Direction |
| --- | --- |
| Filesystem data workspace | Application persistence |
| Manual CLI approval | Ruleset approval UI |
| Markdown adapter | Production document engine such as Docling/document parsing |
| JSON graph | Relational or graph-backed provenance representation |
| GeminiProvider | RepliSense provider layer |
| CLI QC | QC backend workflow |
| Markdown report | Existing QC-style interface |
| MockAIProvider | Test provider and deterministic CI fixtures |

## What Carries Forward

- Candidate generation, not authoritative generation.
- Deterministic validation before state transition.
- Human approval before rules enter QC.
- Approved-rule-only QC.
- Finding provenance from target block to SOP evidence.
- Provider abstraction.
- Traceable guide and contract versions.

## What Needs Hardening

- Authorization and tenant isolation.
- Production persistence and audit history.
- Document parsing for DOCX, PDF, spreadsheets, and OCR.
- Reviewer UI and approval workflow.
- Provider retry, timeout, and rate-limit policies.
- Calibrated semantic groundedness evaluation.
- Integration with the real RepliSense QC DTO.

# SOP Compliance QC Workflow

This is the first runnable workflow in the RepliSense harness POC.

## Flow

```text
SOP Markdown
     |
Document Adapter
     |
Normalized SOP
     |
Gemini or Mock Rule Generator
     |
Rule Sensors
     |
Candidate Rules
     |
Human Approval
     |
Approved Rules
     |
Knowledge Graph
     |
Rule Retrieval
     ^
Target Markdown
     |
Gemini or Mock QC
     |
Candidate Findings
     |
Finding Sensors
     |
Groundedness Evaluator
     |
Provenance Validation
     |
Accepted Findings
     |
Client Report / QC Adapter
```

## Commands

```bash
npm run rules -- data/sop/document-control-sop.md
npm run approve-rules -- RULESET-SOP-DEMO-001
npm run qc -- data/target/batch-record.md
npm run demo
npm run lineage -- QC-F-001
```

## Boundary

Gemini produces candidates only. The harness validates candidates, preserves provenance, and requires human approval before rules can enter QC.

The demo uses `MockAIProvider` so it does not require `GEMINI_API_KEY`.

## Limitations

- Markdown-only input.
- No OCR.
- No page-coordinate mapping.
- No vector retrieval.
- No production authorization or tenant isolation.
- No production persistence.
- Semantic evaluators use AI in real mode and are therefore probabilistic.
- Human approval of rules remains mandatory.
- This POC must not be used as an unattended regulatory decision system.

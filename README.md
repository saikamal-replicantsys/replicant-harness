# RepliSense AI Engineering Harness POC

> Conceptual POC - no runtime LLM integration.
> This repository demonstrates how guides, contracts, sensors,
> evaluations, provider policies and correction loops could form a
> lightweight AI engineering harness around RepliSense workflows.

Repository metadata:

- About: Conceptual AI engineering harness POC for RepliSense regulated-document workflows, showing guides, contracts, sensors, policies, traces, evaluations, and provider abstraction.
- License: MIT
- Suggested GitHub topics: `ai-engineering`, `llm`, `harness`, `regulated-documents`, `replisense`, `traceability`, `evaluations`, `provider-abstraction`, `citation-validation`, `proof-of-concept`

## 1. Why This Exists

RepliSense already has the important pieces of a regulated-document AI workflow: templates, evidence, structured generation, Node-side validation, deterministic normalization, document rendering, and human review.

This POC shows what a reusable reliability layer around those workflows could look like. It is designed for an internal engineering presentation, not for production deployment. The files are realistic enough to discuss implementation choices, but thin enough that the repository does not become a new orchestration platform.

## 2. What Problem A Harness Solves

An LLM call can succeed while the generated content is still unacceptable.

The HTTP request can return `200`. The JSON can parse. The response can match the schema. Even then, a regulated-document workflow may need to reject or repair the generation because it lacks citations, conflicts with supplied evidence, violates policy, exceeds limits, or needs a human boundary.

The harness makes those checks explicit and repeatable.

## 3. The Model Is Not The System

The model produces compact structured output. It does not own the final RepliSense document model.

Node remains responsible for deterministic application concerns such as `blockId`, `order`, `styleId`, `reviewStatus`, citation metadata, persistence, section state, rendering, and user permissions. The harness sits around the model call and evaluates whether the model output is acceptable enough for the application to continue.

```text
                Guides
                  |
Evidence -> [ AI Model ] -> Structured Output
                  |
               Sensors
                  |
        +---------+---------+
        |                   |
      PASS                FAIL
        |                   |
      Accept        Repair / Retry /
                    Fallback / Human
```

## 4. Core Concepts

**Guides** are versioned instructions: architecture rules, workflow conventions, evidence rules, security constraints, and provider-independent behavior.

**Contracts** define deterministic interfaces: request schemas, compact response schemas, evidence chunk shapes, sensor result shapes, and run traces.

**Sensors** evaluate outputs after generation: schema validity, citation coverage, groundedness, policy, latency, and estimated cost.

**Policies** map failures to decisions: accept, repair, retry, regenerate with evidence, fallback provider, send to human review, block, or reject.

**Traces** record what happened: provider, model, attempts, guide versions, evidence IDs, sensor outcomes, triggered actions, latency, cost band, and final decision.

**Evaluations** make regression visible through deterministic cases and expected outcomes.

## 5. High-Level Architecture

```text
Request
   |
Context + Guides + Contracts
   |
Provider Router
   |
LLM
   |
Structured Response
   |
Sensors
   |
Decision Engine
   |
Accept / Repair / Retry / Fallback / Human Review
   |
Trace + Metrics
```

The harness is intentionally small. It is not:

- another LangChain
- another agent framework
- a replacement for application architecture
- a giant orchestration platform
- a prompt folder

It is a thin reliability layer around model-driven workflow steps.

## 6. Main Demo Scenario

The central demo is `scenarios/02-missing-citations`.

A Writer section generation request includes evidence chunk `chunk-clinical-001`. Attempt 1 returns syntactically valid structured JSON and passes the schema contract. However, it makes a source-backed efficacy claim without citing the evidence chunk.

The key line:

> The API call succeeded. The JSON is valid. But the generation is still not acceptable.

The citation sensor fails. The failure policy maps `missing_citation` to `REGENERATE_WITH_EVIDENCE`. Attempt 2 returns the same claim with `chunk-clinical-001`. Schema, citation, groundedness, and policy checks pass. The final decision is `ACCEPT`.

## 7. Repository Structure

```text
replisense-harness-poc/
|-- README.md
|-- ARCHITECTURE.md
|-- DEMO.md
|-- harness.config.yaml
|-- providers.yaml
|-- guides/
|-- contracts/
|-- sensors/
|-- policies/
|-- scenarios/
|-- traces/
|-- evals/
|-- examples/
|-- docs/
`-- tools/
```

Each folder is presentation-facing. Opening the repository in VS Code should be enough to explain the harness idea without running infrastructure or calling an LLM.

## 8. How This Maps To RepliSense Today

Current RepliSense concepts map naturally to harness concepts:

- Structured Python response -> output contract
- Node validation -> schema sensor
- SourceTraceabilityMap and chunk IDs -> evidence plus citation sensor
- Provider layer -> provider routing
- QC validation -> workflow sensors
- Human reviewer -> escalation boundary
- Prompt versions -> guide versions
- Observability -> traces and metrics

## 9. What We Could Build Now

The practical near-term foundation is small:

- provider interface
- structured request and response contracts
- validation hooks
- trace IDs and attempt records
- prompt or guide versioning
- evaluation datasets
- shared sensor result format
- centralized failure vocabulary

These pieces can be added incrementally around existing workflows.

## 10. What We Should Not Build Yet

The POC deliberately avoids:

- a universal DAG engine
- a custom workflow language
- a broad autonomous planning loop
- a dynamic plugin marketplace
- a giant policy DSL
- a duplicate observability platform
- a full replacement for RepliSense application services

Abstractions should be earned from repeated failure modes, not invented up front.

## 11. Future Evolution

Phase 0 is this conceptual harness.

Phase 1 adds shared contracts, trace records, and a provider abstraction.

Phase 2 adds common sensors and offline evals.

Phase 3 introduces repair, retry, and fallback policies.

Phase 4 extracts cross-workflow harness services where repetition is proven.

Phase 5 selectively supports autonomous workflows with explicit human and policy boundaries.

## 12. Demo Walkthrough

For a five to seven minute walkthrough, use this sequence:

1. Open `README.md` and establish the harness as a reliability layer.
2. Open `harness.config.yaml` to show guides, contracts, sensors, policies, and limits.
3. Open `guides/writer-rules.md` to show what the model is allowed to produce.
4. Open `contracts/writer-response.schema.json` to show the compact output contract.
5. Open `scenarios/02-missing-citations/attempt-1-response.json`.
6. Open `sensors/citation-check.yaml` and `policies/failure-policy.yaml`.
7. Open `scenarios/02-missing-citations/attempt-2-response.json`.
8. Open `traces/repaired-run.json`.
9. Close with `docs/03-replisense-mapping.md`.

Optional static runner:

```bash
npm run demo
```

The runner reads predefined files only. It does not call a provider, run an evaluator model, or implement a framework.

## Offline Document Evaluation

The harness can now compare a generated DOCX against a reference DOCX using deterministic offline sensors.

### Quick Start

1. Place files in:

   ```text
   eval-input/reference.docx
   eval-input/generated.docx
   ```

2. Run:

   ```bash
   npm run evaluate
   ```

3. View:

   ```text
   reports/latest.md
   reports/latest.json
   ```

You can also pass explicit paths:

```bash
npm run evaluate -- ./some/reference.docx ./some/generated.docx
```

The evaluator extracts DOCX text, headings, sections, and tables, normalizes the content, aligns sections, runs deterministic sensors, applies centralized scoring weights, and writes JSON plus Markdown reports.

Important interpretation notes:

- Levenshtein is not the final quality score.
- Paraphrasing can reduce raw text similarity even when content is acceptable.
- Structural fidelity, numeric fidelity, unit fidelity, formula fidelity, table fidelity, and completeness carry meaningful weight.
- V1 reports "potentially unsupported / extra content"; it does not claim true hallucination detection.
- Semantic embeddings and LLM judges are intentionally future work.

To generate synthetic local demo DOCX fixtures:

```bash
npm run fixtures
npm run evaluate
```

# First Runnable Workflow: SOP Compliance QC

This repository now includes a local SOP-driven validation workflow for Markdown documents.

It demonstrates the production architecture RepliSense is considering:

- SOP documents become candidate rulesets.
- Gemini produces candidate rules, not authoritative rules.
- Deterministic sensors validate schema, source references, source text, modality, duplicates, and approval state.
- Human approval is mandatory before rules can enter QC.
- QC uses approved rules only.
- Candidate findings are validated before becoming accepted findings.
- Every accepted finding resolves through the knowledge graph back to the approved rule, ruleset, SOP document, SOP evidence block, target document, and target block.

```text
SOP Markdown
     |
Document Adapter
     |
Normalized SOP
     |
Gemini Rule Generator
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
Gemini QC
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

## SOP QC Prerequisites

For real Gemini mode, create a local `.env` file:

```text
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
```

`.env` is ignored by git. Never commit the key.

The demo and tests use `MockAIProvider` and do not require Gemini.

## SOP QC Commands

Normalize client source documents:

```bash
npm run ingest -- --client test-sop
```

This scans `data/clients/test-sop/source/` and writes normalized Markdown plus metadata to `data/clients/test-sop/normalized/`. The same command works with `--client lamba`.

Generate candidate rules from a client-normalized SOP:

```bash
npm run rules -- --client test-sop data/clients/test-sop/normalized/<sop>.md
```

Approve rules manually:

```bash
npm run approve-rules -- --client test-sop <ruleset-id>
```

Approve all for fixture/demo use only:

```bash
npm run approve-rules -- --client test-sop <ruleset-id> --all
```

Run QC with that client's approved rules only:

```bash
npm run qc -- --client test-sop data/clients/test-sop/normalized/<target>.md
```

Inspect lineage from that client's graph:

```bash
npm run lineage -- --client test-sop <finding-id-or-rule-id>
```

Legacy non-client fixture commands are still available:

```bash
npm run rules -- data/sop/document-control-sop.md
```

Approve rules manually:

```bash
npm run approve-rules -- RULESET-SOP-DEMO-001
```

Approve all for fixture/demo use only:

```bash
npm run approve-rules -- RULESET-SOP-DEMO-001 -- --all
```

Run QC:

```bash
npm run qc -- data/target/batch-record.md
```

Run complete fixture demo without Gemini:

```bash
npm run demo
```

Inspect lineage:

```bash
npm run lineage -- QC-F-001
```

## Client-Scoped Ingestion

Client folders are filesystem scopes for local POC testing, not an authentication or tenancy implementation. A client workspace uses:

```text
data/clients/<client-id>/
  source/
  evidence/
  normalized/
    evidence/
    target/
  rulesets/
    generated/
    approved/
  target/
  findings/
  reports/
  traces/
  graph.json
```

All generated artifacts for `--client <client-id>` stay under that directory. Rule generation writes candidate rules to `rulesets/generated/`, approval writes approved rules to `rulesets/approved/`, QC loads only those approved rules, and lineage reads only that client's `graph.json`.

Supported ingestion formats:

- Markdown (`.md`)
- Word DOCX (`.docx`)
- Excel workbook (`.xlsx`)
- PDF (`.pdf`) for text/content extraction
- Legacy Word DOC (`.doc`) is detected but not parsed; convert it to `.docx` first.

Each source file in `source/` produces:

- `normalized/<file>.md`
- `normalized/<file>.metadata.json`

Metadata records the client id, source file, normalized file, title, block ids, block types, and source locations. XLSX ingestion keeps sheet names and cell references in block metadata so future findings can cite locations such as `Sheet: Results`, `Cell: D14`.

Target and evidence folders can be ingested separately:

```bash
npm run ingest -- --client lambda --kind source
npm run ingest -- --client lambda --kind evidence
npm run ingest -- --client lambda --kind target
```

`source` is the backwards-compatible SOP/source folder and writes to `normalized/`. `evidence` writes to `normalized/evidence/`. `target` writes to `normalized/target/`.

## Client QC Case Flow

For pharma POCs where an MDR or other reviewed document must be checked against the approved SOP ruleset using all supporting workbooks/source files, use the case command:

```bash
npm run qc:case -- --client lambda --target "data/clients/lambda/target/MDR_NRCESDS_updated-QCed.docx" --evidence all
```

The case runner:

- normalizes the target DOCX into `data/clients/lambda/normalized/target/`
- uses normalized supporting source/evidence Markdown from the client scope
- loads approved rules only from `data/clients/lambda/rulesets/approved/`
- sends Gemini the reviewed target, supporting source documents, and approved rules
- requires findings to cite exact `ruleId`, `rulesetId`, SOP source block ids, target block ids, and supporting evidence block ids when used
- validates all citations before accepting findings
- writes client-scoped findings, report, trace, and graph updates

Case outputs use:

```text
data/clients/<client-id>/findings/<target>.case.findings.json
data/clients/<client-id>/reports/<target>-case-qc-report.md
data/clients/<client-id>/traces/QC-CASE-*.json
data/clients/<client-id>/graph.json
```

## SOP QC Outputs

Runtime outputs are written under `data/`:

- `data/normalized/`
- `data/rulesets/generated/`
- `data/rulesets/approved/`
- `data/findings/`
- `data/knowledge/graph.json`
- `data/reports/`
- `data/traces/`

The conceptual old-QC adapter writes `data/findings/<target>.old-qc.json` and includes accepted findings only.

## SOP QC Limitations

- Client ingestion supports Markdown, DOCX, and XLSX; SOP/QC workflows consume normalized Markdown.
- PDF ingestion extracts text blocks for content QC; it does not validate visual layout, coordinates, signatures, scanned images, or page-perfect formatting.
- Legacy `.doc` files require manual conversion to `.docx`.
- No OCR.
- No page-coordinate mapping.
- No vector retrieval.
- No production authorization.
- Client IDs are filesystem scopes, not production tenant isolation.
- No production data persistence.
- Semantic evaluators use AI in real mode and are therefore probabilistic.
- Human approval of rules remains mandatory.
- This POC must not be used as an unattended regulatory decision system.


--------

Lambda Client:

1. Ingest: 

npm run ingest -- --client lambda

2. Generate rules from SOP / reference docs:

npm run rules -- --client lambda "data/clients/lambda/normalized/SP-LBD-GNL-093-00 Analyticle method development.md"
3. Approve generated rulesets:

npm run approve-rules -- --client lambda RULESET-SOP-SP-LBD-GNL-093-00-ANALYTICLE-METHOD-DEVELOPMENT --all

4. Run QC against result workbooks:

npm run qc -- --client lambda "data/clients/lambda/normalized/Results1.md"
npm run qc -- --client lambda "data/clients/lambda/normalized/Results(1).md"
npm run qc -- --client lambda "data/clients/lambda/normalized/Results.md"
npm run qc -- --client lambda "data/clients/lambda/normalized/Results_002.md"
npm run qc -- --client lambda "data/clients/lambda/normalized/Results_005.md"

____________

Test SOP Client

1. Ingest: 

npm run ingest -- --client test-sop

2. Generate rules from SOP / reference docs:

npm run rules -- --client test-sop "data/clients/test-sop/normalized/Vendor Approval SOP _Sample ref.md"

3. Approve generated rulesets:

npm run approve-rules -- --client test-sop RULESET-SOP-VENDOR-APPROVAL-SOP-SAMPLE-REF

4. Run QC against result workbooks:

npm run qc -- --client test-sop data/clients/test-sop/normalized/Annex-2.md
npm run qc -- --client test-sop data/clients/test-sop/normalized/Annex-3.md
npm run qc -- --client test-sop data/clients/test-sop/normalized/Annex-4.md
npm run qc -- --client test-sop data/clients/test-sop/normalized/Annex-5.md

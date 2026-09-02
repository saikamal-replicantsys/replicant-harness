# Architecture Design Note

## 1. Problem Statement

RepliSense uses AI-assisted workflows for regulated document generation and review. A normal integration can treat a model call as successful when the provider returns a response that parses and matches a schema. Regulated workflows need a stronger definition of success: the output must be structured, traceable, policy-compliant, evidence-grounded, observable, and safe to route into deterministic application processing.

## 2. Design Principles

- Keep the harness thin and workflow-focused.
- Keep model output compact and structured.
- Keep deterministic application responsibilities inside RepliSense.
- Make failures explicit through a shared decision vocabulary.
- Keep provider-specific behavior behind provider-neutral contracts.
- Preserve human review as a first-class boundary.
- Build from repeated failure modes, not from speculative orchestration needs.

## 3. System Boundaries

Application responsibilities include persistence, workspace authorization, document lifecycle, section state, review states, rendering, user permissions, and billing.

Harness responsibilities include context assembly rules, model contract enforcement, provider selection, validation, evaluations, corrective actions, and execution traces.

The harness must not absorb core RepliSense application responsibilities.

## 4. Harness Components

Guides steer provider-independent behavior before execution. Contracts define request, response, evidence, sensor, and trace shapes. Sensors evaluate generated output after execution. Policies map failures to actions. Traces explain what happened. Evals protect behavior as prompts and providers evolve.

## 5. Execution Lifecycle

1. Receive a workflow request from RepliSense.
2. Assemble context, guides, contracts, evidence, and provider constraints.
3. Select an eligible provider.
4. Request compact structured output.
5. Validate schema.
6. Run citation, groundedness, policy, latency, and cost sensors.
7. Apply failure policy.
8. Accept, repair, retry, regenerate with evidence, fallback, block, reject, or route to human review.
9. Emit a trace and metrics.

## 6. Provider Abstraction

The POC models Gemini and Bedrock through `providers.yaml`. It describes capabilities and routing policy, not SDK code. A future provider adapter should translate provider-specific response formats into the same Writer response contract and trace vocabulary.

## 7. Guide Lifecycle

Guides are versioned engineering instructions. They should be reviewed like code because changing a guide can change model behavior. Trace records capture guide versions so regressions can be linked to instruction changes.

## 8. Sensor Lifecycle

Sensors start as deterministic validators where possible. Schema, citation existence, and policy checks can be deterministic. Groundedness is partly semantic and would require a future evaluator, targeted deterministic checks, or reviewer sampling.

## 9. Failure Handling

Failures map to explicit actions in `policies/failure-policy.yaml`. Missing citations regenerate with evidence. Invalid schemas repair when safe. Provider timeouts fallback. Low groundedness routes to human review. Policy violations block.

## 10. Human Review

Human review is not a fallback for poor engineering. It is an explicit safety boundary for ambiguous, conflicting, repeated, or high-risk regulated content. The harness should provide reviewers with the trace, evidence IDs, attempts, and sensor failures.

## 11. Traceability

Traceability connects run ID, provider, model, attempts, guide versions, contract versions, evidence IDs, sensor results, triggered actions, and final decision. Traceability must survive provider switching.

## 12. Evaluations

Offline evals provide golden cases for expected sensor results and decisions. They support regression testing across prompt versions, guide versions, provider adapters, and policy changes.

## 13. Security / Tenancy

The harness must respect workspace boundaries and enterprise policy. It should avoid logging sensitive content where references are sufficient. It must never mix evidence across workspaces.

## 14. What Remains Deterministic

Schema validation, chunk ID existence, provider eligibility, attempt limits, latency budgets, cost bands, failure policy mapping, and application-owned normalization remain deterministic.

## 15. What Remains Model-Driven

Text generation, summarization, phrasing, and some future semantic evaluation remain model-driven. Model-driven parts should be surrounded by contracts, sensors, policies, and traces.

## 16. Future Implementation Options

- Shared TypeScript contracts for Writer and QC workflows.
- Provider adapters for Gemini and Bedrock.
- Reusable sensor result format.
- Trace persistence tied to RepliSense run IDs.
- Offline eval runner using captured scenarios.
- Optional evaluator model for groundedness with reviewer calibration.

## 17. Trade-Offs

The harness adds friction to simple model calls, but it makes failure modes visible. It avoids broad orchestration features, which keeps the first implementation smaller but means repeated patterns must be observed before abstraction.

## 18. Risks

- Groundedness evaluation can become overconfident if treated as deterministic.
- Too much policy logic in the harness can duplicate application responsibilities.
- Provider abstractions can leak if workflows depend on provider-specific features.
- Evaluation sets can become stale if not tied to real incidents and reviewer feedback.

## 19. Non-Goals

- No runtime LLM integration.
- No cloud infrastructure.
- No database.
- No Docker.
- No web UI.
- No general-purpose agent framework.
- No replacement for RepliSense application architecture.

## 20. Offline Document Evaluation Harness

The POC now includes a working local DOCX comparison harness. It remains deterministic and offline: no provider API, LLM judge, vector database, or cloud service is required.

```text
Reference DOCX
      |
      +--------------+
      v              v
 Extraction       Generated DOCX
      |              |
      +------+-------+
             v
       Normalization
             |
             v
       Section Alignment
             |
             v
          Sensors
             |
    +--------+---------+
    v        v         v
  Text    Structure   Facts
    |        |         |
    +--------+---------+
             v
       Scoring Engine
             |
             v
      PASS/REVIEW/FAIL
             |
             v
      JSON + Markdown
```

The same harness concepts remain visible:

- Contracts: TypeScript result and extracted-document shapes.
- Sensors: text similarity, structure, factual fidelity, tables, and completeness.
- Policies: centralized scoring weights, thresholds, and critical mismatch rules.
- Traces/evaluations: machine-readable reports and fixture-driven tests.
- Reports: `reports/latest.json` and `reports/latest.md`.

The extractor uses DOCX text extraction plus direct OOXML inspection for headings and tables. V1 evaluates content fidelity rather than Word layout fidelity.

## 21. SOP Compliance QC Workflow

The first AI-backed runnable workflow is SOP-driven compliance QC for Markdown documents.

The workflow keeps the core harness boundary intact:

- Gemini generates candidate rules and candidate findings.
- Deterministic sensors validate contracts, source references, approval state, and provenance.
- Human approval is required before generated rules can be used for QC.
- The knowledge graph records identity and lineage, not semantic reasoning.
- Accepted findings must resolve to both SOP evidence and target evidence.

```text
SOP Markdown
     |
Document Adapter
     |
Normalized SOP
     |
AIProvider
     |
GeminiProvider
     |
Candidate Rules
     |
Rule Sensors
     |
Manual Approval
     |
Approved Rules
     |
Simple Rule Retrieval
     |
Target Markdown -> AIProvider -> Candidate Findings
     |
Finding Sensors + Groundedness Evaluation
     |
Provenance Graph
     |
Client Report + Conceptual Old-QC Adapter + Trace
```

Future document formats should be added as new `DocumentAdapter` implementations. The workflow should continue to consume `NormalizedDocument`, not raw files.

## 22. Client-Scoped Document Ingestion

The SOP/QC harness now has a local ingestion step for testing against real client documents without redesigning the rule, approval, QC, sensor, provenance, or provider architecture.

```text
Client source folder
data/clients/<client-id>/source
     |
DocumentAdapter
     |
Markdown / DOCX / XLSX normalization
     |
data/clients/<client-id>/normalized
     |
Existing SOP rule generation / approval / QC
     |
data/clients/<client-id>/rulesets
data/clients/<client-id>/findings
data/clients/<client-id>/reports
data/clients/<client-id>/traces
data/clients/<client-id>/graph.json
```

The adapters all emit the existing `NormalizedDocument` contract:

- `MarkdownDocumentAdapter` preserves headings, lists, tables, and paragraph block locations from Markdown.
- `DocxDocumentAdapter` uses the existing DOCX extraction layer to preserve headings, paragraphs, tables, and document order where available.
- `XlsxDocumentAdapter` preserves workbook name, sheet names, populated cells, displayed values, formulas, and cell references.
- Legacy `.doc` files fail clearly because V1 does not include a reliable local converter/parser.

Client scope is passed into the existing workflows as path configuration. With `--client test-sop`, generated rulesets, approved rulesets, graph nodes, findings, reports, and traces are written only inside `data/clients/test-sop/`. QC loads approved rules only from that same client directory. This is a deterministic local filesystem boundary for the POC, not a production authorization model.

Real-document safety remains explicit: ingestion does not call Gemini, does not mutate source files, and does not send whole client folders to a provider. Gemini receives only the normalized document selected by the rule-generation or QC command.

## 23. Client QC Case Flow

The harness now supports a case-level SOP QC flow for pharma POCs where the reviewed target document must be evaluated alongside supporting source/evidence files such as Excel result workbooks.

```text
data/clients/<client-id>/source
  SOP YAML / SOP Markdown / source files
        |
        v
Normalized SOP + supporting source Markdown
        |
        v
Ruleset generation or deterministic YAML import
        |
        v
Manual approval
        |
        v
Approved client-scoped rules

data/clients/<client-id>/target
  MDR / reviewed DOCX
        |
        v
Normalized target Markdown
        |
        +---------------------------+
                                    |
data/clients/<client-id>/evidence  |
  optional supporting files         |
        |                           |
        v                           v
Normalized evidence Markdown -> QC Case Context
                                    |
                                    v
                              Gemini QC
                                    |
                                    v
                         Finding validation sensors
                                    |
                                    v
                    Reports + findings + trace + graph.json
```

The case workflow keeps the existing architecture:

- Contracts: one `NormalizedDocument` shape for SOP, target, and source evidence.
- Sensors: findings must reference approved rules, SOP source blocks, target blocks, and cited source evidence blocks.
- Policies: only approved client-scoped rules can be used for QC.
- Traces: case runs record target document id, evidence document ids, rule batches, sensor outcomes, token usage, and final decision.
- Provenance graph: `graph.json` stores SOP, source, target, rule, finding, and block lineage.

The graph is a local provenance graph. It supports lineage and auditability, but it is not a graph database, vector store, ontology reasoner, or semantic knowledge graph.

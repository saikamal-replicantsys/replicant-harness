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

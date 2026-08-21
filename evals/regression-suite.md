# Regression Suite

The regression suite is a lightweight set of deterministic cases that protect the harness contract as provider prompts, guides, schemas, and routing policies evolve.

## Purpose

- Catch schema drift before it reaches document normalization.
- Catch missing or fabricated citations.
- Distinguish citation validity from groundedness.
- Verify provider fallback behavior without implying provider superiority.
- Preserve human review boundaries for regulated content.

## How To Use

For the POC, read `writer-eval-cases.json` and `qc-eval-cases.json` as golden expectations.

In a real implementation, each case would run against a captured request, a generated or replayed response, and the configured sensors. The result would be compared with the expected sensor outcomes and expected decision.

## What Not To Do Yet

Do not build a universal evaluation platform before the repeated failure modes are known. Start with cases tied to real workflow risks: schema failures, citation failures, unsupported claims, provider fallback, and human review escalation.

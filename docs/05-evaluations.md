# Evaluations

Evaluations make harness behavior regressable.

## What To Evaluate

- Offline evals against captured or curated cases.
- Golden test cases with expected sensor outcomes.
- Provider comparison using the same contracts and sensors.
- Prompt and guide version comparison.
- Threshold behavior for citation coverage, groundedness, latency, and cost bands.
- Production sampling where reviewer feedback can calibrate future cases.

## POC Scope

This repository includes deterministic expected cases in `evals/writer-eval-cases.json` and `evals/qc-eval-cases.json`.

It does not implement a semantic evaluator. A real groundedness evaluator would need careful calibration and should not be treated as infallible.

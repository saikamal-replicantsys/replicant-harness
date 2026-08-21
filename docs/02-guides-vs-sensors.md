# Guides Vs Sensors

Guides steer before execution.

Sensors evaluate after execution.

## Guides

Guides include architecture rules, Writer rules, QC rules, security policy, evidence policy, and human review policy. They tell the model and provider adapter what behavior is allowed.

Example: `guides/writer-rules.md` says the model must return compact structured blocks and must not invent citations.

## Sensors

Sensors inspect requests, responses, attempts, and traces. They determine whether the output is acceptable for the next application step.

Example: `sensors/citation-check.yaml` fails a source-backed claim that has no chunk IDs even when the JSON is valid.

The practical pattern is simple: guides reduce the chance of failure; sensors catch failures that still happen.

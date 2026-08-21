# Provider-Agnostic Design

RepliSense is moving toward multiple LLM providers. The harness should not be Gemini-specific, Bedrock-specific, or tied to any single provider SDK.

## Why It Matters

Provider independence protects workflow code from churn. Providers differ in structured output mechanics, tool calling, streaming, latency, and policy configuration. The Writer workflow should not need to know those details.

## Design Rule

Provider adapters translate provider-specific behavior into provider-neutral contracts:

- request context
- compact structured response
- token and latency estimates
- provider status
- trace metadata

The same sensors should run regardless of provider.

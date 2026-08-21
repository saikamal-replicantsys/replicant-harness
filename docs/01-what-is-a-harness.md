# What Is A Harness?

An AI engineering harness is the engineered environment around a model or agent.

The model produces an output. The harness defines what input it receives, what output shape is acceptable, what evidence it can use, how the output is checked, what happens when checks fail, and what trace is emitted.

## Model Vs System

The model is one component. The system includes contracts, retrieval, validation, deterministic normalization, rendering, review, policy, and observability.

For RepliSense, the model may draft compact blocks. It does not own the internal document model, final review state, or rendering.

## Why Prompt Engineering Alone Is Insufficient

Prompts steer behavior, but they do not prove the output is acceptable. A prompt can ask for citations. A sensor can verify whether citations exist and whether they refer to supplied chunks.

Reliable agentic systems need surrounding infrastructure because failures are operational, not just linguistic.

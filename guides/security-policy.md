# Security Policy

Version: `security-policy-2026.08`

## Rules

- Do not place secrets, credentials, access tokens, or private keys in prompts, traces, examples, or logs.
- Do not grant unrestricted arbitrary tool access to model-driven workflow steps.
- Respect workspace and tenant boundaries.
- Do not mix evidence across workspaces.
- Log sensitive values by stable reference where possible rather than copying sensitive content.
- Provider selection must respect data residency, enterprise policy, and regulated-workflow constraints when applicable.
- Prompt and guide versions must be traceable without exposing sensitive prompt inputs unnecessarily.
- Human review escalation must not leak restricted evidence to unauthorized users.

## POC Constraint

This repository contains no real PHI, PII, secrets, credentials, or production customer data.

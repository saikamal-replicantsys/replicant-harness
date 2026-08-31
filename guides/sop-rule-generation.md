guideId: sop-rule-generation
version: 1.0.0

# SOP Rule Generation Guide

- Extract only requirements explicitly supported by SOP evidence.
- Do not infer organization practices that are not stated.
- Preserve modality accurately.
- "shall" must not become weaker language.
- "should" must not automatically become "shall".
- "may" must not become a mandatory rule.
- Do not invent severity unless severity policy explicitly allows assignment.
- Prefer atomic rules.
- Split multiple independent requirements when useful.
- Do not split when doing so destroys meaning.
- Preserve exceptions and conditional applicability.
- Preserve numerical values exactly.
- Preserve units exactly.
- Preserve dates and durations exactly.
- Every rule must include one or more valid sourceBlockIds.
- Never fabricate block IDs.
- A rule with no source evidence is invalid.
- Output structured JSON only.
- Do not include chain-of-thought or hidden reasoning.

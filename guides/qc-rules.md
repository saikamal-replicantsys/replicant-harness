# QC Rules

Version: `qc-guide-2026.08`

QC workflows evaluate document content against evidence, policy, and controlled review rules.

## Finding Rules

- Findings must reference a source location, evidence chunk, document section, or reviewer-visible anchor.
- Findings must not be invented.
- Duplicate issues should be minimized.
- Issue severity must use controlled values: `critical`, `major`, `minor`, or `informational`.
- Confidence scores may help prioritize review, but confidence must not override deterministic checks.
- Accepted and rejected user decisions remain application-owned.

## Output Rules

- QC output should be structured and traceable.
- Findings should include the rule or policy that triggered them where possible.
- Remediation suggestions must remain suggestions unless a workflow explicitly authorizes automated repair.

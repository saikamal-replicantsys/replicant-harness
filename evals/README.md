# Evaluation Fixtures

This folder contains conceptual and deterministic evaluation assets.

For batch evaluation, add case folders under:

```text
evals/cases/<case-id>/reference.docx
evals/cases/<case-id>/generated.docx
```

Then run:

```bash
npm run evaluate:batch
```

The batch runner produces:

```text
reports/batch-latest.json
reports/batch-latest.md
```

No network access or LLM provider is required.

The repository includes synthetic DemoTab 500 mg cases:

- `case-pass`: near-perfect generated document.
- `case-review`: comparator mismatch that triggers review.
- `case-fail`: sparse generated document with missing sections and changed facts.

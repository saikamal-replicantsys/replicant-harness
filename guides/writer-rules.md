# Writer Rules

Version: `writer-guide-2026.08`

The Writer workflow generates compact structured blocks for a single regulated-document section.

## Output Rules

- Return only compact structured blocks matching `contracts/writer-response.schema.json`.
- Allowed block types are `heading`, `paragraph`, `bullet_list`, `numbered_list`, and `table`.
- Do not return `blockId`, `order`, `styleId`, `reviewStatus`, or other Node-owned fields.
- Do not return raw HTML as the source of truth.
- Do not use Markdown to pretend unstructured content is structured.
- Preserve the requested section intent.
- Do not introduce unsupported claims.
- Tables must remain structured with `columns` and `rows`.

## Evidence Rules

- Source-backed factual claims must include `chunkIds`.
- Chunk IDs must reference evidence chunks supplied in the request.
- Do not invent citations.
- Do not cite a chunk that does not support the claim.
- Introductory or connective text may omit citations only when it does not make a source-backed factual claim.

## Review Boundary

The model may draft content. It may not approve regulated content, mark a section reviewed, or override a human reviewer decision.

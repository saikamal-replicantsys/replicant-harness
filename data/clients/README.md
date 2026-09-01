# Client Workspaces

Create local client folders in this shape:

```text
data/clients/<client-id>/
  source/
  normalized/
  rulesets/generated/
  rulesets/approved/
  target/
  findings/
  reports/
  traces/
  graph.json
```

Place source `.md`, `.yaml`, `.yml`, `.docx`, or `.xlsx` files under `source/`, then run:

```bash
npm run ingest -- --client <client-id>
```

Real client source files and generated client artifacts are ignored by git.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { resolveClientScope } from "../src/client/client-scope.js";
import { ingestClient } from "../src/client/ingest-client.js";
import { MarkdownDocumentAdapter } from "../src/documents/markdown.adapter.js";
import { DocxDocumentAdapter } from "../src/documents/docx.adapter.js";
import { XlsxDocumentAdapter } from "../src/documents/xlsx.adapter.js";
import { UnsupportedDocDocumentAdapter } from "../src/documents/doc.adapter.js";
import { YamlDocumentAdapter } from "../src/documents/yaml.adapter.js";
import { loadApprovedRules, writeJson } from "../src/workflows/sop-compliance-qc/store.js";
import { GraphStore } from "../src/knowledge/graph.store.js";
import type { Ruleset, SopRule } from "../src/harness/contracts/rule.js";
import { buildYamlRuleset } from "../src/workflows/sop-compliance-qc/yaml-ruleset.js";

const root = ".tmp/client-ingestion-tests/data/clients";

async function reset(): Promise<void> {
  await fs.rm(".tmp/client-ingestion-tests", { recursive: true, force: true });
}

async function writeMinimalXlsx(filePath: string): Promise<void> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Results" sheetId="1" r:id="rId1"/></sheets>
</workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`);
  zip.file("xl/sharedStrings.xml", `<?xml version="1.0" encoding="UTF-8"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="3" uniqueCount="3">
  <si><t>Parameter</t></si>
  <si><t>Result</t></si>
  <si><t>Temperature</t></si>
</sst>`);
  zip.file("xl/worksheets/sheet1.xml", `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:C2"/>
  <sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
    <row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>37</v></c><c r="C2"><f>B2*2</f><v>74</v></c></row>
  </sheetData>
</worksheet>`);
  await fs.writeFile(filePath, await zip.generateAsync({ type: "nodebuffer" }));
}

function sampleRule(ruleId: string, rulesetId: string): SopRule {
  return {
    ruleId,
    rulesetId,
    title: "Sample rule",
    statement: "Documents must preserve traceable values.",
    description: "Synthetic isolation rule.",
    ruleType: "required_content",
    severity: "minor",
    applicability: { documentTypes: ["batch_record"], conditions: [] },
    requirement: { type: "required_field", field: "traceable_value" },
    source: { documentId: "SOP-X", sourceBlockIds: ["SOP-X-B001"], sourceText: "Traceable values are required." },
    status: "approved",
    generation: { provider: "mock", model: "mock", generatedAt: "2026-08-31T00:00:00.000Z", confidence: 0.9 }
  };
}

test("client path resolution keeps generated artifact paths inside one client", () => {
  const scope = resolveClientScope("test-sop", root);
  assert.equal(scope.sourceDir, path.join(root, "test-sop", "source"));
  assert.equal(scope.rulesetsGeneratedDir, path.join(root, "test-sop", "rulesets", "generated"));
  assert.equal(scope.graphPath, path.join(root, "test-sop", "graph.json"));
});

test("client path resolution rejects unsafe client ids", () => {
  assert.throws(() => resolveClientScope("../escape", root), /Invalid client id/);
});

test("Markdown normalization writes client-scoped markdown and metadata", async () => {
  await reset();
  const scope = resolveClientScope("alpha", root);
  await fs.mkdir(scope.sourceDir, { recursive: true });
  await fs.writeFile(path.join(scope.sourceDir, "source.md"), "# SOP\n\n- Check 30 minutes\n", "utf8");

  const result = await ingestClient(scope, [new MarkdownDocumentAdapter()]);
  assert.equal(result.converted.length, 1);
  const markdown = await fs.readFile(path.join(scope.normalizedDir, "source.md"), "utf8");
  const metadata = JSON.parse(await fs.readFile(path.join(scope.normalizedDir, "source.metadata.json"), "utf8")) as { clientId: string; blocks: Array<{ location: { paragraphIndex?: number } }> };
  assert.match(markdown, /# SOP/);
  assert.equal(metadata.clientId, "alpha");
  assert.equal(metadata.blocks[0]?.location.paragraphIndex, 1);
});

test("target and evidence ingestion write to scoped normalized subfolders", async () => {
  await reset();
  const scope = resolveClientScope("alpha", root);
  await fs.mkdir(scope.targetDir, { recursive: true });
  await fs.mkdir(scope.evidenceDir, { recursive: true });
  await fs.writeFile(path.join(scope.targetDir, "mdr.md"), "# MDR\n\nTarget content\n", "utf8");
  await fs.writeFile(path.join(scope.evidenceDir, "results.md"), "# Results\n\nD12: Electrogram not came fine\n", "utf8");

  const targetResult = await ingestClient(scope, undefined, { kind: "target" });
  const evidenceResult = await ingestClient(scope, undefined, { kind: "evidence" });

  assert.equal(targetResult.converted[0]?.normalizedFile, path.join(scope.normalizedDir, "target", "mdr.md"));
  assert.equal(evidenceResult.converted[0]?.normalizedFile, path.join(scope.normalizedDir, "evidence", "results.md"));
  assert.equal(JSON.parse(await fs.readFile(targetResult.converted[0]!.metadataFile, "utf8")).documentId, "TARGET-MDR");
  assert.equal(JSON.parse(await fs.readFile(evidenceResult.converted[0]!.metadataFile, "utf8")).documentId, "EVIDENCE-RESULTS");
});

test("YAML normalization preserves rule-like sections", async () => {
  await reset();
  const scope = resolveClientScope("alpha", root);
  await fs.mkdir(scope.sourceDir, { recursive: true });
  await fs.writeFile(path.join(scope.sourceDir, "method.yaml"), "name: Analytical Method Development Rules\n\nrules:\n- id: AMD-001\n  requirement: Follow the SOP.\n", "utf8");

  const result = await ingestClient(scope, [new YamlDocumentAdapter()]);
  assert.equal(result.converted.length, 1);
  const metadata = JSON.parse(await fs.readFile(path.join(scope.normalizedDir, "method.metadata.json"), "utf8")) as { fileType: string; title: string };
  const markdown = await fs.readFile(path.join(scope.normalizedDir, "method.md"), "utf8");
  assert.equal(metadata.fileType, "yaml");
  assert.equal(metadata.title, "Analytical Method Development Rules");
  assert.match(markdown, /### Rule AMD-001/);
});

test("YAML ruleset import preserves all YAML rules deterministically", async () => {
  await reset();
  const scope = resolveClientScope("alpha", root);
  await fs.mkdir(scope.sourceDir, { recursive: true });
  const sourceFile = path.join(scope.sourceDir, "method.yaml");
  await fs.writeFile(sourceFile, `name: Analytical Method Development Rules
rules:
- id: AMD-001
  title: First rule
  severity: critical
  requirement: First requirement must be met.
  expected: First expectation.
  check_type: presence
  source:
    section: 2.0 Scope
    quote: First requirement must be met.
    quote_verified: true
- id: AMD-002
  title: Second rule
  severity: major
  requirement: Second requirement must be documented.
  expected: Second expectation.
  check_type: presence
  source:
    section: 3.0 Procedure
    quote: Second requirement must be documented.
    quote_verified: true
`, "utf8");

  const ingest = await ingestClient(scope, [new YamlDocumentAdapter()]);
  const markdownAdapter = new MarkdownDocumentAdapter();
  const sop = await markdownAdapter.parse(ingest.converted[0]!.normalizedFile, { documentType: "sop", clientId: scope.clientId, normalizedFile: ingest.converted[0]!.normalizedFile });
  const ruleset = await buildYamlRuleset(sourceFile, sop, "2026-09-01T00:00:00.000Z");
  assert.equal(ruleset.rules.length, 2);
  assert.deepEqual(ruleset.rules.map((rule) => rule.ruleId), ["AMD-001", "AMD-002"]);
  assert.equal(ruleset.rules[0]?.generation.provider, "yaml");
});

test("DOCX normalization preserves headings and paragraph locations", async () => {
  const doc = await new DocxDocumentAdapter().parse("eval-input/reference.docx", { documentType: "sop", clientId: "fixture" });
  assert.equal(doc.fileType, "docx");
  assert.ok(doc.blocks.some((block) => block.type === "heading"));
  assert.ok(doc.blocks.some((block) => typeof block.location.paragraphIndex === "number"));
});

test("XLSX normalization preserves sheet and cell provenance", async () => {
  await reset();
  const xlsxPath = ".tmp/client-ingestion-tests/results.xlsx";
  await fs.mkdir(path.dirname(xlsxPath), { recursive: true });
  await writeMinimalXlsx(xlsxPath);

  const doc = await new XlsxDocumentAdapter().parse(xlsxPath, { documentType: "sop", clientId: "alpha" });
  assert.equal(doc.fileType, "xlsx");
  assert.ok(doc.blocks.some((block) => block.location.sheet === "Results" && block.location.cellRange === "B2"));
  assert.ok(doc.blocks.some((block) => block.location.sheet === "Results" && block.location.cellRange === "C2" && block.text.includes("formula")));
});

test("unsupported DOC behavior fails clearly", async () => {
  await reset();
  const docPath = ".tmp/client-ingestion-tests/legacy.doc";
  await fs.mkdir(path.dirname(docPath), { recursive: true });
  await fs.writeFile(docPath, "legacy binary placeholder", "utf8");
  await assert.rejects(
    () => new UnsupportedDocDocumentAdapter().parse(docPath, "sop"),
    /Convert the file to \.docx/
  );
});

test("approved rules are isolated by client scope", async () => {
  await reset();
  const alpha = resolveClientScope("alpha", root);
  const beta = resolveClientScope("beta", root);
  const alphaRuleset: Ruleset = { rulesetId: "RULESET-ALPHA", sopDocumentId: "SOP-X", sopFileName: "a.md", title: "Alpha", status: "approved", generatedAt: "now", rules: [sampleRule("RULE-ALPHA", "RULESET-ALPHA")] };
  const betaRuleset: Ruleset = { rulesetId: "RULESET-BETA", sopDocumentId: "SOP-X", sopFileName: "b.md", title: "Beta", status: "approved", generatedAt: "now", rules: [sampleRule("RULE-BETA", "RULESET-BETA")] };
  await writeJson(path.join(alpha.rulesetsApprovedDir, "RULESET-ALPHA.json"), alphaRuleset);
  await writeJson(path.join(beta.rulesetsApprovedDir, "RULESET-BETA.json"), betaRuleset);

  assert.deepEqual((await loadApprovedRules(alpha)).map((rule) => rule.ruleId), ["RULE-ALPHA"]);
  assert.deepEqual((await loadApprovedRules(beta)).map((rule) => rule.ruleId), ["RULE-BETA"]);
});

test("graphs are isolated by client scope", async () => {
  await reset();
  const alpha = resolveClientScope("alpha", root);
  const beta = resolveClientScope("beta", root);
  await new GraphStore(alpha.graphPath).addNodesAndEdges([{ id: "ALPHA", type: "RULESET", properties: {} }], []);
  await new GraphStore(beta.graphPath).addNodesAndEdges([{ id: "BETA", type: "RULESET", properties: {} }], []);

  const alphaGraph = await new GraphStore(alpha.graphPath).load();
  const betaGraph = await new GraphStore(beta.graphPath).load();
  assert.equal(alphaGraph.nodes[0]?.id, "ALPHA");
  assert.equal(betaGraph.nodes[0]?.id, "BETA");
});

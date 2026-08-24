import fs from "node:fs/promises";
import path from "node:path";
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";

interface DemoDocOptions {
  title: string;
  temperature?: string;
  dissolution?: string;
  omitDissolution?: boolean;
  comparator?: string;
  assay?: string;
  sparseFailure?: boolean;
}

function heading(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_1 });
}

function para(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun(text)] });
}

function makeTable(rows: string[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((row) => new TableRow({
      children: row.map((cell) => new TableCell({ children: [para(cell)] }))
    }))
  });
}

function buildDemoDoc(options: DemoDocOptions): Document {
  if (options.sparseFailure) {
    return new Document({
      sections: [{
        children: [
          new Paragraph({ text: options.title, heading: HeadingLevel.TITLE }),
          heading("1. Description"),
          para("DemoTab 500 mg tablets are supplied as a draft summary. Temperature is 73 ± 0.5°C."),
          heading("4. Assay"),
          para("Assay result must be 80.0% to 120.0% of label claim."),
          para("% Assay = (Ar / As) × (Cs / Cr) × 100")
        ]
      }]
    });
  }

  const temperature = options.temperature ?? "37 ± 0.5°C";
  const dissolution = options.dissolution ?? "NLT 80% of the labeled amount dissolves in 30 minutes at 50 rpm using 900 mL medium.";
  const comparator = options.comparator ?? "≤";
  const assay = options.assay ?? "Assay result must be 95.0% to 105.0% of label claim.";

  const children: Array<Paragraph | Table> = [
    new Paragraph({ text: options.title, heading: HeadingLevel.TITLE }),
    heading("1. Description"),
    para("DemoTab 500 mg tablets are white, round, film-coated tablets supplied in HDPE containers of 20 tablets."),
    heading("2. Identification"),
    para("The infrared spectrum of the sample corresponds to the reference standard. The principal peak is observed at 221 nm.")
  ];

  if (!options.omitDissolution) {
    children.push(heading("3. Dissolution"));
    children.push(para(dissolution));
  }

  children.push(
    heading("4. Assay"),
    para(assay),
    para("% Assay = (As / Ar) × (Cr / Cs) × 100"),
    heading("5. Related Substances"),
    para(`Any individual impurity must be ${comparator} 2.0%. Total impurities must be ≤ 5.0%.`),
    heading("6. Microbial Limits"),
    para("Total aerobic microbial count must be ≤ 2000 cfu/g."),
    makeTable([
      ["Test", "Acceptance criteria", "Method"],
      ["Assay", "95.0% to 105.0%", "HPLC at 1.0 mL/min"],
      ["Dissolution", "NLT 80% in 30 min", "50 rpm, 900 mL"],
      ["Microbial limits", "≤ 2000 cfu/g", "Plate count"]
    ])
  );

  return new Document({ sections: [{ children }] });
}

async function writeDoc(filePath: string, options: DemoDocOptions): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const buffer = await Packer.toBuffer(buildDemoDoc(options));
  await fs.writeFile(filePath, buffer);
}

export async function createDemoFixtures(): Promise<void> {
  await writeDoc("eval-input/reference.docx", { title: "DemoTab 500 mg Reference Specification" });
  await writeDoc("eval-input/generated.docx", {
    title: "DemoTab 500 mg Generated Specification",
    dissolution: "NLT 80% of the labeled amount dissolves in 30 min at 50 rpm using 900 mL medium."
  });

  await writeDoc("fixtures/docx-cases/pass/reference.docx", { title: "DemoTab 500 mg Reference Specification" });
  await writeDoc("fixtures/docx-cases/pass/generated.docx", {
    title: "DemoTab 500 mg Generated Specification",
    dissolution: "NLT 80% of the labeled amount dissolves in 30 min at 50 rpm using 900 mL medium."
  });

  await writeDoc("fixtures/docx-cases/review/reference.docx", { title: "DemoTab 500 mg Reference Specification" });
  await writeDoc("fixtures/docx-cases/review/generated.docx", {
    title: "DemoTab 500 mg Numeric Review Specification",
    temperature: "37 ± 0.5 °C",
    comparator: "≥"
  });

  await writeDoc("fixtures/docx-cases/fail/reference.docx", { title: "DemoTab 500 mg Reference Specification" });
  await writeDoc("fixtures/docx-cases/fail/generated.docx", {
    title: "DemoTab 500 mg Missing Section Specification",
    sparseFailure: true
  });
}

if (import.meta.url.endsWith("create-demo-fixtures.ts")) {
  createDemoFixtures().then(() => {
    console.log("Created demo DOCX fixtures.");
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

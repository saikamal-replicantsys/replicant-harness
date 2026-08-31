import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import type { DocumentAdapter, DocumentParseOptions } from "./document-adapter.js";
import type { DocumentType, NormalizedBlock, NormalizedDocument } from "./normalized-document.js";
import { deterministicBlockId, slugId } from "./document-ids.js";
import { normalizeText } from "../../tools/normalize-document.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  textNodeName: "#text"
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function textFromNode(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join("");
  if (typeof node !== "object") return "";
  const record = node as Record<string, unknown>;
  if (typeof record["#text"] === "string" || typeof record["#text"] === "number") return String(record["#text"]);
  return Object.values(record).map(textFromNode).join("");
}

async function parseXml(zip: JSZip, filePath: string): Promise<Record<string, unknown> | undefined> {
  const xml = await zip.file(filePath)?.async("string");
  return xml ? parser.parse(xml) as Record<string, unknown> : undefined;
}

async function sharedStrings(zip: JSZip): Promise<string[]> {
  const parsed = await parseXml(zip, "xl/sharedStrings.xml");
  const items = asArray((parsed?.sst as Record<string, unknown> | undefined)?.si as Record<string, unknown> | Record<string, unknown>[] | undefined);
  return items.map((item) => normalizeText(textFromNode(item)));
}

async function sheetTargets(zip: JSZip): Promise<Array<{ name: string; target: string }>> {
  const workbook = await parseXml(zip, "xl/workbook.xml");
  const rels = await parseXml(zip, "xl/_rels/workbook.xml.rels");
  const sheetsContainer = (workbook?.workbook as Record<string, unknown> | undefined)?.sheets as Record<string, unknown> | undefined;
  const sheets = asArray(sheetsContainer?.sheet as Record<string, unknown> | Record<string, unknown>[] | undefined);
  const relationships = asArray((rels?.Relationships as Record<string, unknown> | undefined)?.Relationship as Record<string, unknown> | Record<string, unknown>[] | undefined);
  const targetById = new Map(relationships.map((relationship) => [String(relationship.Id), String(relationship.Target)]));

  return sheets.map((sheet) => {
    const target = targetById.get(String(sheet.id)) ?? `worksheets/sheet${String(sheet.sheetId)}.xml`;
    return { name: String(sheet.name), target: `xl/${target.replace(/^\/?xl\//, "")}` };
  });
}

function valueFromCell(cell: Record<string, unknown>, strings: string[]): string {
  const rawValue = cell.v == null ? "" : String(cell.v);
  if (cell.t === "s") return strings[Number(rawValue)] ?? rawValue;
  if (cell.t === "inlineStr") return textFromNode(cell.is);
  if (cell.t === "b") return rawValue === "1" ? "TRUE" : "FALSE";
  return rawValue;
}

function formulaFromCell(cell: Record<string, unknown>): string | undefined {
  if (typeof cell.f === "string" || typeof cell.f === "number") return String(cell.f);
  if (cell.f && typeof cell.f === "object") return textFromNode(cell.f);
  return undefined;
}

async function rowsFromSheet(zip: JSZip, target: string, strings: string[]): Promise<{ rows: string[][]; populatedCells: Array<{ ref: string; text: string }>; range?: string }> {
  const parsed = await parseXml(zip, target);
  const worksheet = parsed?.worksheet as Record<string, unknown> | undefined;
  const range = (worksheet?.dimension as Record<string, unknown> | undefined)?.ref as string | undefined;
  const sheetData = worksheet?.sheetData as Record<string, unknown> | undefined;
  const rows = asArray(sheetData?.row as Record<string, unknown> | Record<string, unknown>[] | undefined);
  const tableRows: string[][] = [["Cell", "Value"]];
  const populatedCells: Array<{ ref: string; text: string }> = [];

  for (const row of rows) {
    for (const cell of asArray(row.c as Record<string, unknown> | Record<string, unknown>[] | undefined)) {
      const ref = typeof cell.r === "string" ? cell.r : "";
      if (!ref) continue;
      const formula = formulaFromCell(cell);
      const displayed = normalizeText(valueFromCell(cell, strings));
      const text = normalizeText(formula ? `${displayed} (formula: =${formula})` : displayed);
      if (!text) continue;
      tableRows.push([ref, text]);
      populatedCells.push({ ref, text });
    }
  }

  return { rows: tableRows, populatedCells, range };
}

export class XlsxDocumentAdapter implements DocumentAdapter {
  supports(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === ".xlsx";
  }

  async parse(filePath: string, options: DocumentType | DocumentParseOptions): Promise<NormalizedDocument> {
    if (!this.supports(filePath)) throw new Error(`XlsxDocumentAdapter only supports .xlsx files: ${filePath}`);
    const parseOptions = typeof options === "string" ? { documentType: options } : options;
    const zip = await JSZip.loadAsync(await fs.readFile(filePath));
    const strings = await sharedStrings(zip);
    const sheets = await sheetTargets(zip);
    const documentId = slugId(filePath, parseOptions.documentType);
    const blocks: NormalizedBlock[] = [];
    const workbookName = path.basename(filePath);

    const titleBlockId = deterministicBlockId(documentId, blocks.length);
    blocks.push({
      blockId: titleBlockId,
      type: "heading",
      text: `Workbook: ${workbookName}`,
      level: 1,
      location: { blockId: titleBlockId }
    });

    for (const sheet of sheets) {
      const { rows, populatedCells, range } = await rowsFromSheet(zip, sheet.target, strings);
      const headingBlockId = deterministicBlockId(documentId, blocks.length);
      blocks.push({
        blockId: headingBlockId,
        type: "heading",
        text: `Sheet: ${sheet.name}`,
        level: 2,
        location: { section: sheet.name, sheet: sheet.name, cellRange: range, blockId: headingBlockId }
      });

      if (rows.length > 1) {
        const tableBlockId = deterministicBlockId(documentId, blocks.length);
        blocks.push({
          blockId: tableBlockId,
          type: "table",
          text: rows.map((row) => row.join(" | ")).join("\n"),
          rows,
          location: { section: sheet.name, sheet: sheet.name, cellRange: range, blockId: tableBlockId }
        });
      }

      for (const cell of populatedCells) {
        const blockId = deterministicBlockId(documentId, blocks.length);
        blocks.push({
          blockId,
          type: "paragraph",
          text: `${cell.ref}: ${cell.text}`,
          location: { section: sheet.name, sheet: sheet.name, cellRange: cell.ref, blockId }
        });
      }
    }

    return {
      documentId,
      clientId: parseOptions.clientId,
      sourceFile: filePath,
      normalizedFile: parseOptions.normalizedFile,
      fileName: workbookName,
      fileType: "xlsx",
      documentType: parseOptions.documentType,
      title: workbookName,
      blocks,
      fullText: blocks.map((block) => block.text).join("\n")
    };
  }
}

import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import mammoth from "mammoth";
import { XMLParser } from "fast-xml-parser";
import type { ExtractedDocument, ExtractedHeading, ExtractedParagraph, ExtractedSection, ExtractedTable } from "../contracts/extracted-document.js";
import { normalizeText } from "./normalize-document.js";

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
  if (typeof record["#text"] === "string" || typeof record["#text"] === "number") {
    return String(record["#text"]);
  }
  return ["t", "tab", "br", "r", "p", "tc", "tr", "tbl"]
    .map((key) => textFromNode(record[key]))
    .join("");
}

function styleFromParagraph(paragraph: Record<string, unknown>): string | undefined {
  const pPr = paragraph.pPr as Record<string, unknown> | undefined;
  const pStyle = pPr?.pStyle as Record<string, unknown> | undefined;
  return typeof pStyle?.val === "string" ? pStyle.val : undefined;
}

function headingLevel(text: string, style?: string): number | undefined {
  const styleMatch = style?.match(/heading\s*(\d+)/i) ?? style?.match(/Heading(\d+)/i);
  if (styleMatch?.[1]) return Number(styleMatch[1]);
  if (/^\s*\d+(?:\.\d+)*\.?\s+\S+/.test(text)) return text.split(".").length;
  return undefined;
}

function extractParagraph(paragraph: Record<string, unknown>, index: number): ExtractedParagraph {
  const text = normalizeText(textFromNode(paragraph));
  return { index, text, style: styleFromParagraph(paragraph) };
}

function extractTable(table: Record<string, unknown>, index: number): ExtractedTable {
  const rows = asArray(table.tr as Record<string, unknown> | Record<string, unknown>[]).map((row) => {
    return asArray(row.tc as Record<string, unknown> | Record<string, unknown>[]).map((cell) => normalizeText(textFromNode(cell)));
  });
  return { index, rows };
}

function buildSections(paragraphs: ExtractedParagraph[], headings: ExtractedHeading[]): ExtractedSection[] {
  if (headings.length === 0) {
    return [{
      heading: "Document",
      content: paragraphs.map((paragraph) => paragraph.text).join("\n"),
      startIndex: 0,
      endIndex: paragraphs.at(-1)?.index ?? 0
    }];
  }

  return headings.map((heading, headingIndex) => {
    const nextHeading = headings[headingIndex + 1];
    const content = paragraphs
      .filter((paragraph) => paragraph.index > heading.index && (!nextHeading || paragraph.index < nextHeading.index))
      .map((paragraph) => paragraph.text)
      .join("\n");
    return {
      heading: heading.text,
      level: heading.level,
      content,
      startIndex: heading.index,
      endIndex: nextHeading ? nextHeading.index - 1 : paragraphs.at(-1)?.index ?? heading.index
    };
  });
}

export async function extractDocument(filePath: string): Promise<ExtractedDocument> {
  const buffer = await fs.readFile(filePath);
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) {
    throw new Error(`Unable to read word/document.xml from ${filePath}`);
  }

  const parsed = parser.parse(documentXml);
  const body = parsed?.document?.body as Record<string, unknown> | undefined;
  const bodyChildren = asArray(body?.p as Record<string, unknown> | Record<string, unknown>[]);
  const tablesFromBody = asArray(body?.tbl as Record<string, unknown> | Record<string, unknown>[]);

  // fast-xml-parser groups same-name body children, so paragraphs and tables are extracted reliably
  // but their exact interleaving is approximate in V1. Paragraph order and table order are preserved.
  const paragraphs = bodyChildren
    .map((paragraph, index) => extractParagraph(paragraph, index))
    .filter((paragraph) => paragraph.text.length > 0);

  const headings = paragraphs
    .map((paragraph): ExtractedHeading | undefined => {
      const level = headingLevel(paragraph.text, paragraph.style);
      return level ? { index: paragraph.index, text: paragraph.text, level } : undefined;
    })
    .filter((heading): heading is ExtractedHeading => Boolean(heading));

  const tables = tablesFromBody.map((table, index) => extractTable(table, index));
  const tableText = tables.flatMap((table) => table.rows.map((row) => row.join(" | "))).join("\n");
  let fullText = paragraphs.map((paragraph) => paragraph.text).join("\n");

  // Mammoth is used as a broad text fallback because it handles some Word constructs
  // better than direct XML traversal. XML extraction remains the source for headings/tables.
  const mammothText = normalizeText((await mammoth.extractRawText({ buffer })).value);
  if (mammothText.length > fullText.length) fullText = mammothText;
  if (tableText) fullText = normalizeText(`${fullText}\n${tableText}`);

  return {
    fileName: path.basename(filePath),
    fullText,
    paragraphs,
    headings,
    sections: buildSections(paragraphs, headings),
    tables
  };
}

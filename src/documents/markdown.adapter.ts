import fs from "node:fs/promises";
import path from "node:path";
import type { DocumentAdapter } from "./document-adapter.js";
import type { DocumentType, NormalizedBlock, NormalizedBlockType, NormalizedDocument } from "./normalized-document.js";

function slugId(filePath: string, documentType: DocumentType): string {
  const base = path.basename(filePath, path.extname(filePath)).toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (base.includes("DOCUMENT-CONTROL-SOP")) return "SOP-DEMO-001";
  if (base.includes("BATCH-RECORD")) return "TARGET-DEMO-001";
  return `${documentType.toUpperCase()}-${base || "DOCUMENT"}`;
}

function blockType(line: string): { type: NormalizedBlockType; text: string; level?: number; rows?: string[][] } {
  const heading = line.match(/^(#{1,6})\s+(.+)$/);
  if (heading) return { type: "heading", text: heading[2]!.trim(), level: heading[1]!.length };
  const bullet = line.match(/^[-*]\s+(.+)$/);
  if (bullet) return { type: "bullet", text: bullet[1]!.trim() };
  const numbered = line.match(/^\d+[.)]\s+(.+)$/);
  if (numbered) return { type: "numbered", text: numbered[1]!.trim() };
  if (/^\|.+\|$/.test(line)) {
    return { type: "table", text: line, rows: [line.split("|").map((cell) => cell.trim()).filter(Boolean)] };
  }
  return { type: "paragraph", text: line.trim() };
}

export class MarkdownDocumentAdapter implements DocumentAdapter {
  supports(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === ".md";
  }

  async parse(filePath: string, documentType: DocumentType): Promise<NormalizedDocument> {
    if (!this.supports(filePath)) throw new Error(`MarkdownDocumentAdapter only supports .md files: ${filePath}`);
    const raw = await fs.readFile(filePath, "utf8");
    const documentId = slugId(filePath, documentType);
    const lines = raw.replace(/\r\n?/g, "\n").split("\n");
    const blocks: NormalizedBlock[] = [];
    let currentSection = "";
    let firstHeading = "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || /^<!--/.test(line)) continue;
      if (/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line)) continue;
      const parsed = blockType(line);
      if (parsed.type === "heading") {
        currentSection = parsed.text;
        firstHeading ||= parsed.text;
      }
      const blockId = `${documentId}-B${String(blocks.length + 1).padStart(3, "0")}`;
      blocks.push({
        blockId,
        type: parsed.type,
        text: parsed.text,
        level: parsed.level,
        rows: parsed.rows,
        location: {
          section: currentSection || undefined,
          blockId
        }
      });
    }

    return {
      documentId,
      fileName: path.basename(filePath),
      fileType: "markdown",
      documentType,
      title: firstHeading || path.basename(filePath, path.extname(filePath)),
      blocks,
      fullText: blocks.map((block) => block.text).join("\n")
    };
  }
}

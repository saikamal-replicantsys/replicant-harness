import path from "node:path";
import type { DocumentAdapter, DocumentParseOptions } from "./document-adapter.js";
import type { DocumentType, NormalizedBlock, NormalizedDocument } from "./normalized-document.js";
import { deterministicBlockId, slugId } from "./document-ids.js";
import { extractDocument } from "../../tools/extract-document.js";

function isHeading(paragraphIndex: number, headingIndexes: Set<number>): boolean {
  return headingIndexes.has(paragraphIndex);
}

export class DocxDocumentAdapter implements DocumentAdapter {
  supports(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === ".docx";
  }

  async parse(filePath: string, options: DocumentType | DocumentParseOptions): Promise<NormalizedDocument> {
    if (!this.supports(filePath)) throw new Error(`DocxDocumentAdapter only supports .docx files: ${filePath}`);
    const parseOptions = typeof options === "string" ? { documentType: options } : options;
    const extracted = await extractDocument(filePath);
    const documentId = slugId(filePath, parseOptions.documentType);
    const headingIndexes = new Set(extracted.headings.map((heading) => heading.index));
    const headingByIndex = new Map(extracted.headings.map((heading) => [heading.index, heading]));
    const blocks: NormalizedBlock[] = [];
    let currentSection = "";

    for (const paragraph of extracted.paragraphs) {
      const heading = headingByIndex.get(paragraph.index);
      if (isHeading(paragraph.index, headingIndexes)) currentSection = paragraph.text;
      const blockId = deterministicBlockId(documentId, blocks.length);
      blocks.push({
        blockId,
        type: heading ? "heading" : "paragraph",
        text: paragraph.text,
        level: heading?.level,
        location: {
          section: currentSection || undefined,
          paragraphIndex: paragraph.index + 1,
          blockId
        }
      });
    }

    for (const table of extracted.tables) {
      const blockId = deterministicBlockId(documentId, blocks.length);
      blocks.push({
        blockId,
        type: "table",
        text: table.rows.map((row) => row.join(" | ")).join("\n"),
        rows: table.rows,
        location: {
          section: currentSection || undefined,
          blockId
        }
      });
    }

    return {
      documentId,
      clientId: parseOptions.clientId,
      sourceFile: filePath,
      normalizedFile: parseOptions.normalizedFile,
      fileName: path.basename(filePath),
      fileType: "docx",
      documentType: parseOptions.documentType,
      title: extracted.headings[0]?.text ?? path.basename(filePath, path.extname(filePath)),
      blocks,
      fullText: blocks.map((block) => block.text).join("\n")
    };
  }
}

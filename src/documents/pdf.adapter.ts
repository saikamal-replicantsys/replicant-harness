import fs from "node:fs/promises";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import type { DocumentAdapter, DocumentParseOptions } from "./document-adapter.js";
import type { DocumentType, NormalizedBlock, NormalizedDocument } from "./normalized-document.js";
import { deterministicBlockId, slugId } from "./document-ids.js";
import { normalizeText } from "../../tools/normalize-document.js";

export class PdfDocumentAdapter implements DocumentAdapter {
  supports(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === ".pdf";
  }

  async parse(filePath: string, options: DocumentType | DocumentParseOptions): Promise<NormalizedDocument> {
    if (!this.supports(filePath)) throw new Error(`PdfDocumentAdapter only supports .pdf files: ${filePath}`);
    const parseOptions = typeof options === "string" ? { documentType: options } : options;
    const documentId = slugId(filePath, parseOptions.documentType);
    const parser = new PDFParse({ data: await fs.readFile(filePath) });
    try {
      const result = await parser.getText();
      const blocks: NormalizedBlock[] = [];
      const title = path.basename(filePath);
      const titleBlockId = deterministicBlockId(documentId, blocks.length);
      blocks.push({
        blockId: titleBlockId,
        type: "heading",
        text: `PDF: ${title}`,
        level: 1,
        location: { blockId: titleBlockId }
      });

      for (const page of result.pages) {
        const pageText = normalizeText(page.text);
        if (!pageText) continue;
        const paragraphs = pageText.split(/\n{2,}|(?<=\.)\s+(?=[A-Z0-9])/).map((paragraph) => normalizeText(paragraph)).filter(Boolean);
        for (const paragraph of paragraphs) {
          const blockId = deterministicBlockId(documentId, blocks.length);
          blocks.push({
            blockId,
            type: "paragraph",
            text: paragraph,
            location: { page: page.num, paragraphIndex: blocks.length, blockId }
          });
        }
      }

      return {
        documentId,
        clientId: parseOptions.clientId,
        sourceFile: filePath,
        normalizedFile: parseOptions.normalizedFile,
        fileName: title,
        fileType: "pdf",
        documentType: parseOptions.documentType,
        title,
        blocks,
        fullText: blocks.map((block) => block.text).join("\n")
      };
    } finally {
      await parser.destroy();
    }
  }
}

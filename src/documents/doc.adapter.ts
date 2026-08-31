import path from "node:path";
import type { DocumentAdapter, DocumentParseOptions } from "./document-adapter.js";
import type { DocumentType, NormalizedDocument } from "./normalized-document.js";

export class UnsupportedDocDocumentAdapter implements DocumentAdapter {
  supports(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === ".doc";
  }

  async parse(filePath: string, _options: DocumentType | DocumentParseOptions): Promise<NormalizedDocument> {
    throw new Error(`Legacy .doc ingestion is not supported for ${path.basename(filePath)}. Convert the file to .docx and run ingest again.`);
  }
}

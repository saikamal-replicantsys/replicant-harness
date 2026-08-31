import type { DocumentType, NormalizedDocument } from "./normalized-document.js";

export interface DocumentParseOptions {
  documentType: DocumentType;
  clientId?: string;
  normalizedFile?: string;
}

export interface DocumentAdapter {
  supports(filePath: string): boolean;
  parse(filePath: string, options: DocumentType | DocumentParseOptions): Promise<NormalizedDocument>;
}

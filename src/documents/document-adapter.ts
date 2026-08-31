import type { DocumentType, NormalizedDocument } from "./normalized-document.js";

export interface DocumentAdapter {
  supports(filePath: string): boolean;
  parse(filePath: string, documentType: DocumentType): Promise<NormalizedDocument>;
}

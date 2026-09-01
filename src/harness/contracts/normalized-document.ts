export type DocumentType = "sop" | "target";
export type NormalizedBlockType = "heading" | "paragraph" | "bullet" | "numbered" | "table";
export type NormalizedFileType = "markdown" | "docx" | "xlsx" | "yaml" | "doc";

export interface NormalizedLocation {
  page?: number;
  section?: string;
  sheet?: string;
  cellRange?: string;
  paragraphIndex?: number;
  blockId?: string;
}

export interface NormalizedBlock {
  blockId: string;
  type: NormalizedBlockType;
  text: string;
  level?: number;
  rows?: string[][];
  location: NormalizedLocation;
}

export interface NormalizedDocument {
  documentId: string;
  clientId?: string;
  sourceFile?: string;
  normalizedFile?: string;
  fileName: string;
  fileType: NormalizedFileType;
  documentType: DocumentType;
  title: string;
  blocks: NormalizedBlock[];
  fullText: string;
}

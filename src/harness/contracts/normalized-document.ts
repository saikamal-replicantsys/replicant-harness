export type DocumentType = "sop" | "target";
export type NormalizedBlockType = "heading" | "paragraph" | "bullet" | "numbered" | "table";

export interface NormalizedLocation {
  page?: number;
  section?: string;
  sheet?: string;
  cellRange?: string;
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
  fileName: string;
  fileType: "markdown";
  documentType: DocumentType;
  title: string;
  blocks: NormalizedBlock[];
  fullText: string;
}

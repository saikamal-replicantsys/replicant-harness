export interface ExtractedParagraph {
  index: number;
  text: string;
  style?: string;
}

export interface ExtractedHeading {
  index: number;
  text: string;
  level?: number;
}

export interface ExtractedSection {
  heading: string;
  level?: number;
  content: string;
  startIndex: number;
  endIndex: number;
}

export interface ExtractedTable {
  index: number;
  rows: string[][];
}

export interface ExtractedDocument {
  fileName: string;
  fullText: string;
  paragraphs: ExtractedParagraph[];
  headings: ExtractedHeading[];
  sections: ExtractedSection[];
  tables: ExtractedTable[];
}

export interface NormalizedDocument extends ExtractedDocument {
  rawText: string;
  normalizedText: string;
}

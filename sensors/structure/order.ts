import type { SectionAlignment } from "../../contracts/evaluation-result.js";

export interface SectionOrderResult {
  matched: number;
  inversions: number;
  score: number;
}

export function sectionOrderScore(alignments: SectionAlignment[]): SectionOrderResult {
  const positions = alignments
    .filter((alignment) => alignment.generatedSection)
    .map((alignment) => alignment.generatedSection!.startIndex);

  let inversions = 0;
  for (let i = 0; i < positions.length; i += 1) {
    for (let j = i + 1; j < positions.length; j += 1) {
      if ((positions[i] ?? 0) > (positions[j] ?? 0)) inversions += 1;
    }
  }

  const maxInversions = (positions.length * (positions.length - 1)) / 2;
  return {
    matched: positions.length,
    inversions,
    score: maxInversions === 0 ? 1 : 1 - inversions / maxInversions
  };
}

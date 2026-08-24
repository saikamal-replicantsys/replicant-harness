export const scoringWeights = {
  sectionCoverage: 0.15,
  structuralSimilarity: 0.10,
  textSimilarity: 0.15,
  numericFidelity: 0.20,
  unitFidelity: 0.10,
  tableFidelity: 0.10,
  completeness: 0.20
} as const;

export const decisionThresholds = {
  pass: 85,
  review: 70
} as const;

export const sensorThresholds = {
  fuzzyHeadingMatch: 0.86,
  fallbackSectionTextMatch: 0.42,
  sentenceCovered: 0.58,
  extraSentenceMatched: 0.54,
  tableMatched: 0.55,
  numericContextMatch: 0.35,
  majorNumericRelativeChange: 0.25
} as const;

export const criticalRules = {
  changedComparator: true,
  majorNumericMismatch: true,
  missingTopLevelSection: true
} as const;

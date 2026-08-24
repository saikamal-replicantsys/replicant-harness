const unitAliases: Array<[RegExp, string]> = [
  [/\bmicroliters?\b/gi, "µL"],
  [/\bmicrolitres?\b/gi, "µL"],
  [/\bmicrometers?\b/gi, "µm"],
  [/\bmicrometres?\b/gi, "µm"],
  [/\bmilliliters?\b/gi, "mL"],
  [/\bmillilitres?\b/gi, "mL"],
  [/\bminutes?\b/gi, "min"],
  [/\bseconds?\b/gi, "sec"],
  [/\bdegrees?\s*celsius\b/gi, "°C"],
  [/\bdeg\.?\s*c\b/gi, "°C"]
];

export function normalizeText(input: string): string {
  let text = input.normalize("NFKC");
  text = text
    .replace(/[“”„‟]/g, "\"")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/[×✕]/g, "x")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/\s*±\s*/g, " ± ")
    .replace(/\s*°\s*C\b/gi, "°C")
    .replace(/([,;:])(?=\S)/g, "$1 ")
    .replace(/\s+([,.;:])/g, "$1");

  for (const [pattern, replacement] of unitAliases) {
    text = text.replace(pattern, replacement);
  }

  return text.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function normalizeForComparison(input: string): string {
  return normalizeText(input).toLowerCase();
}

export function tokenize(input: string): string[] {
  return normalizeForComparison(input)
    .replace(/[^\p{L}\p{N}.%µ°/+<>=-]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function splitSentences(input: string): string[] {
  return normalizeText(input)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

export function normalizeHeading(input: string): string {
  return normalizeForComparison(input)
    .replace(/^\s*\d+(?:\.\d+)*\.?\s*/, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

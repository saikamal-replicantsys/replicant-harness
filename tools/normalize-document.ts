const unitAliases: Array<[RegExp, string]> = [
  [/\bmicroliters?\b/gi, "\u00b5L"],
  [/\bmicrolitres?\b/gi, "\u00b5L"],
  [/\bmicrometers?\b/gi, "\u00b5m"],
  [/\bmicrometres?\b/gi, "\u00b5m"],
  [/\bmilliliters?\b/gi, "mL"],
  [/\bmillilitres?\b/gi, "mL"],
  [/\bminutes?\b/gi, "min"],
  [/\bseconds?\b/gi, "sec"],
  [/\bdegrees?\s*celsius\b/gi, "\u00b0C"],
  [/\bdeg\.?\s*c\b/gi, "\u00b0C"]
];

export function normalizeText(input: string): string {
  let text = input.replace(/Î¼/g, "\u00b5").normalize("NFKC");
  text = text
    .replace(/Â±/g, "\u00b1")
    .replace(/Â°/g, "\u00b0")
    .replace(/Âµ|μ/g, "\u00b5")
    .replace(/â‰¤|≤/g, "<=")
    .replace(/â‰¥|≥/g, ">=")
    .replace(/Ã—|âœ•|×/g, "x")
    .replace(/[â€œâ€â€žâ€Ÿ“”„‟]/g, "\"")
    .replace(/[â€˜â€™â€šâ€›‘’‚‛]/g, "'")
    .replace(/[â€â€‘â€’â€“â€”â€•‐‑‒–—―]/g, "-")
    .replace(/\s*\u00b1\s*/g, " \u00b1 ")
    .replace(/\s*\u00b0\s*C\b/gi, "\u00b0C")
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
    .replace(/[^\p{L}\p{N}.%\u00b5\u00b0/+<>=-]+/gu, " ")
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

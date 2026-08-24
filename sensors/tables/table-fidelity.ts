import type { ExtractedTable } from "../../contracts/extracted-document.js";
import { sensorThresholds } from "../../scoring/scoring.config.js";
import { normalizeForComparison, tokenize } from "../../tools/normalize-document.js";
import { rougeL } from "../text-similarity/rouge.js";
import { numericFidelity } from "../factual/numbers.js";

export interface TableFidelityResult {
  referenceTables: number;
  generatedTables: number;
  matchedTables: number;
  score: number;
  details: Array<{
    referenceIndex: number;
    generatedIndex?: number;
    rowScore: number;
    columnScore: number;
    headerSimilarity: number;
    cellSimilarity: number;
    numericScore: number;
    score: number;
  }>;
}

function flatten(table: ExtractedTable): string {
  return table.rows.map((row) => row.join(" | ")).join("\n");
}

function tableScore(reference: ExtractedTable, generated: ExtractedTable) {
  const referenceColumns = Math.max(...reference.rows.map((row) => row.length), 0);
  const generatedColumns = Math.max(...generated.rows.map((row) => row.length), 0);
  const rowScore = 1 - Math.abs(reference.rows.length - generated.rows.length) / Math.max(reference.rows.length, generated.rows.length, 1);
  const columnScore = 1 - Math.abs(referenceColumns - generatedColumns) / Math.max(referenceColumns, generatedColumns, 1);
  const headerSimilarity = rougeL(tokenize(reference.rows[0]?.join(" ") ?? ""), tokenize(generated.rows[0]?.join(" ") ?? ""));
  const cellSimilarity = rougeL(tokenize(flatten(reference)), tokenize(flatten(generated)));
  const numericScore = numericFidelity(flatten(reference), flatten(generated)).score;
  const score = rowScore * 0.15 + columnScore * 0.15 + headerSimilarity * 0.2 + cellSimilarity * 0.35 + numericScore * 0.15;
  return { rowScore, columnScore, headerSimilarity, cellSimilarity, numericScore, score };
}

export function tableFidelity(referenceTables: ExtractedTable[], generatedTables: ExtractedTable[]): TableFidelityResult {
  const used = new Set<number>();
  const details: TableFidelityResult["details"] = [];
  let matchedTables = 0;
  let scoreTotal = 0;

  for (const reference of referenceTables) {
    let bestIndex = -1;
    let best = { rowScore: 0, columnScore: 0, headerSimilarity: 0, cellSimilarity: 0, numericScore: 0, score: 0 };
    generatedTables.forEach((generated, index) => {
      if (used.has(index)) return;
      const candidate = tableScore(reference, generated);
      if (candidate.score > best.score) {
        best = candidate;
        bestIndex = index;
      }
    });

    if (bestIndex >= 0 && best.score >= sensorThresholds.tableMatched) {
      used.add(bestIndex);
      matchedTables += 1;
      scoreTotal += best.score;
      details.push({ referenceIndex: reference.index, generatedIndex: generatedTables[bestIndex]?.index, ...best });
    } else {
      details.push({ referenceIndex: reference.index, ...best });
    }
  }

  return {
    referenceTables: referenceTables.length,
    generatedTables: generatedTables.length,
    matchedTables,
    score: referenceTables.length === 0 ? 1 : scoreTotal / referenceTables.length,
    details
  };
}

export const unitAliases = new Map<string, string>([
  ["mg", "mg"],
  ["g", "g"],
  ["kg", "kg"],
  ["ml", "mL"],
  ["milliliter", "mL"],
  ["millilitre", "mL"],
  ["l", "L"],
  ["µl", "µL"],
  ["ul", "µL"],
  ["microliter", "µL"],
  ["microlitre", "µL"],
  ["µm", "µm"],
  ["um", "µm"],
  ["micrometer", "µm"],
  ["micrometre", "µm"],
  ["nm", "nm"],
  ["ppm", "ppm"],
  ["rpm", "rpm"],
  ["min", "min"],
  ["minute", "min"],
  ["minutes", "min"],
  ["sec", "sec"],
  ["second", "sec"],
  ["seconds", "sec"],
  ["°c", "°C"],
  ["c", "°C"],
  ["%", "%"],
  ["cm-1", "cm-1"],
  ["µg/ml", "µg/mL"],
  ["ug/ml", "µg/mL"],
  ["ml/min", "mL/min"],
  ["cfu/g", "cfu/g"],
  ["tablets", "tablets"],
  ["tablet", "tablets"]
]);

export function normalizeUnit(unit?: string): string | undefined {
  if (!unit) return undefined;
  const key = unit.replace(/\s+/g, "").toLowerCase();
  return unitAliases.get(key) ?? unitAliases.get(key.replace("μ", "µ")) ?? unit;
}

export function unitsEqual(left?: string, right?: string): boolean {
  return normalizeUnit(left) === normalizeUnit(right);
}

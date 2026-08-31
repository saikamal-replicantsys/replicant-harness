import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import path from "node:path";
import type { Ruleset } from "../../harness/contracts/rule.js";
import { GraphStore } from "../../knowledge/graph.store.js";
import { findGeneratedRuleset, readJson, writeJson } from "./store.js";

export async function approveRules(idOrPath: string, approveAll = false): Promise<{ approvedPath: string; approved: number; rejected: number; pending: number }> {
  const rulesetPath = await findGeneratedRuleset(idOrPath);
  const ruleset = await readJson<Ruleset>(rulesetPath);
  const rl = approveAll ? undefined : readline.createInterface({ input, output });
  let approved = 0;
  let rejected = 0;
  let pending = 0;

  try {
    for (const rule of ruleset.rules) {
      let answer = approveAll ? "y" : "s";
      if (rl) {
        console.log(`\nRule: ${rule.ruleId}\nTitle: ${rule.title}\n\nStatement:\n${rule.statement}\n\nSource:\n${rule.source.section ?? "Unknown section"}\n\nEvidence:\n\"${rule.source.sourceText}\"\n\nGrounding:\n${rule.validation?.grounding?.supported ? "PASS" : "REVIEW"}`);
        answer = (await rl.question("Approve? [y/n/s] ")).trim().toLowerCase();
      }
      if (answer === "y") {
        rule.status = "approved";
        approved += 1;
      } else if (answer === "n") {
        rule.status = "rejected";
        rejected += 1;
      } else {
        rule.status = "pending_approval";
        pending += 1;
      }
    }
  } finally {
    rl?.close();
  }

  ruleset.status = pending === 0 && rejected === 0 ? "approved" : "partially_approved";
  const approvedPath = await writeJson(path.join("data/rulesets/approved", `${ruleset.rulesetId}.json`), ruleset);
  await new GraphStore().addRuleset(ruleset);
  return { approvedPath, approved, rejected, pending };
}

const command = process.argv[2];
const rest = process.argv.slice(3);

if (!command) {
  console.error("Usage: npm run cli -- <rules|approve-rules|qc|lineage|demo> ...");
  process.exit(1);
}

process.argv = [process.argv[0] ?? "node", process.argv[1] ?? "cli", ...rest];

if (command === "rules") await import("./generate-rules.js");
else if (command === "approve-rules") await import("./approve-rules.js");
else if (command === "qc") await import("./run-qc.js");
else if (command === "lineage") await import("./lineage.js");
else if (command === "demo") await import("./demo.js");
else {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

#!/usr/bin/env node
// CLI wrapper around lib/secret-scan.mjs.
//
// Two uses:
//   1. The lessons-learned skill runs this on its own draft as a self-check
//      before Step 5. The real enforcement is the PreToolUse hook
//      (hooks/scan-write.mjs) — this just gives the agent a chance to fix
//      things before hitting that hard gate.
//   2. A human (or CI) can run this directly against any saved file:
//        node scan-secrets.mjs lessons-learned/2026-08-12-some-lesson.md
//      Exit code 0 = clean or warnings only. Exit code 1 = blocking findings.
import { readFileSync } from "node:fs";
import { scanText, formatReport } from "../../lib/secret-scan.mjs";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scan-secrets.mjs <file>");
  process.exit(2);
}

const text = readFileSync(path, "utf8");
const findings = scanText(text);
const blocking = findings.filter((f) => f.severity === "block");
const warnings = findings.filter((f) => f.severity === "warn");

if (blocking.length > 0) {
  console.log("BLOCKING — fix these before saving or publishing:");
  console.log(formatReport(blocking));
}
if (warnings.length > 0) {
  if (blocking.length > 0) console.log("");
  console.log("Worth a second look (not blocking):");
  console.log(formatReport(warnings));
}
if (blocking.length === 0 && warnings.length === 0) {
  console.log("Clean: no secrets, credentials, or flagged identifiers detected.");
}

process.exit(blocking.length > 0 ? 1 : 0);

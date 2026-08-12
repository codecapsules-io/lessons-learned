#!/usr/bin/env node
// PreToolUse hook: denies Write/Edit/Bash calls that would put a secret,
// credential, or oversized code block into a lessons-learned/*.md file.
//
// This is the actual security boundary for this plugin. Unlike the skill's
// own scrub instructions, this cannot be talked around by a user telling the
// model "skip that step" — Claude Code enforces the hook's decision itself.
//
// Contract (matches Anthropic's own hookify plugin, cross-checked against
// its source): read the hook-event JSON from stdin, always exit 0, and
// signal a denial via stdout JSON:
//   { "hookSpecificOutput": { "hookEventName": "PreToolUse", "permissionDecision": "deny" },
//     "systemMessage": "<reason>" }
// A non-blocking note is just { "systemMessage": "<note>" }. An empty {}
// allows the call silently.
import { scanText, formatReport } from "../lib/secret-scan.mjs";

const LESSONS_PATH_RE = /lessons-learned[\\/][^\\/]*\.md\b/i;

function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", () => resolve(""));
  });
}

function extractContentToScan(toolName, toolInput) {
  if (toolName === "Write") {
    if (!LESSONS_PATH_RE.test(toolInput.file_path || "")) return null;
    return toolInput.content || "";
  }
  if (toolName === "Edit") {
    if (!LESSONS_PATH_RE.test(toolInput.file_path || "")) return null;
    return toolInput.new_string || "";
  }
  if (toolName === "MultiEdit") {
    if (!LESSONS_PATH_RE.test(toolInput.file_path || "")) return null;
    return (toolInput.edits || []).map((e) => e.new_string || "").join("\n");
  }
  if (toolName === "Bash") {
    const command = toolInput.command || "";
    // Only scan Bash calls that are evidently writing a lessons-learned
    // file (e.g. a heredoc bypassing the Write tool) — scanning every Bash
    // command for secret-shaped strings would false-positive on ordinary,
    // unrelated engineering work and train people to disable the hook.
    if (!LESSONS_PATH_RE.test(command)) return null;
    return command;
  }
  return null;
}

async function main() {
  let input;
  try {
    input = JSON.parse(await readStdin());
  } catch {
    process.stdout.write(JSON.stringify({}));
    return;
  }

  const toolName = input.tool_name || "";
  const toolInput = input.tool_input || {};
  const content = extractContentToScan(toolName, toolInput);

  if (content == null) {
    process.stdout.write(JSON.stringify({}));
    return;
  }

  const findings = scanText(content);
  const blocking = findings.filter((f) => f.severity === "block");
  const warnings = findings.filter((f) => f.severity === "warn");

  if (blocking.length > 0) {
    const message = [
      "lessons-learned secret scan BLOCKED this write.",
      formatReport(blocking),
      "Remove or generalize the flagged value(s) and retry. This check cannot be skipped.",
    ].join("\n\n");
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny" },
        systemMessage: message,
      })
    );
    return;
  }

  if (warnings.length > 0) {
    process.stdout.write(
      JSON.stringify({
        systemMessage: `lessons-learned scan: double-check before publishing —\n${formatReport(warnings)}`,
      })
    );
    return;
  }

  process.stdout.write(JSON.stringify({}));
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(0)); // never block an unrelated tool call due to a hook bug

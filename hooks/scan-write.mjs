#!/usr/bin/env node
// PreToolUse hook: denies Write/Edit/Bash calls that would put a secret,
// credential, or oversized code block into a lessons-learned file.
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
//
// Fail-open vs fail-closed, deliberately different depending on what we
// know: if we can't even tell whether a call is in scope (unparseable
// input), we allow it — every Write/Edit/Bash call in the session hits this
// hook, and denying everything on a parse hiccup would break unrelated,
// ordinary work. But once we've determined a call IS in scope (the path
// resolves under the lessons-learned directory), any failure from here on —
// a scanner bug, a thrown exception — denies. We'd rather block a real
// lessons-learned write on an internal error than silently let an unscanned
// one through. The hooks.json wrapper around this script applies the same
// fail-closed rule one level up, for the case where `node` itself isn't on
// PATH — see hooks/hooks.json.
import { scanText, formatReport } from "../lib/secret-scan.mjs";
import path from "node:path";
import os from "node:os";

const LESSONS_SUBSTRING_RE = /lessons-learned[\\/][^\\/]*\.md\b/i;

function configuredTargetDir() {
  const dir = process.env.LESSONS_LEARNED_DIR || path.join(os.homedir(), ".lessons-learned");
  return path.resolve(dir);
}

function isUnderConfiguredDir(filePath) {
  if (!filePath) return false;
  const resolved = path.resolve(filePath);
  const target = configuredTargetDir();
  return resolved === target || resolved.startsWith(target + path.sep);
}

// A path is in scope if it matches the "lessons-learned" naming convention
// (covers the default ~/.lessons-learned and the shared repo's own
// lessons-learned/ subdirectory used by the optional PR-submission flow) OR
// falls inside whatever LESSONS_LEARNED_DIR is actually configured to right
// now — so renaming the target directory to something that doesn't contain
// the string "lessons-learned" can't silently fall outside this hook's
// protection.
function isInScopePath(filePath) {
  return LESSONS_SUBSTRING_RE.test(filePath || "") || isUnderConfiguredDir(filePath);
}

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
    if (!isInScopePath(toolInput.file_path)) return null;
    return toolInput.content || "";
  }
  if (toolName === "Edit") {
    if (!isInScopePath(toolInput.file_path)) return null;
    return toolInput.new_string || "";
  }
  if (toolName === "MultiEdit") {
    if (!isInScopePath(toolInput.file_path)) return null;
    return (toolInput.edits || []).map((e) => e.new_string || "").join("\n");
  }
  if (toolName === "Bash") {
    const command = toolInput.command || "";
    // Only scan Bash calls that are evidently writing a lessons-learned
    // file (e.g. a heredoc bypassing the Write tool) — scanning every Bash
    // command for secret-shaped strings would false-positive on ordinary,
    // unrelated engineering work and train people to disable the hook.
    // This is a heuristic, not a guarantee: a command that builds the path
    // from concatenated shell variables (so the literal string
    // "lessons-learned" never appears) will not match. That's a known,
    // accepted gap — see SECURITY.md. It does not weaken the Write/Edit
    // coverage above, which Claude Code resolves before this hook ever
    // sees it and can't be dodged by shell string tricks.
    if (!LESSONS_SUBSTRING_RE.test(command)) return null;
    return command;
  }
  return null;
}

function denyResponse(message) {
  return JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny" },
    systemMessage: message,
  });
}

async function main() {
  let input;
  try {
    input = JSON.parse(await readStdin());
  } catch {
    // Can't tell if this call is even in scope — allow rather than block
    // unrelated work over a parse hiccup.
    process.stdout.write(JSON.stringify({}));
    return;
  }

  const toolName = input.tool_name || "";
  const toolInput = input.tool_input || {};

  let content;
  try {
    content = extractContentToScan(toolName, toolInput);
  } catch (err) {
    // Scope determination itself failed unexpectedly. We don't know if this
    // matters, so don't block unrelated work — but this should never
    // happen; if it does repeatedly, that's a bug in this script.
    process.stdout.write(JSON.stringify({}));
    return;
  }

  if (content == null) {
    process.stdout.write(JSON.stringify({}));
    return;
  }

  // From here on, we know this call is in scope. Any failure denies.
  let findings;
  try {
    findings = scanText(content);
  } catch (err) {
    process.stdout.write(
      denyResponse(
        `lessons-learned secret scan hit an internal error and could not verify this write is safe, so it was blocked as a precaution: ${err?.message || err}`
      )
    );
    return;
  }

  const blocking = findings.filter((f) => f.severity === "block");
  const warnings = findings.filter((f) => f.severity === "warn");

  if (blocking.length > 0) {
    const message = [
      "lessons-learned secret scan BLOCKED this write.",
      formatReport(blocking),
      "Remove or generalize the flagged value(s) and retry. This check cannot be skipped.",
    ].join("\n\n");
    process.stdout.write(denyResponse(message));
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
  .catch((err) => {
    // An in-scope call reached here only after extractContentToScan
    // succeeded; a failure in the surrounding promise machinery itself
    // (not the scan) is exceedingly unlikely, but default to deny rather
    // than silently allow, consistent with the rest of this file.
    process.stdout.write(
      denyResponse(`lessons-learned secret scan crashed unexpectedly and blocked this write as a precaution: ${err?.message || err}`)
    );
    process.exit(0);
  });

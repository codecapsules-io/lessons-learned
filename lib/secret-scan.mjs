// Deterministic scanner for the lessons-learned plugin.
//
// This is intentionally NOT model-driven: it is plain regex + entropy math,
// used both as a CLI self-check (skills/lessons-learned/scan-secrets.mjs) and
// as a PreToolUse hook (hooks/scan-write.mjs) that the harness enforces
// regardless of what the model or the user asks it to skip.
//
// Severity tiers, on purpose:
//   "block" — high-confidence, low-false-positive patterns (known key/token
//     formats, private key blocks, credentials embedded in a URL, an
//     explicit password/token/secret assignment). These fail the write.
//   "warn"  — lower-confidence, context-dependent signals (a bare IPv4
//     address, a long high-entropy token with no keyword context). These are
//     surfaced but do not block, because blocking on these has a high enough
//     false-positive rate (git SHAs, resource IDs, hashes) that a hard gate
//     here would just train people to route around the tool.

const PLACEHOLDER_RE =
  /^(changeme|change[-_]?me|placeholder|xxxx+|your[-_].*key.*|<[^>]{1,80}>|redacted|example|dummy|fake|n\/a|none|test123|password123?)$/i;

const PATTERNS = [
  { type: "aws-access-key-id", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { type: "aws-sts-key-id", re: /\bASIA[0-9A-Z]{16}\b/g },
  {
    type: "private-key-block",
    re: /-----BEGIN[ A-Z]*PRIVATE KEY-----/g,
  },
  { type: "github-token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { type: "gitlab-token", re: /\bglpat-[A-Za-z0-9_-]{20,}\b/g },
  { type: "slack-token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { type: "slack-webhook-url", re: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/]+/g },
  { type: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { type: "stripe-key", re: /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{20,}\b/g },
  { type: "npm-token", re: /\bnpm_[A-Za-z0-9]{36,}\b/g },
  {
    type: "jwt",
    re: /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g,
  },
  {
    type: "credential-in-url",
    // scheme://user:pass@host — postgres/mysql/mongodb/redis/amqp/etc.
    re: /\b[a-z][a-z0-9+.-]{1,15}:\/\/[^\s/'"]+:[^\s/'"@]+@[^\s/'"]+/gi,
  },
  {
    type: "assigned-secret",
    re: /\b(?:password|passwd|secret|token|api[_-]?key|apikey|access[_-]?key|client[_-]?secret)\b\s*[:=]\s*["']?([A-Za-z0-9+/_.=-]{8,})["']?/gi,
    group: 1,
  },
];

const WARN_PATTERNS = [
  {
    type: "ipv4-address",
    re: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d{1,2})\.){3}(?:25[0-5]|2[0-4]\d|1?\d{1,2})\b/g,
    excludeValues: new Set(["0.0.0.0", "127.0.0.1", "255.255.255.255"]),
  },
];

const MAX_CODE_BLOCK_LINES = 25;

function shannonEntropy(str) {
  const freq = {};
  for (const ch of str) freq[ch] = (freq[ch] || 0) + 1;
  let entropy = 0;
  for (const count of Object.values(freq)) {
    const p = count / str.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function mask(value) {
  if (value.length <= 6) return "*".repeat(value.length);
  return value.slice(0, 3) + "*".repeat(Math.max(3, value.length - 5)) + value.slice(-2);
}

function scanLine(line, lineNumber, findings, seen) {
  for (const p of PATTERNS) {
    const re = new RegExp(p.re.source, p.re.flags);
    let m;
    while ((m = re.exec(line))) {
      const value = p.group ? m[p.group] : m[0];
      if (!value) continue;
      if (PLACEHOLDER_RE.test(value.trim())) continue;
      const key = `${p.type}:${lineNumber}:${m.index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({ type: p.type, severity: "block", line: lineNumber, masked: mask(value) });
    }
  }

  for (const p of WARN_PATTERNS) {
    const re = new RegExp(p.re.source, p.re.flags);
    let m;
    while ((m = re.exec(line))) {
      const value = m[0];
      if (p.excludeValues && p.excludeValues.has(value)) continue;
      const key = `${p.type}:${lineNumber}:${m.index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({ type: p.type, severity: "warn", line: lineNumber, masked: mask(value) });
    }
  }

  // Generic high-entropy token with no keyword context — warn only (see tier
  // rationale above). Skips pure-numeric runs (timestamps, IDs) and anything
  // already caught above.
  const tokenRe = /\b[A-Za-z0-9+/_-]{24,}\b/g;
  let tm;
  while ((tm = tokenRe.exec(line))) {
    const value = tm[0];
    if (/^[0-9]+$/.test(value)) continue;
    const key = `high-entropy:${lineNumber}:${tm.index}`;
    if (seen.has(key)) continue;
    if (shannonEntropy(value) < 4.0) continue;
    seen.add(key);
    findings.push({ type: "high-entropy-string", severity: "warn", line: lineNumber, masked: mask(value) });
  }
}

function scanStructure(text, findings) {
  const lines = text.split("\n");
  let inBlock = false;
  let blockStart = 0;
  let blockLen = 0;
  lines.forEach((line, idx) => {
    if (/^```/.test(line.trim())) {
      if (!inBlock) {
        inBlock = true;
        blockStart = idx + 1;
        blockLen = 0;
      } else {
        if (blockLen > MAX_CODE_BLOCK_LINES) {
          findings.push({
            type: "oversized-code-block",
            severity: "block",
            line: blockStart,
            masked: `${blockLen} lines (max ${MAX_CODE_BLOCK_LINES})`,
          });
        }
        inBlock = false;
      }
      return;
    }
    if (inBlock) blockLen++;
  });
}

export function scanText(text) {
  const findings = [];
  const seen = new Set();
  const lines = text.split("\n");
  lines.forEach((line, idx) => scanLine(line, idx + 1, findings, seen));
  scanStructure(text, findings);
  return findings;
}

export function formatReport(findings) {
  if (findings.length === 0) return "(none)";
  return findings
    .map((f) => `  line ${f.line}: [${f.type}] ${f.masked}`)
    .join("\n");
}

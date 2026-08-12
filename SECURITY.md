# Security model

This plugin writes engineering lessons that are meant to become public. That
makes "don't leak a secret or a customer's data" the actual requirement, not
a nice-to-have. This document is honest about what is and isn't enforced.

## Threat model

Assume the person invoking `/lessons-learned` might be careless with real
production data pasted earlier in the session, or might deliberately try to
get something sensitive into a public writeup. Assume the session might have
fetched untrusted external content (a webpage, a ticket) that contains
adversarial instructions.

## What is actually enforced (not just advisory)

- **A `PreToolUse` hook** (`hooks/hooks.json` → `hooks/scan-write.mjs`) denies
  any `Write`, `Edit`, or `Bash` call that would put a matched secret,
  credential, private key block, or an oversized code block into a
  `lessons-learned/*.md` file. This is a decision Claude Code's harness
  enforces on the tool call itself — it does not depend on the model
  choosing to comply, and a user instruction to "skip that check" has no
  effect on it. See `lib/secret-scan.mjs` for the exact patterns and the
  severity-tier rationale (high-confidence patterns block; lower-confidence
  signals like a bare IP address only warn, to avoid a false-positive rate
  high enough that people route around the tool).
- **Default save location is outside any git-tracked repo**
  (`~/.lessons-learned` unless `LESSONS_LEARNED_DIR` is set), so a draft
  can't accidentally get swept into a `git add -A` of whatever customer or
  client repo the engineer happens to be working in.
- **The optional PR-submission flow** only runs against an env var the user
  must set explicitly, always clones into a fresh `mktemp -d`, never falls
  back to fabricating a local repo if the clone fails, and never pushes to
  the target repo's default branch directly.

## What is advisory, not enforced (know the limits)

- **Step 4's scrub** (customer names, internal codenames, non-secret
  proprietary detail) is the model reviewing its own draft. It is not a
  security boundary — a user who explicitly wants a specific detail kept in
  can get the model to keep it. The deterministic hook above only catches
  things that are syntactically secret-shaped (keys, tokens, credentials);
  it cannot recognize that "Acme Rockets Inc" is a customer name. That part
  genuinely depends on the model, and on the human review before merge.
- **This plugin cannot retroactively scrub the session that produced the
  draft.** If a real secret was pasted into the conversation earlier in the
  session, it already exists in this machine's local session history
  regardless of what this skill does with the final file. Don't paste real
  production secrets into any AI session — rotate first if you have to
  debug with one.
- **A determined user with legitimate tool access can still get some short
  string of information out if they try hard enough.** The goal here is to
  make that hard, force a human checkpoint before anything is public, and
  make any leak that does get through cheap to catch and revert — not to
  claim it's impossible.

## What you must configure yourself (this plugin can't do it for you)

- **Branch protection on the target repo's default branch.** Require PR
  review before merge. Without this, the PR-submission flow's "a human
  reviews it" safety net doesn't actually exist — anyone with push access can
  put unreviewed content directly on the branch that's live to the public.
- **Keep the intake repo's visibility intentional.** If it's public, every
  merged commit is public immediately; if you want a staging area before
  anything is public-facing, use a private repo and a separate, explicit
  publish step.

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

- **A `PreToolUse` hook** (`hooks/hooks.json` → `hooks/scan-write-wrapper.sh`
  → `hooks/scan-write.mjs`) denies any `Write`, `Edit`, or `Bash` call that
  would put a matched secret, credential, private key block, or an oversized
  code block into a lessons-learned file. This is a decision Claude Code's
  harness enforces on the tool call itself — it does not depend on the model
  choosing to comply, and a user instruction to "skip that check" has no
  effect on it. Verified live against the real harness, not just by reading
  the code: told a test session to ignore the scrub step and write a
  credential verbatim with no confirmation — it attempted the `Write` call,
  and the hook denied it. See `lib/secret-scan.mjs` for the exact patterns
  and the severity-tier rationale (high-confidence patterns block;
  lower-confidence signals like a bare IP address only warn, to avoid a
  false-positive rate high enough that people route around the tool).
  - **The hook fails closed, not open, once a call is in scope.** Claude
    Code itself does not "require" a hook command to succeed — a hook
    command that errors (wrong binary, crash, timeout) is, by default,
    treated as if the hook said nothing, i.e. the tool call proceeds. This
    was tested and confirmed directly: with `node` removed from `PATH`
    entirely, a Write call with a plaintext secret went through and created
    the file, with no warning shown anywhere. `hooks/scan-write-wrapper.sh`
    exists specifically to close that gap — it's a small POSIX shell script
    (no Node dependency) that decides scope first, then denies outright if
    `node` isn't available for an in-scope call, rather than letting an
    unscanned write through. It's scoped narrowly (only calls whose payload
    mentions `lessons-learned`, or the configured `LESSONS_LEARNED_DIR`) so
    a machine without Node.js sees zero impact on unrelated, ordinary work —
    confirmed with `node` stripped from `PATH` end-to-end. `scan-write.mjs`
    itself applies the same rule one layer in: once it has determined a call
    is in scope, an internal scanner exception also denies rather than
    silently allowing.
  - **Scope matching accounts for a reconfigured save location.** Renaming
    the target directory via `LESSONS_LEARNED_DIR` to something that
    doesn't contain the literal string "lessons-learned" used to fall
    outside the hook's path-matching entirely — fixed; the hook now also
    checks containment against whatever `LESSONS_LEARNED_DIR` actually
    resolves to at the time it runs.
  - **Known, accepted gap: the `Bash` match is a text heuristic, not a
    guarantee.** It looks for the literal substring `lessons-learned` in
    the command string. A command that builds the same path from
    concatenated shell variables (so that literal string never appears)
    won't match. This doesn't weaken the `Write`/`Edit` coverage above,
    which Claude Code resolves to a real path before the hook ever sees it
    and can't be dodged by shell string tricks — but a sufficiently
    deliberate user can still route around the `Bash`-specific check. Not
    chasing this further; see "a determined user..." below.
- **Default save location is outside any git-tracked repo**
  (`~/.lessons-learned` unless `LESSONS_LEARNED_DIR` is set), so a draft
  can't accidentally get swept into a `git add -A` of whatever customer or
  client repo the engineer happens to be working in.
- **The optional PR-submission flow** only runs against an env var the user
  must set explicitly (and never a value the session set on itself earlier
  via `export` — only a value already present before the conversation
  started counts), requires the user to confirm the literal URL shown, not
  just "yes," always clones into a fresh `mktemp -d` with
  `--no-recurse-submodules`, never falls back to fabricating a local repo if
  the clone fails, pushes a branch but never to the target repo's default
  branch, and stops after printing the compare URL rather than also opening
  the PR automatically — one fewer autonomous action against an external
  service on the user's behalf, and one more point where a human has to
  actually look before anything moves further.

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

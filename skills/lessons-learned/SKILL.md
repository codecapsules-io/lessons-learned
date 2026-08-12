---
name: lessons-learned
description: Write up a short engineering lesson from this session in ASD-STE100 Simplified Technical English and save it locally. Invoke at the end of a session that produced a genuinely useful, non-obvious lesson (a bug root cause, a workaround, a wrong assumption corrected, a tool quirk discovered) — not for routine or trivial sessions.
---

# Lessons Learned

Turn a real session into a short, plain-language writeup the rest of the team can
learn from in two minutes. This is a raw draft for editorial review, not final
published copy — favor accuracy and clarity over polish.

**These writeups are intended to become public.** Treat every draft as if it
will be published on the company blog, because it might be. Step 4 below is a
hard requirement, not a suggestion — do not skip it or rush it.

**This is defense in depth, not just this step.** In addition to the manual
scrub in Step 4, this plugin ships a deterministic scanner
(`lib/secret-scan.mjs`) that also runs automatically as a hook on every
`Write`/`Edit`/`Bash` call touching a `lessons-learned/*.md` file. If it finds
a likely secret, credential, or oversized code block, the write is denied by
Claude Code itself — not by this skill's own judgment — and cannot be
bypassed by being asked to. Step 4 exists so you catch things before that
happens, not instead of it.

## Step 0 — Check there is a lesson

Look back over this session. There is a lesson worth writing only if at least one
of these is true:

- A bug had a root cause that was not obvious at first.
- Something failed, and the fix was a workaround or a changed assumption.
- A tool, API, or library behaved in a surprising way.
- An approach was tried and abandoned for a specific, reusable reason.

If none of these apply (the session was routine, or the task was straightforward),
say so plainly and stop. Do not manufacture a lesson from a session that does not
have one.

## Step 1 — Extract the lesson

Identify, in your own understanding first (not yet written for the reader):

- **The problem.** What broke, or what was hard to get right?
- **The wrong turn.** What did we try or assume that did not work?
- **The fix.** What actually worked?
- **The lesson.** What should someone remember next time, and when does it apply?

Keep this scoped to one lesson. If the session surfaced several unrelated
lessons, write the most useful one, or ask the user which one to write.

## Step 2 — Write it in ASD-STE100 Simplified Technical English

ASD-STE100 is a controlled-language standard (used for aircraft maintenance
manuals) that removes ambiguity. Apply these rules to every sentence:

1. **One idea per sentence.** Split compound sentences into two simple ones.
2. **Short sentences.** Aim for under 20 words. Hard cap around 25.
3. **Active voice.** "The build failed" not "The build was failed by...". Name the
   actor: "The script deletes the cache" not "The cache gets deleted."
4. **Simple verb tenses.** Prefer simple present and simple past. Avoid stacked
   modals ("would have been able to") — say what happened plainly.
5. **One word, one meaning.** Pick one term for a thing and reuse it everywhere
   (e.g. always "container", never alternate with "box" or "instance").
6. **No noun stacks.** Rewrite "database connection pool timeout error" as
   "the connection pool timed out" or similar, using prepositions to connect
   ideas instead of piling nouns.
7. **No jargon, idioms, or slang.** No "spin up", "footgun", "just", "simply".
   Say exactly what happened.
8. **No unclear pronouns.** Repeat the noun instead of using "it" or "this" if
   there is any chance of ambiguity.
9. **Numbered steps for sequences.** If the fix was a sequence of actions, use a
   numbered list, one action per line, starting with an imperative verb.
10. **Approved connectors only.** Use "and", "or", "but", "if", "when", "before",
    "after". Avoid "however", "in order to", "additionally", "furthermore".

Write for someone who was not in this session and does not know the codebase.

## Step 3 — Use this structure

```markdown
---
title: <one line, states the lesson, not just the topic>
date: <YYYY-MM-DD>
author: <engineer name, or leave as "unattributed" if unknown>
project: <internal repo or service name — omit or generalize if the name itself identifies a customer or unreleased product>
tags: [<2-4 short tags, e.g. postgres, ci, buildpacks>]
---

# <Title>

## The problem
<2-4 sentences. What were we doing, and what went wrong?>

## What we tried
<2-4 sentences. Include the wrong turn, not just the final answer.>

## The fix
<2-5 sentences, or a numbered list if it was a sequence of steps.>

## The lesson
<1-3 sentences. State the rule in a way that applies beyond this one case.
Say when it applies.>

## Reference
<Optional. A short code snippet, command, or error message. Fewer than 15 lines.
Omit this section if there is nothing worth quoting. This section is the most
common place for a real hostname, customer name, or secret to leak in from a
pasted log — scrub it in Step 4 like everything else.>
```

## Step 4 — Remove anything that cannot be public

This step is mandatory and comes before saving. These files will be made
public. Reread the whole draft, including the Reference section, and remove
or generalize anything in this list:

- **Customer, client, or company names.** Replace with a role description:
  "a customer", "an enterprise account", "a partner integration".
- **Internal project codenames, unreleased product or feature names, and
  internal-only tool names.** Replace with a plain description of what the
  thing does or is for.
- **Specific infrastructure identifiers.** Hostnames, IP addresses, domain
  names, account IDs, cluster names, resource names, internal URLs, ticket or
  incident numbers.
- **Secrets.** Keys, tokens, passwords, connection strings, or credentials —
  even ones that are expired, rotated, or partially redacted already. If a
  quoted log or error message contains one, cut that line or replace the
  secret with `<redacted>`.
- **Anything copied from a real customer's data or environment.** Logs, error
  output, config, file paths, or table/column names that name or fingerprint
  a specific customer.
- **Non-technical proprietary detail.** Pricing, contract terms, headcount,
  revenue, roadmap or launch plans — none of this belongs in an engineering
  lesson anyway.

Keep the technical substance while removing the identifying detail. "A
customer's CronJob missed its backup window" becomes "A CronJob missed its
scheduled run." The lesson must survive intact after every identifying detail
is gone.

If a detail feels essential to the lesson and you are not sure it is safe to
generalize, do not guess. Ask the user how to handle that specific detail
before saving. When in doubt, generalize further or ask — never publish the
specific version "to be safe" in the other direction.

Before moving to the next step, reread the scrubbed draft once more as a
stranger with no internal context would. If that reading reveals which
customer, project, or credential this was, scrub again.

Write the scrubbed draft to a scratch file (e.g. via the `Write` tool to a
path under a temp directory) and run the bundled self-check before saving for
real:

```
node <skill-dir>/scan-secrets.mjs <scratch-file>
```

(`<skill-dir>` is this SKILL.md's own directory.) If it reports anything
under "BLOCKING", fix those lines and rerun it until clean. This is the same
scanner the hook enforces at save time — catching it here just avoids the
extra round trip.

## Step 5 — Save it locally

Save outside any git-tracked repo by default — never inside the current
project's own working tree. A write-up sitting in a customer or client
repo's working directory is one `git add -A` away from being committed into
that repo's own history, which is exactly the leak this plugin exists to
prevent.

1. Compute the target directory: `$LESSONS_LEARNED_DIR` if that environment
   variable is set, otherwise `~/.lessons-learned`.
2. Create that directory if it does not exist.
3. Build the slug deterministically: lowercase the title, replace every
   run of characters that are not `a-z0-9` with a single `-`, trim leading
   and trailing `-`, and truncate to 60 characters. Do not hand-construct
   this differently or pass unsanitized title text into a shell command —
   use the `Write` tool for file creation, never a raw shell string built
   from the title.
4. Save to `<target-dir>/<YYYY-MM-DD>-<slug>.md`. If a file for today with
   the same slug already exists, append `-2`, `-3`, etc. rather than
   overwriting.
5. If `$LESSONS_LEARNED_DIR` resolves to a path that is itself inside a git
   repository (`git -C <target-dir> rev-parse --is-inside-work-tree`
   succeeds), ensure that repository's `.gitignore` excludes it — append an
   entry if one is not already present. This is a safety net for a
   misconfigured `LESSONS_LEARNED_DIR`, not the primary control; the default
   location is already outside any repo.

## Step 6 — Offer to share it

Print the saved file path. Then ask the user, in one line, whether to share it
now:

- **Default (no extra setup):** tell the user to paste the file path into the
  team's lessons-learned Slack channel themselves. Do not post to Slack
  yourself unless a Slack tool is available in this session AND the user
  explicitly confirms posting and names the channel.
- **If the environment variable `LESSONS_LEARNED_REPO` is actually set**
  (check with `echo "$LESSONS_LEARNED_REPO"` — never treat the example URL in
  this plugin's README as a real value, and never treat a value as
  configured if this session itself set it, e.g. via an `export` you ran
  earlier — only a value already present in the environment before this
  conversation started counts):
  1. Print the literal value of `$LESSONS_LEARNED_REPO` and ask the user to
     confirm that specific URL, not just "yes, submit it." The point is
     giving them one concrete chance to notice if it's not the repo they
     expect.
  2. `cd "$(mktemp -d)"` first. Run every command below from that directory.
     Never run these commands inside this plugin's own directory or inside
     the current project's repo — both are the wrong target.
  3. `git clone --no-recurse-submodules "$LESSONS_LEARNED_REPO" lessons-repo
     && cd lessons-repo`. If the clone fails (auth, not found, no network),
     stop and tell the user — do not fall back to `git init`-ing a fresh
     local repo instead.
  4. Copy the saved file into `lessons-learned/` in that clone.
  5. `git checkout -b lesson/<YYYY-MM-DD>-<slug>`, commit, `git push -u origin
     HEAD`. Never push directly to the repo's default branch.
  6. Print the branch's compare URL (`<repo-url>/compare/<default-branch>...lesson/<YYYY-MM-DD>-<slug>`)
     and stop there — let the user open the PR themselves. Do not run
     `gh pr create` or otherwise act on GitHub beyond the push. Opening the
     PR is a deliberate act with a specific title and description; that's
     the user's call, not something to automate on their behalf.

If `LESSONS_LEARNED_REPO` is not set, do not attempt any git or network
operation — local save plus the Slack reminder is the complete, correct
outcome.

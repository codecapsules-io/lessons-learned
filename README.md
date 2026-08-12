# lessons-learned

A Claude Code skill that turns a useful engineering session into a short,
plain-language writeup in ASD-STE100 Simplified Technical English, saved as a
local `.md` file.

## Install

This repo is self-describing as its own one-plugin marketplace
(`.claude-plugin/marketplace.json`, `source: "./"`), so it installs directly
today, independent of community review:

```
/plugin marketplace add codecapsules-io/lessons-learned
/plugin install lessons-learned@codecapsules
```

It's also submitted to the [Claude Code community marketplace](https://github.com/anthropics/claude-plugins-community)
(see `PUBLISHING.md`) for public discovery. Once approved, it's also
installable from there:

```
/plugin marketplace add anthropics/claude-plugins-community
/plugin install lessons-learned@claude-community
```

Both point at the same plugin code — use whichever is more convenient. For
a one-off try without installing anything, use `--plugin-dir` pointing at a
local clone, or `--plugin-url` pointing at a release archive.

## Use

At the end of a session that taught you something worth keeping, run:

```
/lessons-learned
```

The skill checks whether the session actually produced a lesson (it will say
so and stop if not), writes it up, and saves it to
`~/.lessons-learned/<date>-<slug>.md` — outside any git-tracked repo by
default, so a write-up never ends up sitting in a customer or client repo's
working tree. Set `LESSONS_LEARNED_DIR` to change where it saves. It then
tells you where to share it — by default, that's pasting the path into the
team Slack channel.

## Optional: submit as a PR instead of Slack

Set `LESSONS_LEARNED_REPO` to the git URL of your shared lessons-learned repo
(e.g. in your shell profile or `.env`) — this is a placeholder, not a real
value, until such a repo exists:

```
export LESSONS_LEARNED_REPO=git@github.com:<your-org>/<your-lessons-repo>.git
```

With this set, the skill can open a PR against that repo directly instead of
asking you to paste the path in Slack. It always clones into a fresh temp
directory, asks for confirmation first, and never pushes to the default
branch.

**Every writeup is scrubbed of customer names, internal codenames,
infrastructure identifiers, and secrets before it is ever saved — see Step 4
in the skill — because these are meant to become public.**

## How leaks are actually prevented

The scrub in Step 4 is the model reviewing its own draft — useful, but not a
security boundary, since a user can simply ask it to skip that step. This
plugin also ships a deterministic scanner (`lib/secret-scan.mjs`, plain
regex and entropy checks, no external dependency) that runs two ways:

- As a **hook** (`hooks/hooks.json` + `hooks/scan-write.mjs`): Claude Code
  itself denies any `Write`/`Edit`/`Bash` call that would put a matched
  secret, credential, private key, or an oversized code block into a
  `lessons-learned/*.md` file. This is enforced by the harness, not by the
  model's judgment, so it holds even if the model is asked to bypass it.
- As a **CLI self-check** (`skills/lessons-learned/scan-secrets.mjs`) the
  skill runs on its own draft before saving, and that anyone can run by hand
  or from CI against an already-saved file:
  ```
  node skills/lessons-learned/scan-secrets.mjs path/to/lesson.md
  ```
  Exit code `0` means clean (or warnings only); `1` means it found something
  that should block the write.

High-confidence patterns (known key/token formats, private key blocks,
credentials embedded in a URL, an explicit `password=`/`token=` assignment)
are hard blocks. Lower-confidence signals (a bare IP address, a long
high-entropy string with no keyword context) are surfaced as warnings rather
than blocked outright, because a hard gate there has a high enough
false-positive rate (git SHAs, resource IDs, hashes) that it would just teach
people to route around the tool. None of this replaces a human actually
reading the PR before merge — see `SECURITY.md` for the full threat model.

## Why ASD-STE100

Many different engineers writing in different voices produces a pile of
writeups no one wants to read. A controlled, plain-language format keeps
everything skimmable in under two minutes, regardless of who wrote it. It is
a draft format for the reviewer's editorial pass, not the final published
voice of the blog.

# lessons-learned

A Claude Code skill that turns a useful engineering session into a short,
plain-language writeup in ASD-STE100 Simplified Technical English, saved as a
local `.md` file.

## Use

At the end of a session that taught you something worth keeping, run:

```
/lessons-learned
```

The skill checks whether the session actually produced a lesson (it will say
so and stop if not), writes it up, and saves it to
`lessons-learned/<date>-<slug>.md` in the current repo. It then tells you where
to share it — by default, that's pasting the path into the team Slack channel.

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

## Why ASD-STE100

Many different engineers writing in different voices produces a pile of
writeups no one wants to read. A controlled, plain-language format keeps
everything skimmable in under two minutes, regardless of who wrote it. It is
a draft format for the reviewer's editorial pass, not the final published
voice of the blog.

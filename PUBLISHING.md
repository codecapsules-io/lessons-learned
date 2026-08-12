# Publishing to the Claude Code marketplace

There are two different things both called "the marketplace":

1. **`claude-plugins-official`** — Anthropic's own curated list, auto-registered
   for every Claude Code user. Inclusion is Anthropic's discretionary pick;
   there is no public submission process, and the submission form below does
   not feed this one.
2. **`claude-plugins-community`** — the public, review-gated marketplace
   anyone can apply to. Users add it once with
   `/plugin marketplace add anthropics/claude-plugins-community`, then
   install approved plugins from it as `<name>@claude-community`.

So "publish to the Claude marketplace" in practice means: submit to the
community marketplace.

## Status

- [x] `plugin.json` has `version`, `repository`, `license`, `keywords`
      (`.claude-plugin/plugin.json`).
- [x] `claude plugin validate ./plugins/lessons-learned` passes locally.
- [x] The repo is public: `git@github.com:codecapsules-io/lessons-learned.git`.
      Submission works off this repo directly, not the `codecapsules-plugins`
      marketplace wrapper.
- [x] Sidestepped the nested-repo issue entirely: rather than a separate
      `claude-plugins` wrapper repo pointing here, `marketplace.json` now
      lives directly in this repo (`.claude-plugin/marketplace.json`,
      `source: "./"`), so this repo is its own marketplace —
      `/plugin marketplace add codecapsules-io/lessons-learned` works with no
      wrapper needed. The `claude-plugins` repo's own entry for this plugin
      (a GitHub-source pointer at this repo) still works too, but is now
      redundant for this specific plugin — worth removing there once you've
      decided whether `claude-plugins` is still useful for other, future
      plugins.
- [ ] **Submit** — needs a human with an account (see below).
- [ ] **Review** — a few days per Anthropic's docs, automated safety screening
      + the same `validate` check.
- [ ] **Confirm it landed** — check
      [`anthropics/claude-plugins-community`'s `marketplace.json`](https://github.com/anthropics/claude-plugins-community/blob/main/.claude-plugin/marketplace.json)
      after approval (nightly sync).

## To submit

Submit via one of:

- [platform.claude.com/plugins/submit](https://platform.claude.com/plugins/submit)
  — for individual authors, no Team/Enterprise org needed.
- `claude.ai/admin-settings/directory/submissions/plugins/new` — if
  codecapsules.io has a Team/Enterprise org and you have directory-management
  access.

This is tied to a personal or org account, so it needs to be done by a human,
not run from here.

## What a reviewer will likely scrutinize

Step 6 of `SKILL.md` does an opt-in `git clone` / `push` / `gh pr create`
against a user-configured repo (`LESSONS_LEARNED_REPO`). It's gated behind an
explicit env var plus user confirmation, always clones into a fresh temp
directory, and never pushes to a default branch — see `SECURITY.md` for the
full reasoning. Worth rereading that step once more before submitting, since
"an agent pushes to git on its own" is exactly the kind of thing safety
screening looks at closely.

## One thing to decide before submitting

`plugin.json` currently pins `"license": "MIT"` — set as a reasonable
permissive default, not a legal decision made on the company's behalf.
Confirm this is actually the license Code Capsules wants on a public repo
before submitting, and change it first if not.

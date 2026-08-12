#!/bin/sh
# Narrow scope gate + fail-closed-on-missing-node wrapper around
# scan-write.mjs. Kept as its own script (not inlined in hooks.json)
# because getting the "only require node for in-scope calls" logic right in
# a one-line shell case statement is genuinely error-prone — see the .mjs
# file's tests for why an unset LESSONS_LEARNED_DIR needs to be handled as
# "no extra match", not "match everything".
set -eu

input="$(cat)"

in_scope=0
case "$input" in
  *lessons-learned*) in_scope=1 ;;
esac

if [ "$in_scope" = "0" ] && [ -n "${LESSONS_LEARNED_DIR:-}" ]; then
  case "$input" in
    *"$LESSONS_LEARNED_DIR"*) in_scope=1 ;;
  esac
fi

if [ "$in_scope" = "0" ]; then
  printf '{}'
  exit 0
fi

if command -v node >/dev/null 2>&1; then
  printf '%s' "$input" | node "${CLAUDE_PLUGIN_ROOT}/hooks/scan-write.mjs"
else
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny"},"systemMessage":"lessons-learned: Node.js was not found on PATH, so the secret scanner cannot run. Install Node.js to use this plugin. This write was blocked as a precaution rather than allowed through unscanned."}'
fi

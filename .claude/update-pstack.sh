#!/bin/sh
# Copies the pstack Claude Code port into .claude/skills and .claude/agents at
# one pinned commit. Cloud sessions don't load plugins, so the skills live in
# the repo instead. Usage: sh .claude/update-pstack.sh [commit]
set -eu

repo=https://github.com/michael-denyer/pstack-claude
commit=${1:-94f5ce95abe8a9dec976967d79941f631cf477cd}
# Our CLAUDE.md and the session's GitHub tools already drive PRs, CI and
# conflicts; setup-pstack writes a model sheet the container doesn't keep.
skip='babysit fix-ci fix-merge-conflicts get-pr-comments setup-pstack'

root=$(git rev-parse --show-toplevel)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

git -C "$tmp" init -q
git -C "$tmp" fetch -q --depth 1 "$repo" "$commit"
git -C "$tmp" checkout -q FETCH_HEAD
src="$tmp/plugins/pstack"

# The manifest lists what the last run copied, so a skill or agent that
# upstream drops is removed too.
manifest="$root/.claude/pstack-files.txt"
if [ -f "$manifest" ]; then
  while IFS= read -r path; do rm -rf "${root:?}/$path"; done < "$manifest"
fi
: > "$manifest"

mkdir -p "$root/.claude/skills" "$root/.claude/agents"
for dir in "$src"/skills/*/; do
  name=$(basename "$dir")
  case " $skip " in *" $name "*) continue ;; esac
  cp -R "$dir" "$root/.claude/skills/$name"
  echo ".claude/skills/$name" >> "$manifest"
done
for file in "$src"/agents/*.md "$src"/effort-agents/*.md; do
  cp "$file" "$root/.claude/agents/"
  echo ".claude/agents/$(basename "$file")" >> "$manifest"
done
echo "pstack-claude $(git -C "$tmp" rev-parse HEAD)"

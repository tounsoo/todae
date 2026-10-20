#!/bin/sh
# Copies the pstack Claude Code port into .claude/skills and .claude/agents,
# and its session-start routing text into .claude, at one pinned commit. Cloud sessions don't load plugins, so the skills live in
# the repo instead. Usage: sh .claude/update-pstack.sh [commit]
set -eu

repo=https://github.com/michael-denyer/pstack-claude
commit=${1:-49b68501b075ec1eb2755dd0d22fbf2492d67e97}
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
  while IFS= read -r path; do
    # Only remove entries this script writes, so a hand-edited line can't
    # reach outside .claude.
    case "$path" in
      *..* | */ | .claude/skills/ | .claude/agents/) continue ;;
      .claude/skills/*/* | .claude/agents/*/*) continue ;;
      .claude/skills/* | .claude/agents/*.md) rm -rf "${root:?}/$path" ;;
    esac
  done < "$manifest"
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
# Fable runs only where pstack-models.md names it or the user approves it in
# the run, so no skill default may name it, even when a sheet line is missing.
for file in "$root"/.claude/skills/*/SKILL.md; do
  sed -i.bak 's/`fable\([^`]*\)`/`opus\1`/g' "$file" && rm "$file.bak"
done
# Any other mention could be a default the rewrite missed, so list it to check.
grep -rnio '.\{0,30\}fable.\{0,30\}' "$root/.claude/skills" "$root/.claude/agents" |
  sed "s|^$root/|check for a Fable default: |" || true
# The plugin's SessionStart hook prints this; .claude/settings.json does the same.
cp "$src/hooks/session-start-context.md" "$root/.claude/pstack-session-start.md"
echo "pstack-claude $(git -C "$tmp" rev-parse HEAD)"

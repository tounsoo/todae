#!/bin/sh
# Replaces the pinned pstack copy in .agents/pstack/plugin with upstream's plugins/pstack folder at one commit,
# word for word, and records that commit in .agents/pstack/pin.json. The weekly update workflow
# (.github/workflows/pstack-update.yml) runs it. Don't run it in an agent session: it downloads code, which
# sessions don't do. Run it from the root of the todae checkout:
#   sh .agents/pstack/update.sh [commit]
# With no commit it takes upstream's newest one. It runs nothing from the download. It copies the whole
# folder, so a file or folder upstream adds or drops is added or dropped here too.
set -eu

# PSTACK_REPO points the tests at a local repository.
repo=${PSTACK_REPO:-https://github.com/michael-denyer/pstack-claude}
[ -d .agents/playbooks ] && [ -f .agents/pstack/pin.json ] || { echo "Run this from the root of the todae checkout." >&2; exit 1; }

commit=${1:-$(git ls-remote "$repo" HEAD | cut -f1)}
printf '%s\n' "$commit" | grep -Eq '^[0-9a-f]{40}$' || { echo "pstack: '$commit' is not a full commit SHA." >&2; exit 1; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git -C "$tmp" init -q
git -C "$tmp" fetch -q --depth 1 "$repo" "$commit"
git -C "$tmp" -c advice.detachedHead=false checkout -q FETCH_HEAD
src="$tmp/plugins/pstack"

[ -f "$src/skills/poteto-mode/SKILL.md" ] || { echo "pstack: $commit has no plugins/pstack/skills/poteto-mode/SKILL.md." >&2; exit 1; }
# A link could point outside the copy, and any other special file has no place in it.
odd=$(find "$src" ! -type f ! -type d | head -n 5)
[ -z "$odd" ] || { printf 'pstack: %s has links or special files, so nothing was copied:\n%s\n' "$commit" "$odd" >&2; exit 1; }
# The MIT notices travel with the copy. Without them it may not be redistributed.
find "$src" -type f -name 'LICENSE*' | grep -q . || { echo "pstack: $commit ships no LICENSE file in plugins/pstack, so nothing was copied." >&2; exit 1; }

rm -rf .agents/pstack/plugin
mkdir -p .agents/pstack/plugin
cp -R "$src/." .agents/pstack/plugin/
cat > .agents/pstack/pin.json <<EOF
{
  "repository": "michael-denyer/pstack-claude",
  "path": "plugins/pstack",
  "commit": "$commit"
}
EOF
echo "pstack $commit"

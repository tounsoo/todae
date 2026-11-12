#!/bin/sh
# Replaces the pinned pstack copy in .agents/pstack/plugin with upstream's plugins/pstack folder at one commit,
# word for word, and records that commit and the folder's Git tree id in .agents/pstack/pin.json. The weekly
# update workflow (.github/workflows/pstack-update.yml) runs it. Don't run it in an agent session: it downloads
# code, which sessions don't do. Run it from the root of the todae checkout:
#   sh .agents/pstack/update.sh [commit]
# With no commit it takes upstream's newest one. It runs nothing from the download. It replaces the whole
# folder in the index and the working tree, so a file or folder upstream adds or drops is added or dropped
# here too, and only pin.json is left to stage.
set -eu

# PSTACK_REPO points the tests at a local repository.
repo=${PSTACK_REPO:-https://github.com/michael-denyer/pstack-claude}
[ -d .agents/playbooks ] && [ -f .agents/pstack/pin.json ] || { echo "Run this from the root of the todae checkout." >&2; exit 1; }

commit=${1:-$(git ls-remote "$repo" HEAD | cut -f1)}
printf '%s\n' "$commit" | grep -Eq '^[0-9a-f]{40}$' || { echo "pstack: '$commit' is not a full commit SHA." >&2; exit 1; }

# The commit's objects come into this repository, and the copy is built from upstream's own tree, so the
# committed copy is upstream's folder exactly, whatever todae's .gitignore or .gitattributes say.
git fetch -q --depth 1 "$repo" "$commit"
tree=$(git rev-parse -q --verify "FETCH_HEAD:plugins/pstack") || { echo "pstack: $commit has no plugins/pstack folder." >&2; exit 1; }
listing=$(git ls-tree -r "$tree")
tab=$(printf '\t')

printf '%s\n' "$listing" | grep -q "${tab}skills/poteto-mode/SKILL.md\$" || { echo "pstack: $commit has no plugins/pstack/skills/poteto-mode/SKILL.md." >&2; exit 1; }
# A link could point outside the copy, and a submodule has no place in it.
odd=$(printf '%s\n' "$listing" | grep -E '^(120000|160000) ' | cut -f2 | head -n 5)
[ -z "$odd" ] || { printf 'pstack: %s has links or submodules, so nothing was copied:\n%s\n' "$commit" "$odd" >&2; exit 1; }
# The MIT notices travel with the copy. Without them it may not be redistributed.
printf '%s\n' "$listing" | cut -f2 | grep -Eq '(^|/)LICENSE[^/]*$' || { echo "pstack: $commit ships no LICENSE file in plugins/pstack, so nothing was copied." >&2; exit 1; }

git rm -r -q --cached --ignore-unmatch -- .agents/pstack/plugin
rm -rf .agents/pstack/plugin
git read-tree --prefix=.agents/pstack/plugin/ "$tree"
git checkout -q -- .agents/pstack/plugin
cat > .agents/pstack/pin.json <<EOF
{
  "repository": "michael-denyer/pstack-claude",
  "path": "plugins/pstack",
  "commit": "$commit",
  "tree": "$tree"
}
EOF
echo "pstack $commit"

#!/usr/bin/env bash
# CI's half of the pinned pstack check: when a change edits .agents/pstack/pin.json, the tree id it records
# must be the tree upstream has at the commit it names. .agents/pstack/check.sh already checks the committed
# copy against that id, so together they hold the copy to upstream's folder. This one downloads, so only CI's
# Forbidden paths job runs it, never an agent session. Run from the root of the checkout:
#   bash .github/scripts/pstack-upstream.sh <base commit>
# It downloads trees only, no file contents. PSTACK_REPO points the tests at a local repository.
set -euo pipefail

base=${1:?usage: pstack-upstream.sh <base commit>}
repo=${PSTACK_REPO:-https://github.com/michael-denyer/pstack-claude}
pin() { sed -n "s/^[[:space:]]*\"$1\":[[:space:]]*\"\([0-9a-f]\{40\}\)\".*/\1/p" | head -n 1; }

was=$(git show "$base:.agents/pstack/pin.json" 2>/dev/null) || {
	echo "pstack-upstream: $base has no .agents/pstack/pin.json, so there is no pin to compare with."
	exit 0
}
if [ "$was" = "$(cat .agents/pstack/pin.json)" ]; then
	echo "pstack-upstream: .agents/pstack/pin.json is unchanged."
	exit 0
fi

commit=$(pin commit <.agents/pstack/pin.json)
tree=$(pin tree <.agents/pstack/pin.json)
[ -n "$commit" ] && [ -n "$tree" ] || { echo "pstack-upstream: .agents/pstack/pin.json needs a commit and a tree id." >&2; exit 1; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git -C "$tmp" init -q
git -C "$tmp" fetch -q --depth 1 --filter=blob:none "$repo" "$commit"
want=$(git -C "$tmp" rev-parse -q --verify "FETCH_HEAD:plugins/pstack") || { echo "pstack-upstream: $commit has no plugins/pstack folder." >&2; exit 1; }
if [ "$want" != "$tree" ]; then
	echo "pstack-upstream: pin.json says the copy is $tree, but upstream's plugins/pstack at $commit is $want. Only the pstack update workflow should change the copy and its pin." >&2
	exit 1
fi
echo "pstack-upstream: the pin matches upstream's plugins/pstack at $commit."

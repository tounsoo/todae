#!/usr/bin/env bash
set -euo pipefail

bash .github/scripts/change-class.sh --self-test

if [ "$EVENT_NAME" = "pull_request" ]; then
	base="$PR_BASE"
	head="$PR_HEAD"
	diff_args=("$base...$head")
else
	base="$PUSH_BEFORE"
	head="$PUSH_SHA"
	diff_args=("$base" "$head")
fi

if [ -z "$base" ] || [ "$base" = "0000000000000000000000000000000000000000" ] || ! git cat-file -e "$base^{commit}" 2>/dev/null || ! git cat-file -e "$head^{commit}" 2>/dev/null; then
	echo "class=all" >> "$GITHUB_OUTPUT"
	echo "class=all (commits not in the checkout)"
	exit 0
fi

# --no-renames lists both paths of a rename, so the classifier sees the old file and the new one.
if ! files=$(git -c core.quotePath=false diff --name-only --no-renames "${diff_args[@]}"); then
	echo "class=all" >> "$GITHUB_OUTPUT"
	echo "class=all (diff failed)"
	exit 0
fi

class=$(printf '%s\n' "$files" | bash .github/scripts/change-class.sh)
echo "class=$class" >> "$GITHUB_OUTPUT"
echo "class=$class"
if [ "$class" = prose ]; then
	printf '%s\n' "$files"
fi

#!/usr/bin/env bash
# The steps of .github/workflows/pstack-update.yml, kept here so .github/scripts/pstack-update.test.mjs can run
# them against local repositories.
#
#   pstack-update.sh prepare  brings the pinned copy up to upstream's newest commit on the branch of the open
#                             update pull request, or on a new branch from the base, commits it and writes the
#                             pull request body. It writes changed, open, branch and title to $GITHUB_OUTPUT.
#   pstack-update.sh publish  pushes that branch and opens or updates the pull request.
#
# Run from the root of a checkout of the base branch. Environment: REPO (owner/name), BASE (the base branch),
# TOOLS (a folder holding copies of update.sh and check.sh from the base, so nothing the branch holds runs),
# BODY (where the pull request body goes), GITHUB_OUTPUT, and for publish GH_TOKEN, OPEN, BRANCH and TITLE.
# PUSH_URL and PSTACK_REPO point the tests at local repositories. A branch is never rewritten or deleted.
set -euo pipefail

prefix=pstack-update/
upstream=https://github.com/michael-denyer/pstack-claude

pin() { sed -n 's/^[[:space:]]*"commit":[[:space:]]*"\([0-9a-f]\{40\}\)".*/\1/p' | head -n 1; }
out() { printf '%s=%s\n' "$1" "$2" >>"$GITHUB_OUTPUT"; }

prepare() {
	git config user.name 'github-actions[bot]'
	git config user.email '41898283+github-actions[bot]@users.noreply.github.com'
	git fetch -q origin "refs/heads/$BASE:refs/remotes/origin/$BASE"

	# Only pull requests from this repository's own pstack-update/ branches count. A fork's branch can take
	# the same name.
	local ours open="" branch
	ours=$(gh pr list --repo "$REPO" --base "$BASE" --state all --limit 100 \
		--json number,state,title,headRefName,isCrossRepository |
		jq -c --arg prefix "$prefix" '[.[] | select((.isCrossRepository | not) and (.headRefName | startswith($prefix)))]')
	open=$(jq -r '[.[] | select(.state == "OPEN")] | sort_by(.number) | .[0] // empty | .number' <<<"$ours")

	# What the base holds, so the body compares upstream from there even on a branch that moved on since.
	local before after
	before=$(git show "origin/$BASE:.agents/pstack/pin.json" | pin)

	if [ -n "$open" ]; then
		branch=$(jq -r --argjson n "$open" '.[] | select(.number == $n) | .headRefName' <<<"$ours")
		git fetch -q origin "refs/heads/$branch:refs/remotes/origin/$branch"
		git switch -q -c "$branch" "origin/$branch"
		# Keep the open pull request and its history: bring the base in rather than rebuild the branch.
		git merge -q --no-edit "origin/$BASE" || {
			echo "::error::$branch conflicts with $BASE. Merge $BASE into it on pull request #$open and resolve the conflict, and the next run updates it again."
			exit 1
		}
	else
		git switch -q --detach "origin/$BASE"
	fi

	sh "$TOOLS/update.sh"
	after=$(pin <.agents/pstack/pin.json)
	out open "$open"
	if [ -z "$(git status --porcelain --ignored -- .agents/pstack)" ]; then
		echo "The copy is already at pstack-claude ${after:0:7}, so there is nothing to update."
		out changed false
		return
	fi

	if [ -z "$open" ]; then
		branch="$prefix${after:0:7}"
		local closed
		closed=$(jq -r --arg short "${after:0:7}" '[.[] | select(.state == "CLOSED" and (.title | contains($short)))] | .[0] // empty | .number' <<<"$ours")
		if [ -n "$closed" ]; then
			echo "Pull request #$closed for pstack-claude ${after:0:7} was closed without merging, so this run opens no new one. Reopen it to take this commit, and the next run updates it."
			out changed false
			return
		fi
		if git ls-remote --exit-code origin "refs/heads/$branch" >/dev/null; then
			echo "::warning::The branch $branch already exists with no open pull request. Open a pull request from it, or delete it so the next run starts it again."
			out changed false
			return
		fi
		git switch -q -c "$branch"
	fi

	# -f, because the copy is upstream's word for word, even where todae's .gitignore would leave a file out.
	git add -A -f -- .agents/pstack
	git commit -q -m "chore(pstack): update the pinned copy to ${after:0:7}" -m "Upstream: $upstream/commit/$after"
	out changed true
	out branch "$branch"
	out title "chore(pstack): update the pinned copy to ${after:0:7}"

	# The check's verdict goes in the body here, and CI's Forbidden paths job runs the same check and fails on it.
	local check status=0 tested base verdict result compare short_before stat others added removed fable
	check=$(sh "$TOOLS/check.sh" 2>&1) || status=$?
	tested=$(git rev-parse HEAD)
	base=$(git merge-base HEAD "origin/$BASE")
	if [ "$status" = 0 ]; then verdict=PASS; result=passed; else verdict=FAIL; result=failed; fi
	short_before=${before:-none}
	short_before=${short_before:0:7}
	if [ -n "$before" ] && [ "$before" != "$after" ]; then
		compare="$upstream/compare/$before...$after"
	else
		compare="$upstream/commit/$after"
	fi
	stat=$(git diff --shortstat "$base" HEAD -- .agents/pstack)
	others=$(git diff --name-only "$base" HEAD | grep -v '^\.agents/pstack/' || true)
	added=$(git diff --name-only --no-renames --diff-filter=A "$base" HEAD -- .agents/pstack/plugin | sed 's|^\.agents/pstack/plugin/||')
	removed=$(git diff --name-only --no-renames --diff-filter=D "$base" HEAD -- .agents/pstack/plugin | sed 's|^\.agents/pstack/plugin/||')
	fable=$(git diff -i -G 'fable' --name-only "$base" HEAD -- .agents/pstack/plugin | sed 's|^\.agents/pstack/plugin/||')

	list() {
		local name="$1" files="$2" count
		[ -n "$files" ] || return 0
		count=$(printf '%s\n' "$files" | wc -l | tr -d ' ')
		echo
		echo "$name ($count):"
		echo
		printf '%s\n' "$files" | head -n 20 | sed 's/^/- `/; s/$/`/'
		[ "$count" -le 20 ] || echo "- and $((count - 20)) more"
	}

	{
		echo "## Why"
		echo
		echo "Agent threads read pstack from the pinned copy in \`.agents/pstack\` and download nothing. This weekly run brings that copy up to pstack-claude's newest commit, so Ben reviews each update before threads use it."
		echo
		echo "## What changed"
		echo
		echo "- \`.agents/pstack/plugin\` is upstream's \`plugins/pstack\` at [\`${after:0:7}\`]($upstream/commit/$after), word for word. \`$BASE\` has \`$short_before\`. Upstream changes: $compare"
		echo "- \`.agents/pstack/pin.json\` records the new commit and its folder's tree id.${stat:+ Diff:$stat.}"
		list "Files upstream added" "$added"
		list "Files upstream removed" "$removed"
		list "Changed files that name Fable, which .claude/models.md must still cover" "$fable"
		echo
		echo "## Scope"
		echo
		if [ -z "$others" ]; then
			echo "Only the pinned copy and its pin. If the anchor check below failed, a todae playbook needs a matching change before this merges."
		else
			echo "The pinned copy and its pin, and these files outside it:"
			echo
			printf '%s\n' "$others" | sed 's/^/- `/; s/$/`/'
		fi
		echo
		echo "## Verification"
		echo
		echo "Tested commit: \`$tested\`"
		echo "Base: \`$base\`"
		echo "Verdict: $verdict"
		echo
		echo "- \`sh .agents/pstack/check.sh\`: $result"
		echo
		echo '```text'
		printf '%s\n' "$check"
		echo '```'
		echo
		echo "## Unverified checks"
		echo
		echo "- The new skills, agents and playbooks aren't read here. Review the upstream changes above before merging."
		echo
		echo "## Remaining risks"
		echo
		echo "- Every thread started after the merge follows the new pstack. A wording change in a playbook that a todae playbook doesn't anchor on can still change how threads work."
	} >"$BODY"
	printf '%s\n' "$check" >>"${GITHUB_STEP_SUMMARY:-/dev/null}"
}

publish() {
	local url=${PUSH_URL:-"https://x-access-token:$GH_TOKEN@github.com/$REPO.git"}
	# A plain push: it fails rather than overwrite anything someone else pushed to the branch.
	git push -q --no-verify "$url" "HEAD:refs/heads/$BRANCH"
	if [ -n "$OPEN" ]; then
		gh pr edit "$OPEN" --repo "$REPO" --title "$TITLE" --body-file "$BODY"
		echo "Updated pull request #$OPEN." >>"${GITHUB_STEP_SUMMARY:-/dev/null}"
	else
		gh pr create --repo "$REPO" --base "$BASE" --head "$BRANCH" --title "$TITLE" --body-file "$BODY" >>"${GITHUB_STEP_SUMMARY:-/dev/null}"
	fi
}

case "${1:-}" in
	prepare) prepare ;;
	publish) publish ;;
	*) echo "usage: pstack-update.sh prepare|publish" >&2; exit 2 ;;
esac

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

pin() { sed -n "s/^[[:space:]]*\"$1\":[[:space:]]*\"\([0-9a-f]\{40\}\)\".*/\1/p" | head -n 1; }
out() { printf '%s=%s\n' "$1" "$2" >>"$GITHUB_OUTPUT"; }

prepare() {
	git config user.name 'github-actions[bot]'
	git config user.email '41898283+github-actions[bot]@users.noreply.github.com'
	git fetch -q origin "refs/heads/$BASE:refs/remotes/origin/$BASE"

	local before after short tree branch open="" closed
	before=$(git show "origin/$BASE:.agents/pstack/pin.json" | pin commit)
	after=$(git ls-remote "${PSTACK_REPO:-$upstream}" HEAD | cut -f1)
	[[ "$after" =~ ^[0-9a-f]{40}$ ]] || { echo "::error::Couldn't read pstack-claude's newest commit."; exit 1; }
	short=${after:0:7}
	# The folder's tree id names its content, whatever commit carries it. update.sh builds the copy from it.
	git fetch -q --depth 1 "${PSTACK_REPO:-$upstream}" "$after"
	tree=$(git rev-parse -q --verify "FETCH_HEAD:plugins/pstack") || { echo "::error::pstack-claude $short has no plugins/pstack folder."; exit 1; }

	# Only pull requests from this repository's own pstack-update/ branches count: a fork's branch can take the
	# same name. Open pull requests are few, so one page holds them all.
	local all
	all=$(gh pr list --repo "$REPO" --base "$BASE" --state open --limit 200 --json number,headRefName,isCrossRepository |
		jq -r --arg prefix "$prefix" '[.[] | select((.isCrossRepository | not) and (.headRefName | startswith($prefix)))] | sort_by(.number) | .[] | "\(.number) \(.headRefName)"')
	open=$(head -n 1 <<<"$all")
	if [ "$(grep -c . <<<"$all")" -gt 1 ]; then
		echo "::warning::More than one pstack update pull request is open. This run updates #${open%% *} only; close the others."
	fi
	out open "${open%% *}"

	if [ -n "$open" ]; then
		branch=${open#* }
		open=${open%% *}
		# Upstream went back to main's copy, so the open pull request would only move the pin.
		if [ "$(git rev-parse "origin/$BASE:.agents/pstack/plugin" 2>/dev/null)" = "$tree" ]; then
			echo "::notice::pstack-claude's plugins/pstack at $short is the copy $BASE already has, so pull request #$open has nothing left to update. Close it."
			out changed false
			return
		fi
	else
		if [ "$(git rev-parse "origin/$BASE:.agents/pstack/plugin" 2>/dev/null)" = "$tree" ]; then
			echo "pstack-claude's plugins/pstack at $short is the copy $BASE already has, so there is nothing to update."
			out changed false
			return
		fi
		# A pull request Ben closed without merging turns this copy down, whichever upstream commit carried it, so
		# a later commit that leaves plugins/pstack as it was opens nothing either. Each body records its tree id.
		# Search only narrows the list to unmerged pull requests, which are few; jq matches the tree id itself.
		closed=$(gh pr list --repo "$REPO" --base "$BASE" --state closed --limit 1000 --search is:unmerged \
			--json number,body,headRefName,isCrossRepository,mergedAt |
			jq -r --arg prefix "$prefix" --arg tree "$tree" '[.[] | select((.isCrossRepository | not) and .mergedAt == null and (.headRefName | startswith($prefix)) and ((.body // "") | contains($tree)))] | .[0] // empty | .number')
		if [ -n "$closed" ]; then
			echo "Pull request #$closed proposed this copy of pstack-claude's plugins/pstack and was closed without merging, so this run opens no new one. Reopen it to take the copy, and the next run updates it."
			out changed false
			return
		fi
		branch="$prefix$short"
	fi

	if git ls-remote --exit-code origin "refs/heads/$branch" >/dev/null; then
		# The open pull request's branch, or one a run pushed before it failed to open the pull request. Keep its
		# history: bring the base in rather than rebuild the branch.
		git fetch -q origin "refs/heads/$branch:refs/remotes/origin/$branch"
		git switch -q -c "$branch" "origin/$branch"
		git merge -q --no-edit "origin/$BASE" || {
			echo "::error::$branch conflicts with $BASE. Merge $BASE into it${open:+ on pull request #$open} and resolve the conflict, and the next run updates it again."
			exit 1
		}
	else
		git switch -q -c "$branch" "origin/$BASE"
	fi

	sh "$TOOLS/update.sh" "$after"
	# The copy update.sh built decides, not the pin: upstream's newest commit may leave plugins/pstack as it was,
	# as when only its README changes, and then a new pull request, or a commit on the open one, would only move
	# the pin. Without an open pull request the copy is compared with main's.
	local ref=HEAD
	[ -n "$open" ] || ref="origin/$BASE"
	if git diff --quiet "$ref" -- .agents/pstack/plugin; then
		local where=${open:+pull request #$open}
		echo "pstack-claude's plugins/pstack at $short is the copy ${where:-$BASE} already has, so there is nothing to update."
		out changed false
		return
	fi
	git add -- .agents/pstack/pin.json
	# A branch an earlier run pushed may hold this update already, and then only its pull request is missing.
	if [ -n "$(git status --porcelain -- .agents/pstack)" ]; then
		git commit -q -m "chore(pstack): update the pinned copy to $short" -m "Upstream: $upstream/commit/$after"
	fi
	out changed true
	out branch "$branch"
	out title "chore(pstack): update the pinned copy to $short"


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
	fable=$(git grep -l -i fable HEAD -- .agents/pstack/plugin | sed 's|^HEAD:\.agents/pstack/plugin/||' |
		grep -Fx -f <(git diff --name-only "$base" HEAD -- .agents/pstack/plugin | sed 's|^\.agents/pstack/plugin/||') || true)

	list() {
		local name="$1" files="$2" count
		[ -n "$files" ] || return 0
		count=$(printf '%s\n' "$files" | wc -l | tr -d ' ')
		echo
		echo "$name ($count):"
		echo
		# Upstream names the files, so a backquote can't end the code span.
		printf '%s\n' "$files" | head -n 20 | tr '`' "'" | sed 's/^/- `/; s/$/`/'
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
		echo "- \`.agents/pstack/pin.json\` records the new commit and its folder's tree id, \`$tree\`.${stat:+ Diff:$stat.}"
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
	local url=${PUSH_URL:-"https://github.com/$REPO.git"} auth
	if [ -z "${PUSH_URL:-}" ]; then
		# The token goes to git through its environment, not the command line or the URL.
		auth=$(printf 'x-access-token:%s' "$GH_TOKEN" | base64 | tr -d '\n')
		echo "::add-mask::$auth"
		export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=http.https://github.com/.extraheader GIT_CONFIG_VALUE_0="AUTHORIZATION: basic $auth"
	fi
	# Ben may have merged or closed the pull request while the run prepared its update.
	if [ -n "$OPEN" ] && [ "$(gh pr view "$OPEN" --repo "$REPO" --json state --jq .state)" != OPEN ]; then
		echo "Pull request #$OPEN closed while this run prepared its update, so nothing was pushed. The next run starts again."
		return
	fi
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

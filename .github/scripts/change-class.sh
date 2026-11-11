#!/usr/bin/env bash
set -euo pipefail

# Markdown that no tool or page reads. docs-deploy.yml leaves the same files out with its paths filter.
# A changeset, the package README and changelog, a *-body.md file and anything under .audit/ still count,
# so a scratch file still reaches Forbidden paths' full check.
is_markdown() {
	[[ "$1" == *.md ]] || return 1
	# Next builds .md files under the docs app's routes as pages.
	[[ "$1" == apps/docs/app/* ]] && return 1
	[[ "$1" == .changeset/* || "$1" == .audit/* ]] && return 1
	[[ "$1" == packages/design-system/README.md || "$1" == packages/design-system/CHANGELOG.md ]] && return 1
	[[ "$1" != *-body.md ]]
}

is_prose() {
	[[ "$1" =~ ^apps/docs/lib/i18n/sources/[^/]+\.json$ ]] && return 0
	[[ "$1" =~ ^apps/docs/app/(\(en\)|ko)/(.*/)?page\.mdx$ ]]
}

# markdown: only Markdown that nothing reads, so no job but Forbidden paths runs.
# prose: only docs pages and their translation stamp. all: anything else, or nothing.
classify() {
	local markdown=true prose=true count=0 line
	while IFS= read -r line || [ -n "${line:-}" ]; do
		[ -z "$line" ] && continue
		count=$((count + 1))
		is_markdown "$line" || markdown=false
		is_prose "$line" || prose=false
	done
	if [ "$count" -eq 0 ]; then
		echo all
	elif [ "$markdown" = true ]; then
		echo markdown
	elif [ "$prose" = true ]; then
		echo prose
	else
		echo all
	fi
}

self_test() {
	check() {
		local name="$1" expected="$2"
		shift 2
		local got
		if [ "$#" -eq 0 ]; then
			got=$(classify </dev/null)
		else
			got=$(printf '%s\n' "$@" | classify)
		fi
		if [ "$got" != "$expected" ]; then
			printf 'change-class: %s expected %s, got %s\n' "$name" "$expected" "$got" >&2
			exit 1
		fi
	}

	check empty all
	check 'english root page' prose 'apps/docs/app/(en)/page.mdx'
	check 'nested pages and stamp' prose \
		'apps/docs/app/(en)/slider/page.mdx' \
		'apps/docs/app/ko/field/text-input/page.mdx' \
		'apps/docs/lib/i18n/sources/ko.json'
	check 'page plus markdown' all 'apps/docs/app/(en)/slider/page.mdx' 'README.md'
	check 'package source' all 'packages/design-system/src/index.ts'
	check 'docs layout' all 'apps/docs/app/(en)/slider/layout.tsx'
	check 'stamp with a suffix' all 'apps/docs/lib/i18n/sources/ko.json.bak'
	check 'nested stamp' all 'apps/docs/lib/i18n/sources/extra/ko.json'
	check 'translating notes' markdown 'apps/docs/TRANSLATING.md'
	check 'deep page' prose 'apps/docs/app/(en)/a/b/c/page.mdx'
	check changeset all '.changeset/brave-lions-sing.md'
	check changelog all 'packages/design-system/CHANGELOG.md'
	check 'package readme' all 'packages/design-system/README.md'
	check 'root markdown' markdown 'README.md'
	check 'nested markdown' markdown 'docs/decisions/0012-docs-build-in-github.md' '.claude/models.md'
	check 'markdown plus page' all 'README.md' 'apps/docs/app/(en)/page.mdx'
	check 'markdown plus source' all 'README.md' 'packages/design-system/src/index.ts'
	check 'changeset with markdown' all 'README.md' '.changeset/brave-lions-sing.md'
	check 'root body file' all 'pr-body.md'
	check 'nested body file' all 'notes/pr-body.md'
	check 'audit note' all '.audit/notes.md'
	check 'mdx is not markdown' all 'apps/docs/components/Intro.mdx'
	check 'markdown docs page' all 'apps/docs/app/(en)/slider/page.md'
}

if [ "${1:-}" = "--self-test" ]; then
	self_test
	exit 0
fi

classify

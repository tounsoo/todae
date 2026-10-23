#!/usr/bin/env bash
# Classify changed paths for CI. Prints `prose` or `all`.
# `prose` means every path is a docs page, or the stamp of those pages.
# Empty input prints `all`, so a diff we could not read still runs every check.
set -euo pipefail

is_prose() {
	case "$1" in
		apps/docs/lib/i18n/sources/*.json) return 0 ;;
	esac
	[[ "$1" =~ ^apps/docs/app/(\(en\)|ko)/(.*/)?page\.mdx$ ]]
}

classify() {
	local class=prose count=0 line
	while IFS= read -r line || [ -n "${line:-}" ]; do
		[ -z "$line" ] && continue
		count=$((count + 1))
		if ! is_prose "$line"; then
			class=all
		fi
	done
	if [ "$count" -eq 0 ]; then
		class=all
	fi
	printf '%s\n' "$class"
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
	check 'translating notes' all 'apps/docs/TRANSLATING.md'
	check 'deep page' prose 'apps/docs/app/(en)/a/b/c/page.mdx'
}

if [ "${1:-}" = "--self-test" ]; then
	self_test
	exit 0
fi

classify

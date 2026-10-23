#!/usr/bin/env bash
set -euo pipefail

is_prose() {
	[[ "$1" =~ ^apps/docs/lib/i18n/sources/[^/]+\.json$ ]] && return 0
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

# A rename counts both paths. Git only emits R when --find-renames is on.
from_name_status() {
	local status old new
	while IFS=$'\t' read -r status old new || [ -n "${status:-}" ]; do
		[ -z "${status:-}" ] && continue
		case "$status" in
			R*)
				printf '%s\n' "$old"
				[ -n "${new:-}" ] && printf '%s\n' "$new"
				;;
			*) printf '%s\n' "$old" ;;
		esac
	done
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

	check_status() {
		local name="$1" expected="$2" input="$3" got
		got=$(printf '%s\n' "$input" | from_name_status | classify)
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
	check 'translating notes' all 'apps/docs/TRANSLATING.md'
	check 'deep page' prose 'apps/docs/app/(en)/a/b/c/page.mdx'
	check changeset all '.changeset/brave-lions-sing.md'
	check changelog all 'packages/design-system/CHANGELOG.md'

	check_status 'renamed pages' prose $'R100\tapps/docs/app/(en)/a/page.mdx\tapps/docs/app/ko/b/page.mdx'
	check_status 'rename into source' all $'R100\tapps/docs/app/(en)/a/page.mdx\tpackages/design-system/src/a.ts'
	check_status 'deleted page' prose $'D\tapps/docs/app/(en)/a/page.mdx'
}

if [ "${1:-}" = "--self-test" ]; then
	self_test
	exit 0
fi

if [ "${1:-}" = "--name-status" ]; then
	from_name_status | classify
	exit 0
fi

classify

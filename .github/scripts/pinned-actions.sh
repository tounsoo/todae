#!/usr/bin/env bash
set -euo pipefail

# Fails when a workflow or composite action uses a remote action that is not pinned to a full commit SHA.
# A local action (./...) passes, and a docker:// image passes only when pinned to a sha256 digest.
# With no arguments it scans .github/workflows and .github/actions. Each argument is a file to scan instead.

pinned() {
	local ref="$1"
	[[ "$ref" == ./* ]] && return 0
	[[ "$ref" =~ ^docker://[^[:space:]]+@sha256:[0-9a-f]{64}$ ]] && return 0
	[[ "$ref" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_./-]+@[0-9a-f]{40}$ ]]
}

# stdin is one YAML file. $1 is the name to report. Prints one line per unpinned `uses:`.
scan_file() {
	local name="$1" line ref number=0
	while IFS= read -r line || [ -n "$line" ]; do
		number=$((number + 1))
		[[ "$line" =~ ^[[:space:]]*(-[[:space:]]+)?uses:[[:space:]]*(.*)$ ]] || continue
		ref="${BASH_REMATCH[2]}"
		# A comment starts at a # after whitespace, as `@<sha> # v4.4.0` has it.
		ref="${ref%%[[:space:]]#*}"
		ref="${ref%"${ref##*[![:space:]]}"}"
		if [[ "$ref" =~ ^\"(.*)\"$ ]] || [[ "$ref" =~ ^\'(.*)\'$ ]]; then
			ref="${BASH_REMATCH[1]}"
		fi
		if ! pinned "$ref"; then
			printf '%s:%s: %s\n' "$name" "$number" "$ref"
		fi
	done
}

scan() {
	local file hits=""
	for file in "$@"; do
		hits+=$(scan_file "$file" <"$file")
		[ -n "$hits" ] && [ "${hits: -1}" != $'\n' ] && hits+=$'\n'
	done
	[ -z "$hits" ] && return 0
	printf '%s' "$hits" >&2
	printf 'pinned-actions: pin each action above to a full commit SHA, with its version in a comment, such as actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0. Dependabot keeps the pins current.\n' >&2
	return 1
}

default_files() {
	find .github/workflows .github/actions -type f \( -name '*.yml' -o -name '*.yaml' \) 2>/dev/null | LC_ALL=C sort
}

self_test() {
	local dir
	dir=$(mktemp -d)
	trap 'rm -rf "$dir"' RETURN

	check() {
		local name="$1" expect="$2" present="$3" text="$4" got status
		printf '%s' "$text" >"$dir/workflow.yml"
		set +e
		got=$(scan "$dir/workflow.yml" 2>&1)
		status=$?
		set -e
		if [ "$status" != "$expect" ]; then
			printf 'pinned-actions: %s expected exit %s, got %s (%s)\n' "$name" "$expect" "$status" "$got" >&2
			exit 1
		fi
		if [ "$expect" = 0 ] && [ -n "$got" ]; then
			printf 'pinned-actions: %s expected no output, got %s\n' "$name" "$got" >&2
			exit 1
		fi
		if [ -n "$present" ]; then
			case "$got" in
				*"$present"*) ;;
				*)
					printf 'pinned-actions: %s output missing %s (%s)\n' "$name" "$present" "$got" >&2
					exit 1
					;;
			esac
		fi
	}

	local sha=11d5960a326750d5838078e36cf38b85af677262
	local digest=sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

	check empty 0 '' ''
	check 'no uses' 0 '' $'jobs:\n  a:\n    steps:\n      - run: echo uses: actions/checkout@v4\n'
	check 'sha step' 0 '' "      - uses: actions/checkout@$sha # v4.4.0"$'\n'
	check 'sha key' 0 '' "        uses: actions/cache/save@$sha"$'\n'
	check 'reusable workflow' 0 '' "    uses: octo/repo/.github/workflows/build.yml@$sha"$'\n'
	check 'double quoted' 0 '' "      - uses: \"actions/checkout@$sha\" # v4"$'\n'
	check 'single quoted' 0 '' "      - uses: 'actions/checkout@$sha'"$'\n'
	check 'local action' 0 '' $'      - uses: ./.github/actions/setup\n'
	check 'docker digest' 0 '' "      - uses: docker://alpine@$digest"$'\n'
	check 'no final newline' 0 '' "      - uses: actions/checkout@$sha"
	check 'tag' 1 'workflow.yml:1: actions/checkout@v4' $'      - uses: actions/checkout@v4\n'
	check 'tag no final newline' 1 'workflow.yml:1: actions/checkout@v4' '      - uses: actions/checkout@v4'
	check 'branch' 1 'actions/checkout@main' $'      - uses: actions/checkout@main\n'
	check 'sha in comment only' 1 'actions/checkout@v4' "      - uses: actions/checkout@v4 # $sha"$'\n'
	check 'short sha' 1 'actions/checkout@11d5960' $'      - uses: actions/checkout@11d5960 # v4.4.0\n'
	check 'uppercase sha' 1 'actions/checkout@11D5960' "      - uses: actions/checkout@11D5960A326750D5838078E36CF38B85AF677262"$'\n'
	check 'longer than a sha' 1 "actions/checkout@${sha}0" "      - uses: actions/checkout@${sha}0"$'\n'
	check 'no ref' 1 'workflow.yml:1: actions/checkout' $'      - uses: actions/checkout\n'
	check 'quoted tag' 1 'actions/checkout@v4' $'      - uses: "actions/checkout@v4"\n'
	check 'docker tag' 1 'docker://alpine:3.20' $'      - uses: docker://alpine:3.20\n'
	check 'reusable workflow tag' 1 'octo/repo/.github/workflows/build.yml@main' $'    uses: octo/repo/.github/workflows/build.yml@main\n'
	check 'line number' 1 'workflow.yml:3: actions/setup-node@v4' "      - uses: actions/checkout@$sha"$'\n      - uses: ./.github/actions/setup\n      - uses: actions/setup-node@v4\n'
	check 'fix hint' 1 'pinned-actions: pin each action' $'      - uses: actions/checkout@v4\n'
}

if [ "${1:-}" = "--self-test" ]; then
	self_test
	exit 0
fi

if [ "$#" -gt 0 ]; then
	scan "$@"
else
	mapfile -t files < <(default_files)
	if [ "${#files[@]}" -eq 0 ]; then
		echo 'pinned-actions: found no workflow or action files under .github' >&2
		exit 1
	fi
	scan "${files[@]}"
fi

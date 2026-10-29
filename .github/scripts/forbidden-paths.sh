#!/usr/bin/env bash
set -euo pipefail

# stdin is `git diff --name-status --diff-filter=AM` lines (status, tab, path). A D line is allowed.

under_audit() {
	[ "${1#.audit/}" != "$1" ]
}

scratch_body() {
	local base="${1##*/}"
	[[ "$base" == *-body.md ]]
}

png_outside_baselines() {
	local base="${1##*/}"
	[[ "${base,,}" == *.png ]] || return 1
	if [ "${1#apps/docs/visual/baselines/}" = "$1" ]; then
		return 0
	fi
	return 1
}

new_claude_artifact() {
	local status="$1" path="$2"
	[ "$status" = A ] || return 1
	[ "${path#.claude/}" != "$path" ] || return 1
	case "$path" in
		*.md|*.json|*.mjs) return 1 ;;
	esac
	return 0
}

scan() {
	local line status path
	local -a hits=()
	while IFS= read -r line || [ -n "${line:-}" ]; do
		[ -z "$line" ] && continue
		status="${line%%$'\t'*}"
		path="${line#*$'\t'}"
		case "$status" in
			A|M) ;;
			*) continue ;;
		esac
		if under_audit "$path" || scratch_body "$path" || png_outside_baselines "$path" || new_claude_artifact "$status" "$path"; then
			hits+=("$path")
		fi
	done
	if [ "${#hits[@]}" -eq 0 ]; then
		return 0
	fi
	local joined="" hit
	for hit in "${hits[@]}"; do
		if [ -n "$joined" ]; then
			joined="$joined, "
		fi
		joined="$joined$hit"
	done
	printf 'forbidden-paths: drop %s. Do not add or edit a path under .audit/, a *-body.md file, or a PNG outside apps/docs/visual/baselines. A new file under .claude/ must end in .md, .json, or .mjs.\n' "$joined" >&2
	return 1
}

self_test() {
	check() {
		local name="$1" expect="$2" present="$3" absent="$4"
		shift 4
		local got status lines
		set +e
		if [ "$#" -eq 0 ]; then
			got=$(scan </dev/null 2>&1)
		else
			got=$(printf '%s\n' "$@" | scan 2>&1)
		fi
		status=$?
		set -e
		if [ "$status" != "$expect" ]; then
			printf 'forbidden-paths: %s expected exit %s, got %s (%s)\n' "$name" "$expect" "$status" "$got" >&2
			exit 1
		fi
		if [ "$expect" = 0 ]; then
			if [ -n "$got" ]; then
				printf 'forbidden-paths: %s expected no output, got %s\n' "$name" "$got" >&2
				exit 1
			fi
			return 0
		fi
		lines=$(printf '%s\n' "$got" | grep -c . || true)
		if [ "$lines" != 1 ]; then
			printf 'forbidden-paths: %s expected one line, got %s (%s)\n' "$name" "$lines" "$got" >&2
			exit 1
		fi
		case "$got" in
			'forbidden-paths: drop '*) ;;
			*)
				printf 'forbidden-paths: %s output is not a fix hint\n' "$name" >&2
				exit 1
				;;
		esac
		case "$got" in
			*"$present"*) ;;
			*)
				printf 'forbidden-paths: %s output missing %s\n' "$name" "$present" >&2
				exit 1
				;;
		esac
		if [ -n "$absent" ]; then
			case "$got" in
				*"$absent"*)
					printf 'forbidden-paths: %s output names %s\n' "$name" "$absent" >&2
					exit 1
					;;
			esac
		fi
	}

	check empty 0 '' ''
	check 'package source' 0 '' '' $'M\tpackages/design-system/src/index.ts'
	check 'audit add' 1 '.audit/x' '' $'A\t.audit/x'
	check 'audit edit' 1 '.audit/nested/note.md' '' $'M\t.audit/nested/note.md'
	check 'audit delete' 0 '' '' $'D\t.audit/x'
	check 'scratch body' 1 'notes/pr-body.md' '' $'A\tnotes/pr-body.md'
	check 'root scratch body' 1 'foo-body.md' '' $'A\tfoo-body.md'
	check 'plain body name' 0 '' '' $'A\tbody.md'
	check 'body suffix' 0 '' '' $'A\tmy-body.md.bak'
	check 'baseline png' 0 '' '' $'M\tapps/docs/visual/baselines/light/en/home.png'
	check 'baseline uppercase png' 0 '' '' $'A\tapps/docs/visual/baselines/light/en/home.PNG'
	check 'brand png' 1 'mark-32.png' '' $'M\tapps/docs/public/brand/mark-32.png'
	check 'loose png' 1 'screenshot.PNG' '' $'A\tscreenshot.PNG'
	check 'baseline prefix file' 1 'baselines.png' '' $'A\tapps/docs/visual/baselines.png'
	check 'edit claude markdown' 0 '' '' $'M\t.claude/skills/poteto-mode/SKILL.md'
	check 'edit claude script' 0 '' '' $'M\t.claude/skills/poteto-mode/scripts/resume.mjs'
	check 'edit claude json' 0 '' '' $'M\t.claude/settings.json'
	check 'new claude markdown' 0 '' '' $'A\t.claude/skills/example/SKILL.md'
	check 'new claude json' 0 '' '' $'A\t.claude/skills/example/extra.json'
	check 'new claude mjs' 0 '' '' $'A\t.claude/skills/example/extra.mjs'
	check 'new claude png' 1 '.claude/skills/example/shot.png' '' $'A\t.claude/skills/example/shot.png'
	check 'new claude ndjson' 1 '.claude/run.ndjson' '' $'A\t.claude/run.ndjson'
	check 'new claude log' 1 '.claude/debug.log' '' $'A\t.claude/debug.log'
	check 'new claude shell' 1 '.claude/tools/extra.sh' '' $'A\t.claude/tools/extra.sh'
	check 'new claude uppercase md' 1 '.claude/notes.MD' '' $'A\t.claude/notes.MD'
	check 'edit claude log' 0 '' '' $'M\t.claude/debug.log'
	check 'mixed' 1 '.audit/x' 'settings.json' $'M\t.claude/settings.json' $'A\t.audit/x' $'M\tapps/docs/visual/baselines/light/en/home.png'
}

if [ "${1:-}" = "--self-test" ]; then
	self_test
	exit 0
fi

scan

#!/usr/bin/env bash
set -euo pipefail

# stdin is `git diff -z --name-status` records: status, NUL, path, NUL. A D record is allowed.

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
	local status path
	local -a hits=()
	while true; do
		IFS= read -r -d '' status || break
		IFS= read -r -d '' path || break
		case "$status" in
			A|M|T) ;;
			*) continue ;;
		esac
		if under_audit "$path" || scratch_body "$path" || png_outside_baselines "$path" || new_claude_artifact "$status" "$path"; then
			hits+=("$path")
		fi
	done
	if [ "${#hits[@]}" -eq 0 ]; then
		return 0
	fi
	local joined="" hit shown
	for hit in "${hits[@]}"; do
		shown=${hit//$'\n'/\\n}
		if [ -n "$joined" ]; then
			joined="$joined, "
		fi
		joined="$joined$shown"
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
			got=$(printf '%s\0%s\0' "$@" | scan 2>&1)
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
	check 'package source' 0 '' '' M packages/design-system/src/index.ts
	check 'audit add' 1 '.audit/x' '' A .audit/x
	check 'audit edit' 1 '.audit/nested/note.md' '' M .audit/nested/note.md
	check 'audit type change' 1 '.audit/x' '' T .audit/x
	check 'audit delete' 0 '' '' D .audit/x
	check 'quoted audit' 1 '.audit/a"b' '' A '.audit/a"b'
	check 'tab png' 1 $'x\ty.png' '' A $'x\ty.png'
	check 'newline audit' 1 '.audit/a\nb' '' A $'.audit/a\nb'
	check 'scratch body' 1 'notes/pr-body.md' '' A notes/pr-body.md
	check 'root scratch body' 1 'foo-body.md' '' A foo-body.md
	check 'plain body name' 0 '' '' A body.md
	check 'body suffix' 0 '' '' A my-body.md.bak
	check 'baseline png' 0 '' '' M apps/docs/visual/baselines/light/en/home.png
	check 'baseline uppercase png' 0 '' '' A apps/docs/visual/baselines/light/en/home.PNG
	check 'brand png' 1 'mark-32.png' '' M apps/docs/public/brand/mark-32.png
	check 'loose png' 1 'screenshot.PNG' '' A screenshot.PNG
	check 'baseline prefix file' 1 'baselines.png' '' A apps/docs/visual/baselines.png
	check 'edit claude markdown' 0 '' '' M .claude/skills/poteto-mode/SKILL.md
	check 'edit claude script' 0 '' '' M .claude/skills/poteto-mode/scripts/resume.mjs
	check 'edit claude json' 0 '' '' M .claude/settings.json
	check 'edit claude type change' 0 '' '' T .claude/settings.json
	check 'new claude markdown' 0 '' '' A .claude/skills/example/SKILL.md
	check 'new claude json' 0 '' '' A .claude/skills/example/extra.json
	check 'new claude mjs' 0 '' '' A .claude/skills/example/extra.mjs
	check 'new claude png' 1 '.claude/skills/example/shot.png' '' A .claude/skills/example/shot.png
	check 'new claude ndjson' 1 '.claude/run.ndjson' '' A .claude/run.ndjson
	check 'new claude log' 1 '.claude/debug.log' '' A .claude/debug.log
	check 'new claude shell' 1 '.claude/tools/extra.sh' '' A .claude/tools/extra.sh
	check 'new claude uppercase md' 1 '.claude/notes.MD' '' A .claude/notes.MD
	check 'edit claude log' 0 '' '' M .claude/debug.log
	check 'mixed' 1 '.audit/x' 'settings.json' M .claude/settings.json A .audit/x M apps/docs/visual/baselines/light/en/home.png
}

if [ "${1:-}" = "--self-test" ]; then
	self_test
	exit 0
fi

scan

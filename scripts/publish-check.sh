#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"

dest=$(mktemp -d)
trap 'rm -rf "$dest"' EXIT

pnpm --dir packages/design-system pack --pack-destination "$dest" --config.ignore-scripts=true

shopt -s nullglob
tarballs=("$dest"/*.tgz)
if [ "${#tarballs[@]}" -ne 1 ]; then
	printf 'publish-check: expected one tarball, found %s\n' "${#tarballs[@]}" >&2
	exit 1
fi
tarball=${tarballs[0]}

pnpm exec publint run "$tarball"
pnpm exec attw --format ascii --no-emoji --profile esm-only "$tarball" --exclude-entrypoints ./todae.css ./dist/todae.css

#!/usr/bin/env bash
# Playwright starts this in place of a browser on macOS, from playwright.host.ts. It runs the browser Playwright
# would have run ($TODAE_BROWSER) with Playwright's arguments, then the Cocoa arguments in $TODAE_COCOA_DEFAULTS,
# such as "-AppleKeyboardUIMode 2". Those set a macOS default for this one process, not for the Mac.
set -euo pipefail

if [ -z "${TODAE_BROWSER:-}" ]; then
	echo 'macos-browser.sh: TODAE_BROWSER is not set; start it from playwright.host.ts' >&2
	exit 2
fi
browser="$TODAE_BROWSER"
cocoa="${TODAE_COCOA_DEFAULTS:-}"
unset TODAE_BROWSER TODAE_COCOA_DEFAULTS
# The defaults are "-Key value" pairs with no spaces inside a key or a value, so word splitting is what's wanted.
# shellcheck disable=SC2086
exec "$browser" "$@" $cocoa

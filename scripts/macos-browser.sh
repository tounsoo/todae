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
# Playwright checks only that this script exists, so a missing browser would fail below with bash's own error.
# Say it the way Playwright does, so the verify helper reports it as a missing install, not a failure.
if [ ! -x "$browser" ]; then
	echo "macos-browser.sh: Executable doesn't exist at $browser; run npx playwright install" >&2
	exit 1
fi
cocoa="${TODAE_COCOA_DEFAULTS:-}"
unset TODAE_BROWSER TODAE_COCOA_DEFAULTS
# The defaults are "-Key value" pairs with no spaces inside a key or a value, so word splitting is what's wanted.
# shellcheck disable=SC2086
exec "$browser" "$@" $cocoa

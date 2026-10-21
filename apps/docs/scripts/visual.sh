#!/bin/sh
# Runs the screenshot tests in Playwright's Docker image, the one CI's docs job runs in, since
# fonts and rendering differ between machines. Build the docs first. Arguments go to Playwright,
# so `--update-snapshots` rewrites the baselines.
set -eu
root=$(cd "$(dirname "$0")/../../.." && pwd)
image=$(grep -o 'mcr.microsoft.com/playwright:[^ ]*' "$root/.github/workflows/ci.yml")
exec docker run --rm --ipc=host -v "$root:$root" -w "$root/apps/docs" "$image" npx playwright test "$@"

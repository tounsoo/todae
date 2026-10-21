#!/bin/sh
# Runs the screenshot tests in Playwright's Docker image, the one CI's docs job runs in, since
# fonts and rendering differ between machines. Build the package and the docs first. Arguments go
# to Playwright, so `--update-snapshots` rewrites the baselines.
set -eu
root=$(cd "$(dirname "$0")/../../.." && pwd)
# The container runs the checkout's node_modules and build, so they must be Linux x64 ones.
if [ "$(uname -s)-$(uname -m)" != Linux-x86_64 ]; then
  echo "visual.sh needs a Linux x64 host. Elsewhere, push and take the images from CI's screenshots artifact." >&2
  exit 1
fi
version=$(cd "$root/apps/docs" && node -p "require('@playwright/test/package.json').version")
exec docker run --rm --ipc=host --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$root:$root" -w "$root/apps/docs" \
  "mcr.microsoft.com/playwright:v$version-noble" npx playwright test "$@"

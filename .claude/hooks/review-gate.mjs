// PreToolUse hook for Bash. Blocks `git push` until the commit being pushed
// has come back from a review round with no blocking findings, so review
// fixes stay local until they are reviewed (CLAUDE.md, review loop step 6).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** The file in the git dir that holds the last commit a review round passed. */
export const MARKER = 'todae-review-clean';

/** True when a shell command runs `git push`, with or without git options before it. */
export function isPush(command) {
  return /(^|[\s;&|(])git(\s+-[Cc]\s+\S+|\s+--?[\w.-]+(=\S+)?)*\s+push(?=[\s;&|)]|$)/.test(command);
}

/** Why a push from `cwd` is blocked, or null when it may go ahead. */
export function blockReason(cwd) {
  const git = (...args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  let head;
  try {
    head = git('rev-parse', 'HEAD');
  } catch {
    return null; // Not a repository: nothing to gate.
  }
  // A branch with nothing beyond main, such as one just restarted from it, has nothing to review.
  try {
    git('merge-base', '--is-ancestor', 'HEAD', 'origin/main');
    return null;
  } catch {
    // HEAD has commits main does not.
  }
  let clean = '';
  try {
    clean = readFileSync(resolve(cwd, git('rev-parse', '--git-path', MARKER)), 'utf8').trim();
  } catch {
    // No round has come back clean yet.
  }
  if (clean === head) return null;
  return [
    `Push blocked: ${head.slice(0, 7)} has not come back clean from a review round.`,
    'Keep the commits local and continue the review loop in CLAUDE.md in this turn.',
    `After a round with no blocking findings, run \`git rev-parse HEAD > "$(git rev-parse --git-path ${MARKER})"\`, then push.`,
  ].join('\n');
}

async function main() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const { tool_name: tool, tool_input: toolInput, cwd } = JSON.parse(input || '{}');
  if (tool !== 'Bash' || !isPush(toolInput?.command ?? '')) return;
  const reason = blockReason(cwd || process.cwd());
  if (reason) {
    process.stderr.write(`${reason}\n`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();

// Vercel's Ignored Build Step for the docs site. `ignoreCommand` in `apps/docs/vercel.json` runs it
// before every deployment. Exit 0 skips the build; exit 1, or any crash, builds.
//
// Production (docs-stable) and main always build. Any other branch builds only while it has an open
// pull request that isn't a draft, so a draft, or a branch with no pull request, costs no preview.
// When GitHub can't be read, it builds: a missing preview costs more than an extra one.

import { pathToFileURL } from 'node:url';

const ALWAYS_BUILD = new Set(['main', 'docs-stable']);

/**
 * @param {Record<string, string | undefined>} env
 * @param {typeof fetch} fetchImpl
 * @returns {Promise<{ build: boolean, reason: string }>}
 */
export async function decide(env, fetchImpl = fetch) {
  const ref = env.VERCEL_GIT_COMMIT_REF;
  if (env.VERCEL_ENV === 'production') return { build: true, reason: 'production deployment' };
  if (!ref) return { build: true, reason: 'no Git branch to check' };
  if (ALWAYS_BUILD.has(ref)) return { build: true, reason: `${ref} always builds` };

  const owner = env.VERCEL_GIT_REPO_OWNER;
  const repo = env.VERCEL_GIT_REPO_SLUG;
  if (!owner || !repo) return { build: true, reason: 'no repository to check' };

  const api = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const id = env.VERCEL_GIT_PULL_REQUEST_ID;
  const url = id
    ? `${api}/pulls/${encodeURIComponent(id)}`
    : `${api}/pulls?state=open&per_page=10&head=${encodeURIComponent(`${owner}:${ref}`)}`;

  let body;
  try {
    const headers = { accept: 'application/vnd.github+json', 'user-agent': 'todae-vercel-ignore-build' };
    if (env.GITHUB_TOKEN) headers.authorization = `Bearer ${env.GITHUB_TOKEN}`;
    const response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return { build: true, reason: `GitHub answered ${response.status}` };
    body = await response.json();
  } catch (error) {
    return { build: true, reason: `GitHub couldn't be read (${error?.message ?? error})` };
  }

  const pulls = (Array.isArray(body) ? body : [body]).filter((pull) => pull?.state === 'open');
  if (pulls.length === 0) return { build: false, reason: `${ref} has no open pull request` };
  const ready = pulls.find((pull) => !pull.draft);
  if (ready) return { build: true, reason: `pull request #${ready.number} is ready for review` };
  return { build: false, reason: `pull request #${pulls[0].number} is a draft` };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { build, reason } = await decide(process.env);
  console.log(`${build ? 'Building' : 'Skipping the build'}: ${reason}.`);
  process.exit(build ? 1 : 0);
}

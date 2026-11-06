/**
 * Git and build steps: reading what this checkout is, and building an older
 * ref in a temporary worktree so it can run beside the current code.
 */
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { BENCH_DIR } from './app.ts';

const exec = promisify(execFile);

export const REPO_DIR = resolve(BENCH_DIR, '..', '..');
export const PACKAGE_DIR = join(REPO_DIR, 'packages', 'design-system');

export async function git(args: readonly string[], cwd = REPO_DIR): Promise<string> {
  const { stdout } = await exec('git', args, { cwd, maxBuffer: 16 * 1024 * 1024 });
  return stdout.trim();
}

/** Runs a command and streams its output, failing with its exit code. */
async function run(command: string, args: readonly string[], cwd: string, log: (line: string) => void): Promise<void> {
  log(`$ ${command} ${args.join(' ')}  (in ${cwd})`);
  await exec(command, args, { cwd, maxBuffer: 64 * 1024 * 1024 }).catch((error: { stderr?: string; message: string }) => {
    throw new Error(`${command} ${args.join(' ')} failed in ${cwd}: ${(error.stderr ?? error.message).trim().split('\n').slice(-5).join('\n')}`);
  });
}

export async function packageVersion(todaeDir: string): Promise<string> {
  const manifest = JSON.parse(await readFile(join(todaeDir, 'package.json'), 'utf8')) as { version?: string };
  return manifest.version ?? 'unknown';
}

export type Checkout = { ref: string; sha: string; dirty: boolean };

/** This checkout: its branch (or GITHUB_REF_NAME in CI), SHA, and whether todae's files have local changes. */
export async function describeCheckout(): Promise<Checkout> {
  const sha = await git(['rev-parse', 'HEAD']);
  const branch = process.env.GITHUB_REF_NAME || (await git(['rev-parse', '--abbrev-ref', 'HEAD']));
  // The billing case renders the docs playground, so its files count too.
  const status = await git(['status', '--porcelain', '--', 'packages/design-system', 'apps/bench/app', 'apps/docs/components']);
  return { ref: branch === 'HEAD' ? sha.slice(0, 7) : branch, sha, dirty: status.length > 0 };
}

export async function buildCurrent(log: (line: string) => void): Promise<void> {
  await run('pnpm', ['build:ds'], REPO_DIR, log);
}

export type BuiltRef = { ref: string; sha: string; todaeDir: string; cleanup(): Promise<void> };

/**
 * Checks `ref` out in a temporary worktree, installs it and builds its
 * package. Fetches the ref from origin first when it isn't known locally,
 * since CI clones are shallow.
 */
export async function buildRef(ref: string, log: (line: string) => void): Promise<BuiltRef> {
  let sha = await git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).catch(() => '');
  if (!sha) {
    log(`Fetching ${ref} from origin`);
    // --depth on a full clone would make it shallow, so only a shallow clone fetches shallow.
    const depth = (await git(['rev-parse', '--is-shallow-repository'])) === 'true' ? ['--depth=1'] : [];
    await git(['fetch', ...depth, 'origin', ref]).catch(() => git(['fetch', ...depth, 'origin', `refs/tags/${ref}:refs/tags/${ref}`]));
    sha = await git(['rev-parse', '--verify', `FETCH_HEAD^{commit}`]);
  }
  const dir = await mkdtemp(join(tmpdir(), 'todae-bench-'));
  const worktree = join(dir, 'todae');
  await git(['worktree', 'add', '--detach', worktree, sha]);
  const cleanup = async () => {
    process.off('SIGINT', interrupted).off('SIGTERM', interrupted);
    await git(['worktree', 'remove', '--force', worktree]).catch(() => undefined);
    await rm(dir, { recursive: true, force: true });
  };
  // Ctrl-C skips every finally, which would leave the worktree registered and its install on disk.
  const interrupted = (signal: NodeJS.Signals) => {
    log(`Stopped by ${signal}; removing the ${ref} worktree`);
    void cleanup().finally(() => process.exit(signal === 'SIGINT' ? 130 : 143));
  };
  process.once('SIGINT', interrupted).once('SIGTERM', interrupted);
  try {
    await run('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], worktree, log);
    await run('pnpm', ['build:ds'], worktree, log);
  } catch (error) {
    await cleanup();
    throw error;
  }
  return { ref, sha, todaeDir: join(worktree, 'packages', 'design-system'), cleanup };
}

import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  auditTokenApiHistory,
  formatTokenApiSnapshot,
  parseTokenApiSnapshot,
  removedPublicTokenPaths,
  tokenApiSnapshot,
  type TokenApiEntry,
  type TokenApiSnapshot,
} from './api.ts';

const script = join(import.meta.dirname, '../check-token-api.ts');
const snapshotPath = join('packages', 'design-system', 'tokens', 'api.json');
const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Todae Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Todae Test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
};

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function snapshot(tokens: TokenApiEntry[]): TokenApiSnapshot {
  return { version: 1, tokens };
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, env: gitEnv, encoding: 'utf8' });
}

async function repo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'token-api-'));
  roots.push(root);
  git(root, ['init', '-b', 'main']);
  return root;
}

async function commitSnapshot(root: string, tokens: TokenApiEntry[], message: string): Promise<string> {
  const file = join(root, snapshotPath);
  await mkdir(join(root, 'packages', 'design-system', 'tokens'), { recursive: true });
  await writeFile(file, formatTokenApiSnapshot(tokenApiSnapshot(tokens)));
  git(root, ['add', snapshotPath]);
  git(root, ['commit', '-m', message]);
  return git(root, ['rev-parse', 'HEAD']).trim();
}

function check(root: string, base: string, head: string): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(
      process.execPath,
      ['--experimental-strip-types', '--no-warnings=ExperimentalWarning', script, '--base', base, '--head', head],
      { cwd: root, encoding: 'utf8' },
    );
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    return output(error);
  }
}

function output(error: unknown): { status: number; stdout: string; stderr: string } {
  if (typeof error !== 'object' || error === null) return { status: 1, stdout: '', stderr: String(error) };
  const status = 'status' in error && typeof error.status === 'number' ? error.status : 1;
  const stdout = 'stdout' in error && typeof error.stdout === 'string' ? error.stdout : '';
  const stderr = 'stderr' in error && typeof error.stderr === 'string' ? error.stderr : '';
  return { status, stdout, stderr };
}

describe('public token API snapshot', () => {
  it('keeps one type per path, sorted by path', () => {
    const api = tokenApiSnapshot([
      { path: 'separator.color', type: 'color' },
      { path: 'separator.color', type: 'color' },
      { path: 'button.bg.default', type: 'color' },
    ]);
    expect(api.tokens.map((token) => token.path)).toEqual(['button.bg.default', 'separator.color']);
    expect(formatTokenApiSnapshot(api)).toBe(
      `${JSON.stringify({ version: 1, tokens: [{ path: 'button.bg.default', type: 'color' }, { path: 'separator.color', type: 'color' }] }, null, 2)}\n`,
    );
  });

  it('rejects two types for one path', () => {
    expect(() => tokenApiSnapshot([{ path: 'separator.color', type: 'color' }, { path: 'separator.color', type: 'dimension' }])).toThrow(
      /separator\.color/,
    );
  });

  it('treats a dropped path as a removal and an added path as allowed', () => {
    const base = snapshot([
      { path: 'button.bg.default', type: 'color' },
      { path: 'separator.color', type: 'color' },
    ]);
    const added = snapshot([
      { path: 'button.bg.default', type: 'color' },
      { path: 'separator.color', type: 'color' },
      { path: 'separator.inset', type: 'dimension' },
    ]);
    const renamed = snapshot([
      { path: 'button.bg.default', type: 'color' },
      { path: 'separator.ink', type: 'color' },
    ]);
    const restored = snapshot([
      { path: 'button.bg.default', type: 'color' },
      { path: 'separator.color', type: 'color' },
      { path: 'separator.ink', type: 'color' },
    ]);
    expect(removedPublicTokenPaths(base, added)).toEqual([]);
    expect(removedPublicTokenPaths(base, renamed)).toEqual(['separator.color']);
    expect(auditTokenApiHistory([base, renamed, restored])).toEqual(['separator.color']);
  });

  it('rejects a snapshot that is not the committed shape', () => {
    expect(() => parseTokenApiSnapshot({ version: 2, tokens: [] })).toThrow(/version must be 1/);
    expect(() => parseTokenApiSnapshot({ version: 1, tokens: [{ path: 'separator.color', type: 'color' }, { path: 'separator.color', type: 'color' }] })).toThrow(
      /more than once/,
    );
  });
});

describe('check-token-api', () => {
  it('passes when a commit only adds a path', async () => {
    const root = await repo();
    const base = await commitSnapshot(root, [{ path: 'separator.color', type: 'color' }], 'base');
    const head = await commitSnapshot(
      root,
      [
        { path: 'separator.color', type: 'color' },
        { path: 'separator.inset', type: 'dimension' },
      ],
      'add separator.inset',
    );
    const result = check(root, base, head);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('no removals or renames');
  });

  it('fails a removal even when the commit includes a breaking changeset', async () => {
    const root = await repo();
    const base = await commitSnapshot(
      root,
      [
        { path: 'separator.color', type: 'color' },
        { path: 'separator.thickness', type: 'dimension' },
      ],
      'base',
    );
    await commitSnapshot(root, [{ path: 'separator.color', type: 'color' }], 'remove separator.thickness');
    await mkdir(join(root, '.changeset'), { recursive: true });
    await writeFile(
      join(root, '.changeset', 'remove-thickness.md'),
      '---\n"@tounsoo/todae": minor\n---\n\nRemove separator.thickness.\n\n- separator.thickness is gone.\n',
    );
    git(root, ['add', '.changeset/remove-thickness.md']);
    git(root, ['commit', '-m', 'mark the removal breaking']);
    const withChangeset = git(root, ['rev-parse', 'HEAD']).trim();
    const result = check(root, base, withChangeset);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('separator.thickness');
    expect(result.stderr).toContain('A changeset does not waive this.');
    expect(result.stderr).not.toContain('separator.color');
  });

  it('fails when a later commit restores a path an earlier commit removed', async () => {
    const root = await repo();
    const base = await commitSnapshot(
      root,
      [
        { path: 'separator.color', type: 'color' },
        { path: 'separator.thickness', type: 'dimension' },
      ],
      'base',
    );
    await commitSnapshot(root, [{ path: 'separator.color', type: 'color' }], 'remove separator.thickness');
    const restored = await commitSnapshot(
      root,
      [
        { path: 'separator.color', type: 'color' },
        { path: 'separator.thickness', type: 'dimension' },
      ],
      'restore separator.thickness',
    );
    const result = check(root, base, restored);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('separator.thickness');
  });
});

import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  apiBreaks,
  breakingBump,
  exportName,
  formatApiSnapshot,
  parseApiSnapshot,
  parseChangeset,
  unacknowledged,
  usersOf,
  type ApiSnapshot,
} from './compare.ts';

const script = join(import.meta.dirname, '../check-typescript-api.ts');
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

function snapshot(paths: Record<string, string>): ApiSnapshot {
  return { version: 1, entries: { '@tounsoo/todae': paths } };
}

describe('apiBreaks', () => {
  it('reports removed and changed paths, not added ones', () => {
    const before = snapshot({ Button: '(arg0: ButtonProps) => JSX.Element', 'type ButtonProps.tone?': "'info' | undefined", Gone: 'string' });
    const after = snapshot({ Button: '(arg0: ButtonProps) => JSX.Element', 'type ButtonProps.tone?': "'critical' | undefined", Added: 'number' });
    expect(apiBreaks(before, after)).toEqual([
      { kind: 'removed', entry: '@tounsoo/todae', path: 'Gone', was: 'string' },
      { kind: 'changed', entry: '@tounsoo/todae', path: 'type ButtonProps.tone?', was: "'info' | undefined", now: "'critical' | undefined" },
    ]);
  });

  it('counts a whole entry point that disappeared as removals', () => {
    const before: ApiSnapshot = { version: 1, entries: { '@tounsoo/todae/stack': { Stack: 'object' } } };
    expect(apiBreaks(before, { version: 1, entries: {} })).toEqual([
      { kind: 'removed', entry: '@tounsoo/todae/stack', path: 'Stack', was: 'object' },
    ]);
  });
});

describe('apiBreaks for internal types', () => {
  it('counts a renamed internal type as changed, and a member it lost as removed', () => {
    const before = snapshot({ Close: '(arg0: ActionProps) => null', 'internal ActionProps': 'object', 'internal ActionProps.size?': 'string' });
    const renamed = snapshot({ Close: '(arg0: CloseProps) => null', 'internal CloseProps': 'object', 'internal CloseProps.size?': 'string' });
    expect(apiBreaks(before, renamed).map((item) => [item.kind, item.path])).toEqual([
      ['changed', 'Close'],
      ['changed', 'internal ActionProps'],
      ['changed', 'internal ActionProps.size?'],
    ]);
    const narrowed = snapshot({ Close: '(arg0: ActionProps) => null', 'internal ActionProps': 'object' });
    expect(apiBreaks(before, narrowed).map((item) => [item.kind, item.path])).toEqual([['removed', 'internal ActionProps.size?']]);
  });
});

describe('usersOf', () => {
  it('accepts a changeset that names an export using the broken type', () => {
    const after = snapshot({ Dialog: 'object', 'Dialog.Close': '(arg0: ActionProps) => null', 'internal ActionProps': 'object' });
    const removed = { kind: 'removed', entry: '@tounsoo/todae', path: 'internal ActionProps.size?', was: 'string' } as const;
    const set = { file: 'm.md', bump: 'minor' as const, text: '- `Dialog.Close` no longer takes `size`.' };
    expect(usersOf([after])('ActionProps')).toEqual(new Set(['ActionProps', 'Dialog']));
    expect(unacknowledged([removed], [set], 'minor', usersOf([after]))).toEqual([]);
    expect(unacknowledged([removed], [set], 'minor')).toHaveLength(1);
  });
});

describe('exportName', () => {
  it('reads the export a path belongs to', () => {
    expect(exportName('type ButtonRootProps.variant?')).toBe('ButtonRootProps');
    expect(exportName('type TooltipWire<I extends boolean = false>')).toBe('TooltipWire');
    expect(exportName("type ThemeOverrideKey | 'focus.ring.color'")).toBe('ThemeOverrideKey');
    expect(exportName('Alert.Root')).toBe('Alert');
    expect(exportName('internal ActionProps.size?')).toBe('ActionProps');
  });
});

describe('breakingBump', () => {
  it('is minor before 1.0.0 and major after', () => {
    expect(breakingBump('0.6.0')).toBe('minor');
    expect(breakingBump('1.0.0')).toBe('major');
  });
});

describe('parseChangeset', () => {
  it('reads the bump for the package and the changelog text', () => {
    const set = parseChangeset('.changeset/a.md', "---\n'@tounsoo/todae': minor\n---\n\nRemoves `Gone`.\n", '@tounsoo/todae');
    expect(set).toEqual({ file: '.changeset/a.md', bump: 'minor', text: '\nRemoves `Gone`.\n' });
  });

  it('gives an empty changeset no bump', () => {
    expect(parseChangeset('.changeset/b.md', '---\n---\n\nGone\n', '@tounsoo/todae').bump).toBeNull();
  });
});

describe('unacknowledged', () => {
  const removed = { kind: 'removed', entry: '@tounsoo/todae', path: 'type GoneProps.size?', was: 'string' } as const;
  const changed = { kind: 'changed', entry: '@tounsoo/todae', path: 'type ToneProps.tone?', was: 'a', now: 'b' } as const;

  it('needs the breaking bump for a removal and any bump for a change, each naming the export', () => {
    const patch = { file: 'p.md', bump: 'patch' as const, text: 'Widens `ToneProps` and drops `GoneProps.size`.' };
    expect(unacknowledged([removed, changed], [patch], 'minor')).toEqual([{ name: 'GoneProps', needs: 'minor', breaks: [removed] }]);
    const minor = { file: 'm.md', bump: 'minor' as const, text: '- `GoneProps` loses `size`; set the size with CSS.' };
    expect(unacknowledged([removed, changed], [patch, minor], 'minor')).toEqual([]);
  });

  it('matches the name as a whole word', () => {
    const set = { file: 'm.md', bump: 'minor' as const, text: 'Changes GonePropsExtra.' };
    expect(unacknowledged([removed], [set], 'minor')).toHaveLength(1);
  });

  it('ignores a changeset that does not bump the package', () => {
    const set = { file: 'e.md', bump: null, text: 'GoneProps' };
    expect(unacknowledged([removed], [set], 'minor')).toHaveLength(1);
  });
});

function git(cwd: string, args: string[]): string {
  return execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], {
    cwd,
    env: gitEnv,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function write(root: string, path: string, text: string): Promise<void> {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), text);
}

async function repo(paths: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'typescript-api-range-'));
  roots.push(root);
  git(root, ['init', '-b', 'main']);
  await write(root, 'packages/design-system/package.json', JSON.stringify({ name: '@tounsoo/todae', version: '0.6.0' }));
  await commit(root, paths, 'base');
  return root;
}

async function commit(root: string, paths: Record<string, string>, message: string, extra: Record<string, string> = {}): Promise<string> {
  await write(root, 'packages/design-system/typescript-api.json', formatApiSnapshot(snapshot(paths)));
  for (const [path, text] of Object.entries(extra)) await write(root, path, text);
  git(root, ['add', '-A']);
  git(root, ['commit', '-m', message]);
  return git(root, ['rev-parse', 'HEAD']).trim();
}

function check(root: string, base: string, head: string): { ok: boolean; output: string } {
  try {
    const output = execFileSync(
      process.execPath,
      ['--experimental-strip-types', '--no-warnings=ExperimentalWarning', script, '--base', base, '--head', head],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return { ok: true, output };
  } catch (error) {
    return { ok: false, output: String((error as { stderr?: unknown }).stderr) };
  }
}

describe('check-typescript-api --base', () => {
  it('fails a removal until a minor changeset names the export', async () => {
    const root = await repo({ Gone: 'string', Kept: 'number' });
    git(root, ['checkout', '-b', 'branch']);
    const head = await commit(root, { Kept: 'number' }, 'remove Gone');
    const failed = check(root, 'main', head);
    expect(failed.ok).toBe(false);
    expect(failed.output).toContain('- Gone (needs a minor or larger changeset that names Gone or an export that uses it)');
    expect(failed.output).toContain('  - removed @tounsoo/todae Gone: string');

    const patched = await commit(root, { Kept: 'number' }, 'patch', { '.changeset/a.md': "---\n'@tounsoo/todae': patch\n---\n\nRemoves `Gone`.\n" });
    expect(check(root, 'main', patched).ok).toBe(false);
    const fixed = await commit(root, { Kept: 'number' }, 'minor', { '.changeset/a.md': "---\n'@tounsoo/todae': minor\n---\n\nRemoves `Gone`.\n" });
    expect(check(root, 'main', fixed)).toEqual({ ok: true, output: 'Public TypeScript API has no unacknowledged removals or changes.\n' });
  });

  it('compares with the merge base, so what main added since is not a removal', async () => {
    const root = await repo({ Kept: 'number' });
    git(root, ['checkout', '-b', 'branch']);
    const head = await commit(root, { Kept: 'number', Mine: 'string' }, 'add Mine');
    git(root, ['checkout', 'main']);
    await commit(root, { Kept: 'number', Theirs: 'boolean' }, 'add Theirs');
    expect(check(root, 'main', head).ok).toBe(true);
  });

  it('does not count a changeset that main added', async () => {
    const root = await repo({ Gone: 'string' });
    git(root, ['checkout', '-b', 'branch']);
    const head = await commit(root, {}, 'remove Gone');
    git(root, ['checkout', 'main']);
    await commit(root, { Gone: 'string' }, 'unrelated', { '.changeset/b.md': "---\n'@tounsoo/todae': minor\n---\n\nGone\n" });
    expect(check(root, 'main', head).ok).toBe(false);
  });

  it('passes when the base has no report yet', async () => {
    const root = await mkdtemp(join(tmpdir(), 'typescript-api-range-'));
    roots.push(root);
    git(root, ['init', '-b', 'main']);
    await write(root, 'packages/design-system/package.json', JSON.stringify({ name: '@tounsoo/todae', version: '0.6.0' }));
    git(root, ['add', '-A']);
    git(root, ['commit', '-m', 'base']);
    git(root, ['checkout', '-b', 'branch']);
    const head = await commit(root, { Added: 'string' }, 'add report');
    expect(check(root, 'main', head).ok).toBe(true);
  });
});

describe('parseApiSnapshot', () => {
  it('round-trips the formatted snapshot', () => {
    const value = snapshot({ 'type A': "'x' | 'y'" });
    expect(parseApiSnapshot(formatApiSnapshot(value))).toEqual(value);
  });

  it('rejects a snapshot without entries', () => {
    expect(() => parseApiSnapshot('{"version":1}')).toThrow('needs version 1 and an entries object');
  });
});

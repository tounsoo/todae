import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildReport, parseSnapshot, renderMarkdown, readsOf, type Snapshot } from './consumers.ts';

const script = join(import.meta.dirname, '../token-consumers.ts');
const catalogPath = join('packages', 'design-system', 'tokens', 'tokens.generated.json');
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

type FixtureRow = {
  path: string;
  cssValue: string;
  context?: string | null;
  type?: string;
};

function cssVar(path: string): string {
  return `--todae-${path.replaceAll('.', '-')}`;
}

function catalog(rows: FixtureRow[]) {
  return {
    version: 1,
    tokens: rows.map((row) => ({
      path: row.path,
      type: row.type ?? 'color',
      cssVar: cssVar(row.path),
      cssValue: row.cssValue,
      context: row.context ?? null,
      description: 'ignored',
    })),
  };
}

function snap(rows: FixtureRow[]): Snapshot {
  return parseSnapshot(catalog(rows));
}

function markdown(base: FixtureRow[], head: FixtureRow[], files: { path: string; source: string; tree?: 'head' | 'base' }[], ends = { base: 'abc1234aaa', head: 'def5678bbb' }): string {
  return renderMarkdown(buildReport({ base: snap(base), head: snap(head), files }), ends);
}

function componentRows(text: string): string[] {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.startsWith('| Component |'));
  if (start < 0) return [];
  const rows: string[] = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith('|')) break;
    rows.push(line);
  }
  return rows;
}

describe('token consumers', () => {
  it('names only the component that reads a changed token directly', () => {
    const base = [{ path: 'progress.height', cssValue: '4px', type: 'dimension' }];
    const head = [{ path: 'progress.height', cssValue: '8px', type: 'dimension' }];
    const text = markdown(base, head, [
      { path: 'src/components/Progress.module.css', source: '.bar { height: var(--todae-progress-height); }' },
      { path: 'src/components/Button.module.css', source: '.btn { background: var(--todae-button-bg-default); }' },
    ]);
    expect(componentRows(text)).toEqual(['| Progress | `--todae-progress-height` | `progress.height` |']);
    expect(text).toContain('1 token changed, 1 var affected, 1 component reads them.');
    expect(text).not.toContain('Button');
  });

  it('follows a token reference to the component that reads the dependent', () => {
    const shared = [{ path: 'progress.fill', cssValue: 'var(--todae-color-accent-default)' }];
    const base = [
      { path: 'color.accent.default', cssValue: 'oklch(0.2 0 0)', context: 'light' },
      { path: 'color.accent.default', cssValue: 'oklch(0.9 0 0)', context: 'dark' },
      ...shared,
    ];
    const head = [
      { path: 'color.accent.default', cssValue: 'oklch(0.3 0 0)', context: 'light' },
      { path: 'color.accent.default', cssValue: 'oklch(0.8 0 0)', context: 'dark' },
      ...shared,
    ];
    const text = markdown(base, head, [
      { path: 'src/components/Progress.module.css', source: '.bar { background: var(--todae-progress-fill); }' },
      { path: 'src/styles/base.css', source: 'color: var(--todae-color-accent-default);' },
    ]);
    expect(text).toContain('| `color.accent.default` | changed | light, dark |');
    expect(text).toContain('| Progress | `--todae-progress-fill` | `color.accent.default` → `progress.fill` |');
    expect(text).toContain('Other files: `src/styles/base.css` (`--todae-color-accent-default`).');
    expect(text).toContain('1 component reads them.');
  });

  it('walks core to appearance to contract, and only the light context', () => {
    const rest = [
      { path: 'color.fg', cssValue: 'var(--todae-core-ink)', context: 'light' },
      { path: 'color.fg', cssValue: 'black', context: 'dark' },
      { path: 'text.fg', cssValue: 'var(--todae-color-fg)' },
    ];
    const text = markdown(
      [{ path: 'core.ink', cssValue: 'oklch(0.2 0 0)', context: 'light' }, ...rest],
      [{ path: 'core.ink', cssValue: 'oklch(0.3 0 0)', context: 'light' }, ...rest],
      [{ path: 'src/components/Text.module.css', source: '.copy { color: var(--todae-text-fg); }' }],
    );
    expect(text).toContain('| `core.ink` | changed | light |');
    expect(text).not.toContain('| dark |');
    expect(text).toContain('| Text | `--todae-text-fg` | `core.ink` → `color.fg` → `text.fg` |');
  });

  it('reaches Button through the pack consume alias', () => {
    const text = markdown(
      [{ path: 'button.primary.bg-default', cssValue: 'oklch(0.2 0 0)' }],
      [{ path: 'button.primary.bg-default', cssValue: 'oklch(0.4 0 0)' }],
      [{ path: 'src/components/Button.module.css', source: '.btn { background: var(--_button-bg-default, var(--todae-button-bg-default)); }' }],
    );
    expect(text).toContain('| Button | `--todae-button-bg-default` | `button.primary.bg-default` → `button.bg-default` |');
  });

  it('reaches a value that references both a color and an alpha', () => {
    const soft = 'oklch(from var(--todae-color-accent-default) l c h / var(--todae-opacity-12))';
    const file = [{ path: 'src/components/Badge.module.css', source: '.badge { background: var(--todae-color-accent-soft); }' }];
    const fromColor = markdown(
      [
        { path: 'color.accent.default', cssValue: 'oklch(0.2 0 0)' },
        { path: 'opacity.12', cssValue: '0.12', type: 'number' },
        { path: 'color.accent.soft', cssValue: soft },
      ],
      [
        { path: 'color.accent.default', cssValue: 'oklch(0.3 0 0)' },
        { path: 'opacity.12', cssValue: '0.12', type: 'number' },
        { path: 'color.accent.soft', cssValue: soft },
      ],
      file,
    );
    const fromAlpha = markdown(
      [
        { path: 'color.accent.default', cssValue: 'oklch(0.2 0 0)' },
        { path: 'opacity.12', cssValue: '0.12', type: 'number' },
        { path: 'color.accent.soft', cssValue: soft },
      ],
      [
        { path: 'color.accent.default', cssValue: 'oklch(0.2 0 0)' },
        { path: 'opacity.12', cssValue: '0.2', type: 'number' },
        { path: 'color.accent.soft', cssValue: soft },
      ],
      file,
    );
    expect(fromColor).toContain('`color.accent.default` → `color.accent.soft`');
    expect(fromAlpha).toContain('`opacity.12` → `color.accent.soft`');
    expect(fromColor).toContain('Badge');
    expect(fromAlpha).toContain('Badge');
    const both = markdown(
      [
        { path: 'color.accent.default', cssValue: 'oklch(0.2 0 0)' },
        { path: 'opacity.12', cssValue: '0.12', type: 'number' },
        { path: 'color.accent.soft', cssValue: soft },
      ],
      [
        { path: 'color.accent.default', cssValue: 'oklch(0.3 0 0)' },
        { path: 'opacity.12', cssValue: '0.2', type: 'number' },
        { path: 'color.accent.soft', cssValue: soft },
      ],
      file,
    );
    expect(both).toContain('Badge');
    expect(both).not.toContain('(no component reads this)');
  });

  it('reports an added token with no reader, a removed token still read, and a type-only change', () => {
    const text = markdown(
      [
        { path: 'progress.height', cssValue: '4px', type: 'dimension' },
        { path: 'text.size', cssValue: '1rem', type: 'dimension' },
      ],
      [
        { path: 'color.new', cssValue: 'oklch(0.5 0 0)' },
        { path: 'text.size', cssValue: '1rem', type: 'number' },
      ],
      [
        { path: 'src/components/Progress.module.css', source: '.bar { height: var(--todae-progress-height); }' },
        { path: 'src/components/Field.StepButton.tsx', source: "const size = '--todae-text-size';" },
      ],
    );
    expect(text).toContain('`color.new` (no component reads this).');
    expect(text).toContain('| `text.size` | changed |');
    expect(text).toContain('| Field | `--todae-text-size` | `text.size` |');
    expect(text).toContain('⚠ Removed but still read');
    expect(text).toContain('| `progress.height` | Progress | `--todae-progress-height` |');
    const baseOnly = markdown(
      [{ path: 'progress.height', cssValue: '4px', type: 'dimension' }],
      [],
      [{ path: 'src/components/Progress.module.css', source: '.bar { height: var(--todae-progress-height); }', tree: 'base' }],
    );
    expect(baseOnly).toContain('| Progress | `--todae-progress-height` | `progress.height` |');
    expect(baseOnly).not.toContain('⚠ Removed but still read');
  });

  it('prints a single line when no token value or type changed', () => {
    const row = { path: 'color.fg', type: 'color', cssVar: '--todae-color-fg', cssValue: 'oklch(0.2 0 0)', context: null };
    const base = parseSnapshot({ version: 1, tokens: [{ ...row, description: 'before', layer: 'core' }] });
    const head = parseSnapshot({ version: 1, tokens: [{ ...row, description: 'after', entry: { kind: 'set' } }] });
    expect(renderMarkdown(buildReport({ base, head, files: [] }), { base: 'abc1234aaa', head: 'def5678bbb' })).toBe('No token values changed.');
  });

  it('stops when token references cycle', () => {
    const head = [
      { path: 'a.loop', cssValue: '1px', type: 'dimension' },
      { path: 'b.loop', cssValue: 'var(--todae-a-loop)', type: 'dimension' },
    ];
    const base = [
      { path: 'a.loop', cssValue: 'var(--todae-b-loop)', type: 'dimension' },
      { path: 'b.loop', cssValue: 'var(--todae-a-loop)', type: 'dimension' },
    ];
    const text = markdown(base, head, [{ path: 'src/components/Loader.module.css', source: 'animation: var(--todae-b-loop);' }]);
    expect(text).toContain('`a.loop`');
    expect(text).toContain('Loader');
  });

  it('caps a long read list and keeps every variable in details', () => {
    const names = ['a.one', 'a.two', 'a.three', 'a.four', 'a.five', 'a.six'];
    const rows = names.map((path) => ({ path, cssValue: '1px', type: 'dimension' }));
    const changed = rows.map((row) => ({ ...row, cssValue: '2px' }));
    const source = names.map((path) => `var(${cssVar(path)})`).join(' ');
    const text = markdown(rows, changed, [{ path: 'src/components/Meter.module.css', source }]);
    expect(text).toContain('+1 more');
    expect(text).toContain('<details>');
    expect(text).toContain('`--todae-a-two`');
    expect(text).toContain('Meter');
  });

  it('reads a spaced var, ignores override inputs and tests, and keeps a tsx literal', () => {
    expect(readsOf('src/styles/base.css', 'color: var( --todae-x , fallback);')).toEqual(['--todae-x']);
    expect(readsOf('src/styles/base.css', 'color: var(--_todae-color-accent-default);')).toEqual([]);
    expect(readsOf('src/components/Field.tsx', "const delay = '--todae-field-stepper-repeat-delay';")).toEqual(['--todae-field-stepper-repeat-delay']);
    expect(readsOf('src/components/Field.tsx', 'const delay = "--todae-field-stepper-repeat-delay";')).toEqual(['--todae-field-stepper-repeat-delay']);
    expect(readsOf('src/components/Field.test.tsx', "const delay = '--todae-field-stepper-repeat-delay';")).toEqual([]);
  });

  it('rejects a snapshot that is not version 1 or a row without cssVar', () => {
    expect(() => parseSnapshot({ version: 2, tokens: [] })).toThrow(/version must be 1/);
    expect(() => parseSnapshot({ version: 1, tokens: [{ path: 'color.fg', type: 'color', cssValue: 'oklch(0.2 0 0)', context: null }] })).toThrow(/cssVar/);
  });
});

describe('token-consumers', () => {
  function git(cwd: string, args: string[]): string {
    return execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], {
      cwd,
      env: { ...gitEnv, GIT_EDITOR: 'true', GIT_MERGE_AUTOEDIT: 'no' },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }

  async function repo(): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), 'token-consumers-'));
    roots.push(root);
    git(root, ['init', '-b', 'main']);
    return root;
  }

  async function commit(root: string, height: string, message: string): Promise<string> {
    const file = join(root, catalogPath);
    const sheet = join(root, 'packages', 'design-system', 'src', 'components', 'Progress.module.css');
    await mkdir(join(root, 'packages', 'design-system', 'tokens'), { recursive: true });
    await mkdir(join(root, 'packages', 'design-system', 'src', 'components'), { recursive: true });
    await writeFile(
      file,
      `${JSON.stringify(
        {
          version: 1,
          tokens: [{ path: 'progress.height', type: 'dimension', cssVar: '--todae-progress-height', cssValue: height, context: null }],
        },
        null,
        2,
      )}\n`,
    );
    await writeFile(sheet, `.bar { height: var(--todae-progress-height); }\n`);
    git(root, ['add', '.']);
    git(root, ['commit', '-m', message]);
    return git(root, ['rev-parse', 'HEAD']).trim();
  }

  function run(root: string, args: string[], cwd = root): { status: number; stdout: string; stderr: string } {
    try {
      const stdout = execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings=ExperimentalWarning', script, ...args], {
        cwd,
        encoding: 'utf8',
      });
      return { status: 0, stdout, stderr: '' };
    } catch (error) {
      const status = typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number' ? error.status : 1;
      const stdout = typeof error === 'object' && error !== null && 'stdout' in error && typeof error.stdout === 'string' ? error.stdout : '';
      const stderr = typeof error === 'object' && error !== null && 'stderr' in error && typeof error.stderr === 'string' ? error.stderr : '';
      return { status, stdout, stderr };
    }
  }

  it('writes the component table to the summary, and a bad base still exits 0', async () => {
    const root = await repo();
    const base = await commit(root, '4px', 'base');
    const head = await commit(root, '8px', 'taller progress');
    const summary = join(root, 'summary.md');
    const result = run(root, ['--base', base, '--head', head, '--summary', summary]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('| Progress | `--todae-progress-height` | `progress.height` |');
    expect(await readFile(summary, 'utf8')).toContain('| Component | Reads | Via |');
    const fromPackage = run(root, ['--base', base, '--head', head], join(root, 'packages', 'design-system'));
    expect(fromPackage.status).toBe(0);
    expect(fromPackage.stdout).toContain('| Progress | `--todae-progress-height` | `progress.height` |');
    const missing = run(root, ['--base', 'does-not-exist', '--head', head, '--summary', summary]);
    expect(missing.status).toBe(0);
    expect(missing.stdout).toContain('Token consumer report unavailable:');
    expect(await readFile(summary, 'utf8')).toContain('Token consumer report unavailable:');
  });
});

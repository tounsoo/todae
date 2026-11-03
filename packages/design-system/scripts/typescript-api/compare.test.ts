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
  unionMembers,
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
  it('reports removed and narrowed paths, not added ones', () => {
    const before = snapshot({ Button: '(arg0: ButtonProps) => JSX.Element', 'type ButtonProps.tone?': "'info' | undefined", Gone: 'string' });
    const after = snapshot({ Button: '(arg0: ButtonProps) => JSX.Element', 'type ButtonProps.tone?': "'critical' | undefined", Added: 'number' });
    expect(apiBreaks(before, after)).toEqual([
      { kind: 'removed', entry: '@tounsoo/todae', path: 'Gone', was: 'string' },
      { kind: 'narrowed', entry: '@tounsoo/todae', path: 'type ButtonProps.tone?', was: "'info' | undefined", now: "'critical' | undefined" },
    ]);
  });

  it('counts a whole entry point that disappeared as removals', () => {
    const before: ApiSnapshot = { version: 1, entries: { '@tounsoo/todae/stack': { Stack: 'object' } } };
    expect(apiBreaks(before, { version: 1, entries: {} })).toEqual([
      { kind: 'removed', entry: '@tounsoo/todae/stack', path: 'Stack', was: 'object' },
    ]);
  });
});

describe('unionMembers', () => {
  it('splits only the top-level union', () => {
    expect(unionMembers("'a' | ((value: 'b' | 'c') => void) | { x: 'd' | 'e' } | undefined")).toEqual([
      "'a'",
      "(value: 'b' | 'c') => void",
      "{ x: 'd' | 'e' }",
      'undefined',
    ]);
    expect(unionMembers("'a | b'")).toEqual(["'a | b'"]);
  });

  it('keeps a return type whole, so a function returning a union is one member', () => {
    expect(unionMembers('(arg0: Props) => JSX.Element | null')).toEqual(['(arg0: Props) => JSX.Element | null']);
    expect(unionMembers('((arg0: string) => void) | undefined')).toEqual(['(arg0: string) => void', 'undefined']);
    expect(unionMembers('(A) | (B)')).toEqual(['A', 'B']);
    expect(unionMembers('(a: A) => (B)')).toEqual(['(a: A) => (B)']);
  });

  it('counts a union that lost a member as narrowed, and one that gained a member as widened', () => {
    const before = snapshot({ 'type Tone': "'critical' | 'info' | 'warning'" });
    expect(apiBreaks(before, snapshot({ 'type Tone': "'critical' | 'info'" }))[0]?.kind).toBe('narrowed');
    expect(apiBreaks(before, snapshot({ 'type Tone': "'critical' | 'info' | 'success' | 'warning'" }))[0]?.kind).toBe('widened');
  });
});

describe('apiBreaks kinds', () => {
  const kinds = (before: Record<string, string>, after: Record<string, string>) =>
    apiBreaks(snapshot(before), snapshot(after)).map((item) => [item.kind, item.path]);

  it('counts a change inside a type it cannot read as changed, not widened', () => {
    expect(kinds({ useHotkey: '(arg0: readonly string[] | string) => void' }, { useHotkey: '(arg0: readonly string[]) => void' })).toEqual([
      ['changed', 'useHotkey'],
    ]);
    expect(kinds({ usePopover: '(arg0?: UsePopoverOptions) => R' }, { usePopover: '() => R' })).toEqual([['changed', 'usePopover']]);
    expect(kinds({ 'Button.Root': '(arg0: A) => E & (arg0: B) => E' }, { 'Button.Root': '(arg0: B) => E' })).toEqual([['changed', 'Button.Root']]);
  });

  it('counts a function prop that became optional as widened', () => {
    expect(kinds({ 'type P.children': '(arg0: A) => R' }, { 'type P.children?': '((arg0: A) => R) | undefined' })).toEqual([['widened', 'type P.children']]);
  });

  it('counts a required member added to a type that was there as narrowed, and an optional one as nothing', () => {
    const before = { 'internal Bound': 'object', 'internal Bound.min?': 'number | undefined' };
    expect(kinds(before, { ...before, 'internal Bound.label': 'string' })).toEqual([['narrowed', 'internal Bound.label']]);
    expect(kinds(before, { ...before, 'internal Bound.label?': 'string | undefined' })).toEqual([]);
    expect(kinds(before, { ...before, 'internal Bound.x': 'string' })).toEqual([['narrowed', 'internal Bound.x']]);
    expect(kinds(before, { ...before, 'internal Bound.x?': 'string | undefined' })).toEqual([]);
    expect(kinds({}, { 'type New': 'object', 'type New.label': 'string' })).toEqual([]);
  });

  it('counts a required member the new name of a renamed type has as narrowed', () => {
    const before = { Field: '(arg0: Bound) => E', 'internal Bound': 'object', 'internal Bound.min?': 'number | undefined' };
    const after = { Field: '(arg0: Range) => E', 'internal Range': 'object', 'internal Range.min?': 'number | undefined', 'internal Range.label': 'string' };
    expect(kinds(before, after)).toEqual([
      ['renamed', 'Field'],
      ['renamed', 'internal Bound'],
      ['renamed', 'internal Bound.min?'],
      ['narrowed', 'internal Range.label'],
    ]);
    const existing = { ...before, 'type Range': 'object', 'type Range.min?': 'number | undefined', 'type Range.label': 'string' };
    const swapped = { Field: '(arg0: Range) => E', 'type Range': 'object', 'type Range.min?': 'number | undefined', 'type Range.label': 'string' };
    expect(kinds(existing, swapped)).toContainEqual(['narrowed', 'type Range.label']);
  });

  it('counts a prop that became optional as widened, and one that became required as narrowed', () => {
    expect(kinds({ 'type P.label': 'string' }, { 'type P.label?': 'string | undefined' })).toEqual([['widened', 'type P.label']]);
    expect(kinds({ 'type P.label?': 'string | undefined' }, { 'type P.label': 'string' })).toEqual([['narrowed', 'type P.label?']]);
  });

  it('counts a DOM prop left out as narrowed, one put back as widened, and a new element as changed', () => {
    expect(kinds({ 'type P extends DOMAttributes<HTMLSpanElement>': 'all' }, { 'type P extends DOMAttributes<HTMLSpanElement>': 'except onClick' })).toEqual([
      ['narrowed', 'type P extends DOMAttributes<HTMLSpanElement>'],
    ]);
    expect(kinds({ 'type P extends HTMLAttributes': 'except title' }, { 'type P extends HTMLAttributes': 'all' })).toEqual([
      ['widened', 'type P extends HTMLAttributes'],
    ]);
    expect(kinds({ 'type P extends RefAttributes<HTMLSpanElement>': 'all' }, { 'type P extends RefAttributes<HTMLDivElement>': 'all' })).toEqual([
      ['changed', 'type P extends RefAttributes<HTMLSpanElement>'],
    ]);
    expect(kinds({ 'type P extends InputHTMLAttributes<HTMLInputElement>': 'except size' }, { 'type P extends InputHTMLAttributes': 'except onChange, size' })).toEqual([
      ['narrowed', 'type P extends InputHTMLAttributes<HTMLInputElement>'],
    ]);
  });

  it('counts a union that grows past the member threshold as widened, and one that shrinks under it by what it lost', () => {
    const short = { 'type As': "'a' | 'b'" };
    const long = { 'type As': 'union', "type As | 'a'": 'member', "type As | 'b'": 'member', "type As | 'c'": 'member' };
    expect(kinds(short, long)).toEqual([['widened', 'type As']]);
    expect(kinds(long, short)).toEqual([
      ['narrowed', 'type As'],
      ['removed', "type As | 'c'"],
    ]);
  });
});

describe('apiBreaks for internal types', () => {
  it('counts a renamed internal type as renamed, compares its members under the new name, and a member it lost as removed', () => {
    const before = snapshot({ Close: '(arg0: ActionProps) => null', 'internal ActionProps': 'object', 'internal ActionProps.size?': 'string', 'internal ActionProps.tone?': "'a' | 'b'" });
    const renamed = snapshot({ Close: '(arg0: CloseProps) => null', 'internal CloseProps': 'object', 'internal CloseProps.size?': 'string', 'internal CloseProps.tone?': "'a'" });
    expect(apiBreaks(before, renamed).map((item) => [item.kind, item.path])).toEqual([
      ['renamed', 'Close'],
      ['renamed', 'internal ActionProps'],
      ['renamed', 'internal ActionProps.size?'],
      ['narrowed', 'internal ActionProps.tone?'],
    ]);
    const inlined = snapshot({ Close: '(arg0: { size?: string; }) => null' });
    expect(apiBreaks(before, inlined).map((item) => [item.kind, item.path])).toEqual([
      ['changed', 'Close'],
      ['changed', 'internal ActionProps'],
      ['changed', 'internal ActionProps.size?'],
      ['changed', 'internal ActionProps.tone?'],
    ]);
    const narrowed = snapshot({ Close: '(arg0: ActionProps) => null', 'internal ActionProps': 'object', 'internal ActionProps.tone?': "'a' | 'b'" });
    expect(apiBreaks(before, narrowed).map((item) => [item.kind, item.path])).toEqual([['removed', 'internal ActionProps.size?']]);
  });
});

describe('usersOf', () => {
  it('accepts a changeset that names an export using the broken type', () => {
    const after = snapshot({ Dialog: 'object', 'Dialog.Close': '(arg0: ActionProps) => null', 'internal ActionProps': 'object' });
    const removed = { kind: 'removed', entry: '@tounsoo/todae', path: 'internal ActionProps.size?', was: 'string' } as const;
    const set = { file: 'm.md', bump: 'minor' as const, text: '- `Dialog.Close` no longer takes `size`.' };
    expect(usersOf([after])('ActionProps')).toEqual(new Set(['ActionProps', 'Dialog.Close']));
    expect(unacknowledged([removed], [set], 'minor', usersOf([after]))).toEqual([]);
    expect(unacknowledged([removed], [set], 'minor')).toHaveLength(1);
  });

  it('takes the longest component name a type starts with', () => {
    const after = snapshot({ Chip: '(arg0: ChipProps) => E', ChipList: 'object', 'ChipList.Root': '(arg0: ChipListRootProps) => E', 'type ChipListRootProps': 'object' });
    expect(usersOf([after])('ChipListRootProps')).toEqual(new Set(['ChipListRootProps', 'ChipList.Root', 'ChipList']));
  });

  it('gives a type to the part it is named after, and does not read a part as its whole component', () => {
    const after = snapshot({
      Field: 'object',
      'Field.ColorPicker': '(arg0: FieldColorPickerProps) => E',
      'Field.Label': '(arg0: FieldLabelProps) => E',
      'type FieldColorPickerProps': 'object',
      'type FieldColorPickerProps.onClose?': 'PopoverCloseReason',
    });
    const users = usersOf([after]);
    expect(users('FieldColorPickerProps')).toEqual(new Set(['FieldColorPickerProps', 'Field.ColorPicker']));
    const narrowed = { kind: 'narrowed', entry: '@tounsoo/todae', path: 'type FieldColorPickerProps.onClose?', was: 'a', now: 'b' } as const;
    const label = { file: 'l.md', bump: 'minor' as const, text: '`Field.Label` takes a `size` prop.' };
    expect(unacknowledged([narrowed], [label], 'minor', users)).toHaveLength(1);
    const field = { file: 'f.md', bump: 'minor' as const, text: 'Field: everything changed.' };
    expect(unacknowledged([narrowed], [field], 'minor', users)).toHaveLength(1);
    const picker = { file: 'p.md', bump: 'minor' as const, text: '`Field.ColorPicker` closes with a reason.' };
    expect(unacknowledged([narrowed], [picker], 'minor', users)).toEqual([]);
  });

  it('accepts a type named with one of its members, and the Root part of the component a type is named after', () => {
    const after = snapshot({ Checkbox: 'object', 'Checkbox.Root': '(arg0: CheckboxRootProps) => E', 'type CheckboxRootProps': 'object', 'internal CheckboxProps': 'object' });
    const users = usersOf([after]);
    const member = { kind: 'changed', entry: '@tounsoo/todae', path: 'type CheckboxRootProps.customValidity?', was: 'a', now: 'b' } as const;
    const dotted = { file: 'd.md', bump: 'minor' as const, text: '`CheckboxRootProps.customValidity` accepts null.' };
    expect(unacknowledged([member], [dotted], 'minor', users)).toEqual([]);
    const internal = { kind: 'changed', entry: '@tounsoo/todae', path: 'internal CheckboxProps.customValidity?', was: 'a', now: 'b' } as const;
    const root = { file: 'r.md', bump: 'minor' as const, text: '`Checkbox.Root` customValidity accepts null.' };
    expect(unacknowledged([internal], [root], 'minor', users)).toEqual([]);
  });

  it('does not count a new index signature as a required member', () => {
    const before = snapshot({ 'type P': 'object' });
    const after = snapshot({ 'type P': 'object', 'type P.[`data-${string}`]': 'string | undefined' });
    expect(apiBreaks(before, after)).toEqual([]);
  });

  it('accepts a changed compound part by its dotted name', () => {
    const changed = { kind: 'changed', entry: '@tounsoo/todae', path: 'Button.Root', was: 'a', now: 'b' } as const;
    const set = { file: 'b.md', bump: 'minor' as const, text: '`Button.Root` takes one overload.' };
    expect(unacknowledged([changed], [set], 'minor')).toEqual([]);
  });

  it('accepts the component a type is named after, but not another component with a part that takes it', () => {
    const after = snapshot({ Avatar: 'object', 'Avatar.Root': '(arg0: AvatarRootProps) => E', 'Message.Avatar': '(arg0: AvatarRootProps) => E', Message: 'object', 'type AvatarRootProps': 'object' });
    const users = usersOf([after]);
    expect(users('AvatarRootProps')).toEqual(new Set(['AvatarRootProps', 'Avatar.Root', 'Message.Avatar', 'Avatar']));
    const removed = { kind: 'removed', entry: '@tounsoo/todae', path: 'type AvatarRootProps.tone?', was: 'string' } as const;
    const message = { file: 'm.md', bump: 'minor' as const, text: 'Message: the header wraps on narrow screens.' };
    expect(unacknowledged([removed], [message], 'minor', users)).toHaveLength(1);
    const avatar = { file: 'a.md', bump: 'minor' as const, text: 'Avatar drops `tone`.' };
    expect(unacknowledged([removed], [avatar], 'minor', users)).toEqual([]);
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

  it('reads a bump with a comment after it or a byte order mark before the file', () => {
    expect(parseChangeset('a.md', "\uFEFF---\n'@tounsoo/todae': minor # breaking\n---\n\nx\n", '@tounsoo/todae').bump).toBe('minor');
  });

  it('gives an empty changeset no bump', () => {
    expect(parseChangeset('.changeset/b.md', '---\n---\n\nGone\n', '@tounsoo/todae').bump).toBeNull();
  });
});

describe('unacknowledged', () => {
  const removed = { kind: 'removed', entry: '@tounsoo/todae', path: 'type GoneProps.size?', was: 'string' } as const;
  const changed = { kind: 'changed', entry: '@tounsoo/todae', path: 'type ToneProps.tone?', was: 'a', now: 'b' } as const;

  it('needs the breaking bump for anything but a rename, a widening too, each naming the export', () => {
    const widened = { ...changed, kind: 'widened' } as const;
    const patch = { file: 'p.md', bump: 'patch' as const, text: 'Widens `ToneProps` and drops `GoneProps.size`.' };
    expect(unacknowledged([removed, widened], [patch], 'minor')).toEqual([
      { name: 'GoneProps', needs: 'minor', breaks: [removed] },
      { name: 'ToneProps', needs: 'minor', breaks: [widened] },
    ]);
    const minor = { file: 'm.md', bump: 'minor' as const, text: '- `GoneProps` loses `size`; set the size with CSS. `ToneProps` takes more tones.' };
    expect(unacknowledged([removed, widened], [patch, minor], 'minor')).toEqual([]);
  });

  it('accepts the old name of a renamed type', () => {
    const renamed = { kind: 'renamed', entry: '@tounsoo/todae', path: 'Close', was: '(arg0: ActionProps) => null', now: '(arg0: CloseProps) => null', from: ['ActionProps'] } as const;
    const patch = { file: 'p.md', bump: 'patch' as const, text: 'Renames the internal `ActionProps`.' };
    expect(unacknowledged([renamed], [patch], 'minor')).toEqual([]);
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

/** Runs the check from the package directory, as CI does. */
function check(root: string, base: string, head: string): { ok: boolean; output: string } {
  try {
    const output = execFileSync(
      process.execPath,
      ['--experimental-strip-types', '--no-warnings=ExperimentalWarning', script, '--base', base, '--head', head],
      { cwd: join(root, 'packages/design-system'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
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

  it('does not count an old changeset renamed on the branch as added', async () => {
    const root = await repo({ Gone: 'string' });
    await commit(root, { Gone: 'string' }, 'old changeset', { '.changeset/old.md': "---\n'@tounsoo/todae': minor\n---\n\nRemoves `Gone` from the old plan.\n" });
    git(root, ['checkout', '-b', 'branch']);
    git(root, ['mv', '.changeset/old.md', '.changeset/new.md']);
    const head = await commit(root, {}, 'remove Gone and rename the changeset');
    expect(check(root, 'main', head).ok).toBe(false);
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

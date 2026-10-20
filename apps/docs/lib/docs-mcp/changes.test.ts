import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compareVersions, getChanges, parseChangelog, type Release } from './changes';

const CHANGELOG = `# @tounsoo/todae

## 1.0.1

### Patch Changes

- Fix the thing ([#12](https://github.com/tounsoo/todae/pull/12))

## 1.0.0

### Major Changes

- Rename \`Foo.Root\` to \`Bar.Root\`. ([#11](https://github.com/tounsoo/todae/pull/11))
  - Replace \`Foo.Root\` with \`Bar.Root\`.

### Minor Changes

- Add \`Baz.Root\` ([\`abc1234\`](https://github.com/tounsoo/todae/commit/abc1234))

## 0.2.0

### Minor Changes

- [#10](https://github.com/tounsoo/todae/pull/10) [\`e231e63\`](https://github.com/tounsoo/todae/commit/e231e63) Thanks [@tounsoo](https://github.com/tounsoo)! - Breaking:

  - First break.
  - Second break.

### Patch Changes

- [#9](https://github.com/tounsoo/todae/pull/9) [\`d4e5b1b\`](https://github.com/tounsoo/todae/commit/d4e5b1b) Thanks [@tounsoo](https://github.com/tounsoo)! - A fix.

## 0.1.0

### Minor Changes

- First release ([#1](https://github.com/tounsoo/todae/pull/1))
`;

describe('get_changes', () => {
  const all = parseChangelog(CHANGELOG);

  it('reads both entry formats and marks breaking changes by section and version', () => {
    expect(all.map((release) => release.version)).toEqual(['0.1.0', '0.2.0', '1.0.0', '1.0.1']);
    const [, v020, v100, v101] = all as [Release, Release, Release, Release];
    expect(v020.breaking).toEqual([{ text: 'Breaking:\n\n- First break.\n- Second break.', pullRequest: 10 }]);
    expect(v020.other).toEqual([{ text: 'A fix.', pullRequest: 9 }]);
    expect(v100.breaking).toEqual([
      { text: 'Rename `Foo.Root` to `Bar.Root`.\n- Replace `Foo.Root` with `Bar.Root`.', pullRequest: 11 },
    ]);
    // A minor bump after 1.0 is not breaking, and a commit ref names no pull request.
    expect(v100.other).toEqual([{ text: 'Add `Baz.Root`' }]);
    expect(v101).toEqual({ version: '1.0.1', breaking: [], other: [{ text: 'Fix the thing', pullRequest: 12 }] });
  });

  it('returns the releases after from, up to to, oldest first', () => {
    const result = getChanges({ from: '0.1.0' }, all);
    expect(result).toMatchObject({ from: '0.1.0', to: '1.0.1', latest: '1.0.1', breakingCount: 2 });
    expect(result.releases.map((release) => release.version)).toEqual(['0.2.0', '1.0.0', '1.0.1']);
    expect(getChanges({ from: '0.1.5', to: '1.0.0' }, all).releases.map((release) => release.version)).toEqual([
      '0.2.0',
      '1.0.0',
    ]);
    expect(getChanges({ from: '1.0.1' }, all).releases).toEqual([]);
  });

  it('refuses a version that is not a release or not a version', () => {
    expect(() => getChanges({ from: '0.1.0', to: '0.3.0' }, all)).toThrow('No release 0.3.0. The latest is 1.0.1.');
    expect(() => getChanges({ from: 'latest' }, all)).toThrow('Not a version: "latest"');
    expect(() => parseChangelog('## next\n')).toThrow('Unreadable changelog heading');
  });

  it('refuses a from after to, or after the latest release', () => {
    expect(() => getChanges({ from: '9.9.9' }, all)).toThrow('from 9.9.9 is after the latest release, 1.0.1');
    expect(() => getChanges({ from: '1.0.1', to: '0.2.0' }, all)).toThrow('from 1.0.1 is after to, 0.2.0');
  });

  it('orders versions by number, and has no prereleases', () => {
    expect(compareVersions('0.10.0', '0.9.0')).toBeGreaterThan(0);
    expect(() => compareVersions('1.0.0-next.1', '1.0.0')).toThrow('Not a version');
    expect(() => parseChangelog('## 1.0.0-next.1\n')).toThrow('Unreadable changelog heading');
  });

  it('refuses lines it cannot place rather than dropping them', () => {
    expect(() => parseChangelog('## 1.0.0\n\n- An entry before any section\n')).toThrow('outside a release');
    expect(() => parseChangelog('## 1.0.0\n\n### Other Changes\n\n- Entry\n')).toThrow('Unreadable changelog line');
    expect(() => parseChangelog('## 1.0.0\n\n### Patch Changes\n\n- Entry\nstray text\n')).toThrow(
      'Unreadable changelog line "stray text"',
    );
  });

  it('keeps an issue link that ends a summary in the text', () => {
    const [release] = parseChangelog(
      '## 1.0.0\n\n### Patch Changes\n\n- Fix the thing ([#5](https://github.com/tounsoo/todae/issues/5))\n',
    );
    expect(release?.other).toEqual([{ text: 'Fix the thing ([#5](https://github.com/tounsoo/todae/issues/5))' }]);
  });

  it('reads what the changelog generator writes with the repository config', async () => {
    const config = JSON.parse(readFileSync(join(process.cwd(), '../../.changeset/config.json'), 'utf8'));
    const [name, options] = config.changelog;
    // The parser's REF_RE reads a pull request or commit link at the end of the first line, where this template puts {ref}.
    expect(options.template).toBe('\n\n- {summary} {ref}');
    const { default: generator } = await import(/* @vite-ignore */ name);
    const line = await generator.getReleaseLine(
      { id: 'x', summary: 'Rename `Foo.Root`.\n\n- Replace `Foo.Root` with `Bar.Root`.', releases: [] },
      'major',
      options,
    );
    const [release] = parseChangelog(`## 1.0.0\n\n### Major Changes\n${line}\n`);
    expect(release?.breaking).toEqual([{ text: 'Rename `Foo.Root`.\n\n- Replace `Foo.Root` with `Bar.Root`.' }]);
  });

  it("reads Todae's own changelog, whose latest release is the package version", async () => {
    const { version } = (await import('../../../../packages/design-system/package.json')).default;
    const result = getChanges({ from: '0.0.0' });
    expect(result.latest).toBe(version);
    expect(result.releases.every((release) => release.breaking.concat(release.other).every((row) => row.text))).toBe(true);
  });
});

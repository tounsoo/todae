import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cssVarOf, parseSnapshot, type ConsumerFile, type Snapshot } from './consumers.ts';
import {
  addedLine,
  collectViolations,
  deadTokens,
  hint,
  isConsumerPath,
  nameViolations,
  parseGrandfather,
  parseSchema,
  ratchet,
  staleLine,
  tallyLine,
  type Schema,
  type Violation,
} from './names.ts';

const pkgRoot = join(import.meta.dirname, '../..');

function schema(): Schema {
  return parseSchema({
    version: 1,
    states: ['default', 'hover', 'active', 'pressed', 'focus', 'disabled'],
    statefulProperties: ['bg', 'border', 'color', 'decoration', 'fg', 'leading', 'ring', 'shadow'],
  });
}

function snap(rows: { path: string; cssValue: string; layer?: 'core' | 'appearance' | 'density' | 'contract' }[]): Snapshot {
  return parseSnapshot({
    version: 1,
    tokens: rows.map((row) => ({
      path: row.path,
      type: 'color',
      cssVar: `--todae-${row.path.replaceAll('.', '-')}`,
      cssValue: row.cssValue,
      context: null,
      layer: row.layer ?? 'contract',
    })),
  });
}

function file(path: string, source: string): ConsumerFile {
  return { path, source };
}

describe('name schema', () => {
  const rules = schema();

  it('accepts a state, a variant before the property, and a part that is not stateful', () => {
    expect(nameViolations('button.bg.hover', rules)).toEqual([]);
    expect(nameViolations('chip.warning.fg', rules)).toEqual([]);
    expect(nameViolations('button.icon.size', rules)).toEqual([]);
  });

  it('flags an unknown state, a name that is too deep, and a name that is both', () => {
    expect(nameViolations('button.bg.selected', rules)).toEqual([{ rule: 'state', path: 'button.bg.selected', word: 'selected' }]);
    expect(nameViolations('text.h3.font.size', rules)).toEqual([{ rule: 'depth', path: 'text.h3.font.size' }]);
    expect(nameViolations('table.sort.icon.fg.selected', rules)).toEqual([
      { rule: 'depth', path: 'table.sort.icon.fg.selected' },
      { rule: 'state', path: 'table.sort.icon.fg.selected', word: 'selected' },
    ]);
  });

  it('does not name-check core, appearance, or density paths', () => {
    const snapshot = snap([
      { path: 'color.extra.deep.token.name', cssValue: 'red', layer: 'core' },
      { path: 'color.accent.default', cssValue: 'red', layer: 'appearance' },
      { path: 'space.7', cssValue: '1.75rem', layer: 'density' },
      { path: 'button.bg.selected', cssValue: 'red', layer: 'contract' },
    ]);
    const names = collectViolations(snapshot, rules, []).filter((violation) => violation.rule !== 'dead');
    expect(names).toEqual([{ rule: 'state', path: 'button.bg.selected', word: 'selected' }]);
  });

  it('rejects a state outside the six', () => {
    expect(() => parseSchema({ version: 1, states: ['selected'], statefulProperties: ['bg'] })).toThrow(/selected/);
  });
});

describe('dead tokens', () => {
  it('is dead when nothing reads it, a test reads it, or only a dead token reads it', () => {
    const alone = snap([{ path: 'widget.bg', cssValue: 'red' }]);
    const cssVar = cssVarOf('--todae-widget-bg');
    expect(deadTokens(alone, [])).toEqual([{ rule: 'dead', path: 'widget.bg', cssVar }]);
    expect(deadTokens(alone, [file('src/components/Widget.test.tsx', "const bg = '--todae-widget-bg';")])).toEqual([
      { rule: 'dead', path: 'widget.bg', cssVar },
    ]);
    const chain = snap([
      { path: 'color.orphan.source', cssValue: 'red', layer: 'core' },
      { path: 'color.orphan.user', cssValue: 'var(--todae-color-orphan-source)', layer: 'core' },
    ]);
    expect(deadTokens(chain, []).map((violation) => violation.path)).toEqual(['color.orphan.source', 'color.orphan.user']);
  });

  it('is live when a stylesheet, a tsx literal, or an alias to a read token reads it', () => {
    const widget = snap([{ path: 'widget.bg', cssValue: 'red' }]);
    expect(deadTokens(widget, [file('src/components/Widget.module.css', '.w { background: var(--todae-widget-bg); }')])).toEqual([]);
    expect(deadTokens(widget, [file('src/components/Widget.tsx', "const bg = '--todae-widget-bg';")])).toEqual([]);
    const aliased = snap([
      { path: 'color.accent.default', cssValue: 'oklch(0.6 0.1 250)', layer: 'appearance' },
      { path: 'progress.fill', cssValue: 'var(--todae-color-accent-default)', layer: 'contract' },
    ]);
    expect(deadTokens(aliased, [file('src/components/Progress.module.css', '.bar { background: var(--todae-progress-fill); }')])).toEqual([]);
  });

  it('keeps a button pack token live when its consume var is read', () => {
    const pack = snap([{ path: 'button.primary.bg.default', cssValue: 'oklch(0.5 0.1 250)' }]);
    expect(deadTokens(pack, [])).toEqual([
      { rule: 'dead', path: 'button.primary.bg.default', cssVar: cssVarOf('--todae-button-primary-bg-default') },
    ]);
    expect(deadTokens(pack, [file('src/components/Button.module.css', '.btn { background: var(--todae-button-bg-default); }')])).toEqual([]);
  });
});

describe('grandfather ratchet', () => {
  const depth: Violation = { rule: 'depth', path: 'text.h3.font.size' };
  const state: Violation = { rule: 'state', path: 'option.bg.selected', word: 'selected' };

  it('fails an unlisted name with the hint, a fixed name with the remove line, and a new entry against the base', () => {
    const unlisted = ratchet({ found: [state], list: parseGrandfather({ version: 1, entries: [] }) });
    expect(unlisted.unlisted).toEqual([state]);
    expect(hint(state)).toBe(
      'option.bg.selected: unknown state "selected". States are default, hover, active, pressed, focus, disabled. Rename to one of them, or if "selected" is a variant, move it before the property (e.g. option.selected.bg).',
    );
    const stale = ratchet({ found: [], list: parseGrandfather({ version: 1, entries: [depth] }) });
    expect(stale.stale).toEqual([depth]);
    expect(staleLine(depth)).toBe('grandfathered name text.h3.font.size (depth) is fixed; remove it from tokens/name-grandfather.json');
    const added = ratchet({
      found: [depth],
      list: parseGrandfather({ version: 1, entries: [depth] }),
      base: parseGrandfather({ version: 1, entries: [] }),
    });
    expect(added.added).toEqual([depth]);
    expect(addedLine(depth)).toBe('grandfather list can only shrink; text.h3.font.size (depth) is new. Fix the name instead (see hint)');
  });

  it('skips the shrink check when the base list is missing and when no base was passed', () => {
    const list = parseGrandfather({ version: 1, entries: [depth] });
    const missing = ratchet({ found: [], list, base: 'missing' });
    expect(missing.added).toEqual([]);
    expect(missing.note).toBe('no grandfather list at base; skipping shrink check');
    expect(ratchet({ found: [], list }).added).toEqual([]);
    expect(ratchet({ found: [], list }).note).toBeNull();
  });

  it('rejects an unsorted list, a duplicate, and an unknown rule', () => {
    expect(() =>
      parseGrandfather({
        version: 1,
        entries: [
          { rule: 'state', path: 'option.bg.selected', word: 'selected' },
          { rule: 'depth', path: 'button.base.font.size' },
        ],
      }),
    ).toThrow(/not sorted/);
    expect(() =>
      parseGrandfather({
        version: 1,
        entries: [
          { rule: 'depth', path: 'button.base.font.size' },
          { rule: 'depth', path: 'button.base.font.size' },
        ],
      }),
    ).toThrow(/repeats/);
    expect(() => parseGrandfather({ version: 1, entries: [{ rule: 'nope', path: 'button.bg' }] })).toThrow(/unknown/);
  });

  it('uses the hint for each rule', () => {
    expect(hint({ rule: 'state', path: 'button.bg.selected', word: 'selected' })).toBe(
      'button.bg.selected: unknown state "selected". States are default, hover, active, pressed, focus, disabled. Rename to one of them, or if "selected" is a variant, move it before the property (e.g. option.selected.bg).',
    );
    expect(hint({ rule: 'depth', path: 'text.h3.font.size' })).toBe(
      'text.h3.font.size: too deep. Names are component.(part.)property(.state); fold the extra segment into the part or property (e.g. text.h3-font.size).',
    );
    expect(hint({ rule: 'dead', path: 'color.accent.soft', cssVar: cssVarOf('--todae-color-accent-soft') })).toBe(
      'color.accent.soft (--todae-color-accent-soft): no CSS var() or src string reads this token, directly or through an alias. Read it from a component stylesheet or don\'t add it.',
    );
  });
});

describe('main baseline', () => {
  it('matches the grandfathered name and dead counts on this repo', () => {
    const snapshot = parseSnapshot(JSON.parse(readFileSync(join(pkgRoot, 'tokens/tokens.generated.json'), 'utf8')) as unknown);
    const rules = parseSchema(JSON.parse(readFileSync(join(pkgRoot, 'tokens/name-schema.json'), 'utf8')) as unknown);
    const listed = execFileSync('git', ['ls-files', '-z', '--', 'src'], { cwd: pkgRoot, encoding: 'utf8' })
      .split('\0')
      .filter((path) => isConsumerPath(path));
    const files = listed.map((path) => ({ path, source: readFileSync(join(pkgRoot, path), 'utf8') }));
    const found = collectViolations(snapshot, rules, files);
    const names = found.filter((violation) => violation.rule !== 'dead');
    const dead = found.filter((violation) => violation.rule === 'dead');
    const contract = new Set([...snapshot.values()].filter((row) => row.layer === 'contract').map((row) => row.path));
    expect(names.filter((violation) => violation.rule === 'depth')).toHaveLength(167);
    expect(names.filter((violation) => violation.rule === 'state')).toHaveLength(61);
    expect(new Set(names.map((violation) => violation.path)).size).toBe(197);
    expect(dead.map((violation) => violation.path)).toEqual([
      'color.bg.canvas',
      'color.gray.50',
      'color.red.400',
      'color.red.500',
      'space.7',
    ]);
    expect(dead.filter((violation) => contract.has(violation.path))).toEqual([]);
    const list = parseGrandfather(JSON.parse(readFileSync(join(pkgRoot, 'tokens/name-grandfather.json'), 'utf8')) as unknown);
    const result = ratchet({ found, list });
    expect(result.unlisted).toEqual([]);
    expect(result.stale).toEqual([]);
    expect(list.size).toBe(233);
    expect(tallyLine(found, result.unlisted)).toBe('names: 197 grandfathered, 0 new; dead: 5 grandfathered, 0 new');
  });
});

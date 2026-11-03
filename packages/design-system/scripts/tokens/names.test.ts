import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildTokensGraph } from './build.ts';
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

function schema(slots: Record<string, string[]> = {}): Schema {
  return parseSchema(
    {
      version: 1,
      states: ['default', 'hover', 'active', 'pressed', 'focus', 'disabled'],
      statefulProperties: ['bg', 'border', 'color', 'decoration', 'fg', 'leading', 'ring', 'shadow'],
    },
    slots,
  );
}

function snap(rows: { path: string; cssValue: string; layer?: 'core' | 'appearance' | 'density' | 'contract'; alias?: string }[]): Snapshot {
  return parseSnapshot({
    version: 1,
    tokens: rows.map((row) => ({
      path: row.path,
      type: 'color',
      cssVar: `--todae-${row.path.replaceAll('.', '-')}`,
      cssValue: row.cssValue,
      context: null,
      layer: row.layer ?? 'contract',
      ...(row.alias ? { entry: { kind: 'modifier', name: 'buttonVariant', context: row.alias } } : {}),
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

  it('accepts two parts before the property and flags a third', () => {
    expect(nameViolations('text.h3.font.size', rules)).toEqual([]);
    expect(nameViolations('form.summary.link.fg.hover', rules)).toEqual([]);
    expect(nameViolations('steps.marker.progress.dot.size', rules)).toEqual([{ rule: 'depth', path: 'steps.marker.progress.dot.size' }]);
  });

  it('flags a state no slot declares, and a name that is too deep as well', () => {
    expect(nameViolations('button.bg.selected', rules)).toEqual([{ rule: 'state', path: 'button.bg.selected', word: 'selected' }]);
    expect(nameViolations('table.sort.cell.icon.fg.selected', rules)).toEqual([
      { rule: 'depth', path: 'table.sort.cell.icon.fg.selected' },
      { rule: 'state', path: 'table.sort.cell.icon.fg.selected', word: 'selected' },
    ]);
  });

  it('accepts the words a component lists in its slot for that property, and only there', () => {
    const declared = schema({ 'option.bg': ['default', 'selected'], 'button.*.fg': ['default', 'current'] });
    expect(nameViolations('option.bg.selected', declared)).toEqual([]);
    expect(nameViolations('table.sort.icon.fg.selected', schema({ 'table.sort.icon.fg': ['default', 'selected'] }))).toEqual([]);
    expect(nameViolations('button.primary.fg.current', declared)).toEqual([]);
    expect(nameViolations('option.fg.selected', declared)).toEqual([{ rule: 'state', path: 'option.fg.selected', word: 'selected' }]);
    expect(nameViolations('tree.bg.selected', declared)).toEqual([{ rule: 'state', path: 'tree.bg.selected', word: 'selected' }]);
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

  it('takes its shared states from the schema file, not a fixed list', () => {
    const custom = parseSchema({ version: 1, states: ['default', 'selected'], statefulProperties: ['bg'] });
    expect(nameViolations('option.bg.selected', custom)).toEqual([]);
    expect(nameViolations('option.bg.hover', custom)).toEqual([{ rule: 'state', path: 'option.bg.hover', word: 'hover' }]);
    expect(() => parseSchema({ version: 1, states: ['Selected'], statefulProperties: ['bg'] })).toThrow(/Selected/);
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
    const pack = snap([{ path: 'button.primary.bg.default', cssValue: 'oklch(0.5 0.1 250)', alias: 'primary' }]);
    expect(deadTokens(pack, [])).toEqual([
      { rule: 'dead', path: 'button.primary.bg.default', cssVar: cssVarOf('--todae-button-primary-bg-default') },
    ]);
    expect(deadTokens(pack, [file('src/components/Button.module.css', '.btn { background: var(--todae-button-bg-default); }')])).toEqual([]);
  });
});

describe('grandfather ratchet', () => {
  const depth: Violation = { rule: 'depth', path: 'steps.marker.progress.dot.size' };
  const state: Violation = { rule: 'state', path: 'option.bg.selected', word: 'selected' };

  it('fails an unlisted name with the hint, a fixed name with the remove line, and a new entry against the base', () => {
    const unlisted = ratchet({ found: [state], list: parseGrandfather({ version: 1, entries: [] }) });
    expect(unlisted.unlisted).toEqual([state]);
    expect(hint(state, schema())).toBe(
      'option.bg.selected: unknown state "selected". Every stateful property takes default, hover, active, pressed, focus, disabled. For a state of this component, list "selected" with the rest of option.bg\'s states in its slots in tokens/resolver.json; if "selected" is a variant, move it before the property (e.g. option.selected.bg).',
    );
    const stale = ratchet({ found: [], list: parseGrandfather({ version: 1, entries: [depth] }) });
    expect(stale.stale).toEqual([depth]);
    expect(staleLine(depth)).toBe('grandfathered name steps.marker.progress.dot.size (depth) is fixed; remove it from tokens/name-grandfather.json');
    const added = ratchet({
      found: [depth],
      list: parseGrandfather({ version: 1, entries: [depth] }),
      base: parseGrandfather({ version: 1, entries: [] }),
    });
    expect(added.added).toEqual([depth]);
    expect(addedLine(depth)).toBe('grandfather list can only shrink; steps.marker.progress.dot.size (depth) is new. Fix the name instead (see hint)');
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
    const states = parseSchema({ version: 1, states: ['default', 'selected'], statefulProperties: ['bg'] });
    expect(hint({ rule: 'state', path: 'button.bg.current', word: 'current' }, states)).toBe(
      'button.bg.current: unknown state "current". Every stateful property takes default, selected. For a state of this component, list "current" with the rest of button.bg\'s states in its slots in tokens/resolver.json; if "current" is a variant, move it before the property (e.g. option.selected.bg).',
    );
    expect(hint({ rule: 'depth', path: 'steps.marker.progress.dot.size' }, states)).toBe(
      'steps.marker.progress.dot.size: too deep. Names are component.(part.(part.))property(.state); fold an extra segment into a part or the property (e.g. text.h3-font.size).',
    );
    expect(hint({ rule: 'dead', path: 'color.accent.soft', cssVar: cssVarOf('--todae-color-accent-soft') }, states)).toBe(
      'color.accent.soft (--todae-color-accent-soft): no CSS var() or src string reads this token, directly or through an alias. Read it from a component stylesheet or don\'t add it.',
    );
  });
});

describe('main baseline', () => {
  it('matches the grandfathered name and dead counts on this repo', async () => {
    const graph = await buildTokensGraph(join(pkgRoot, 'tokens'));
    const snapshot = parseSnapshot(JSON.parse(graph.json) as unknown);
    const rules = parseSchema(JSON.parse(readFileSync(join(pkgRoot, 'tokens/name-schema.json'), 'utf8')) as unknown, graph.slots);
    const listed = execFileSync('git', ['ls-files', '-z', '--', 'src'], { cwd: pkgRoot, encoding: 'utf8' })
      .split('\0')
      .filter((path) => isConsumerPath(path));
    const files = listed.map((path) => ({ path, source: readFileSync(join(pkgRoot, path), 'utf8') }));
    const found = collectViolations(snapshot, rules, files);
    const names = found.filter((violation) => violation.rule !== 'dead');
    const dead = found.filter((violation) => violation.rule === 'dead');
    const contract = new Set([...snapshot.values()].filter((row) => row.layer === 'contract').map((row) => row.path));
    expect(names.filter((violation) => violation.rule === 'state')).toEqual([]);
    expect(names.map((violation) => violation.path)).toEqual([
      'form.summary.title.font.weight',
      'message.actions.motion.easing.enter',
      'message.actions.motion.easing.exit',
      'nav.group.label.font.size',
      'nav.group.label.font.weight',
      'steps.marker.progress.dot.color',
      'steps.marker.progress.dot.size',
    ]);
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
    expect(list.size).toBe(12);
    expect(tallyLine(found, result.unlisted)).toBe('names: 7 grandfathered, 0 new; dead: 5 grandfathered, 0 new');
  });
});

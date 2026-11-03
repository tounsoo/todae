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
  formatGrandfather,
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
      version: 2,
      states: ['default', 'hover', 'active', 'pressed', 'focus', 'disabled'],
      statefulProperties: {
        bg: 'color',
        border: 'color',
        color: 'color',
        decoration: 'color',
        'decoration-thickness': 'dimension',
        fg: 'color',
        leading: 'number',
        ring: 'color',
        shadow: 'shadow',
      },
    },
    slots,
  );
}

function snap(
  rows: { path: string; cssValue: string; type?: string; layer?: 'core' | 'appearance' | 'density' | 'contract'; alias?: string }[],
): Snapshot {
  return parseSnapshot({
    version: 1,
    tokens: rows.map((row) => ({
      path: row.path,
      type: row.type ?? 'color',
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
    expect(nameViolations('button.bg.hover', 'color', rules)).toEqual([]);
    expect(nameViolations('chip.warning.fg', 'color', rules)).toEqual([]);
    expect(nameViolations('button.icon.size', 'dimension', rules)).toEqual([]);
  });

  it('accepts three parts before the property and flags a fourth', () => {
    expect(nameViolations('text.h3.font.size', 'dimension', rules)).toEqual([]);
    expect(nameViolations('form.summary.link.fg.hover', 'color', rules)).toEqual([]);
    expect(nameViolations('steps.marker.progress.dot.size', 'dimension', rules)).toEqual([]);
    expect(nameViolations('steps.marker.progress.dot.halo.size', 'dimension', rules)).toEqual([{ rule: 'depth', path: 'steps.marker.progress.dot.halo.size' }]);
  });

  it('flags a state no slot declares, and a name that is too deep as well', () => {
    expect(nameViolations('button.bg.selected', 'color', rules)).toEqual([{ rule: 'state', path: 'button.bg.selected', word: 'selected' }]);
    expect(nameViolations('table.sort.cell.icon.mark.fg.selected', 'color', rules)).toEqual([
      { rule: 'depth', path: 'table.sort.cell.icon.mark.fg.selected' },
      { rule: 'state', path: 'table.sort.cell.icon.mark.fg.selected', word: 'selected' },
    ]);
  });

  it('ends a name at its state', () => {
    const declared = schema({ 'option.bg': ['default', 'selected'] });
    expect(nameViolations('chip.bg.hover.extra', 'color', declared)).toEqual([{ rule: 'depth', path: 'chip.bg.hover.extra' }]);
    expect(nameViolations('option.bg.selected.a.b', 'color', declared)).toEqual([{ rule: 'depth', path: 'option.bg.selected.a.b' }]);
    expect(nameViolations('chip.bg.muted.size', 'dimension', declared)).toEqual([
      { rule: 'depth', path: 'chip.bg.muted.size' },
      { rule: 'state', path: 'chip.bg.muted.size', word: 'muted' },
    ]);
    expect(hint({ rule: 'state', path: 'chip.bg.muted.size', word: 'muted' }, declared)).toContain('the rest of chip.bg\'s states');
    expect(hint({ rule: 'depth', path: 'chip.bg.hover.extra' }, declared)).toBe(
      'chip.bg.hover.extra: a name ends at its state, and "hover" follows chip.bg. Move what comes after it before the property (e.g. tabs.selected.bg.hover), or fold it into one word.',
    );
  });

  it('accepts the words a component lists in its slot for that property, and only there', () => {
    const declared = schema({ 'option.bg': ['default', 'selected'], 'button.*.fg': ['default', 'current'] });
    expect(nameViolations('option.bg.selected', 'color', declared)).toEqual([]);
    expect(nameViolations('table.sort.icon.fg.selected', 'color', schema({ 'table.sort.icon.fg': ['default', 'selected'] }))).toEqual([]);
    expect(nameViolations('button.primary.fg.current', 'color', declared)).toEqual([]);
    expect(nameViolations('option.fg.selected', 'color', declared)).toEqual([{ rule: 'state', path: 'option.fg.selected', word: 'selected' }]);
    expect(nameViolations('tree.bg.selected', 'color', declared)).toEqual([{ rule: 'state', path: 'tree.bg.selected', word: 'selected' }]);
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

  it('fails a sub-property after a stateful property, even when a slot lists it', () => {
    const listed = schema({
      'link.decoration': ['default', 'thickness'],
      'focus.ring': ['color', 'width'],
      'link.decoration-thickness': ['default', 'current'],
    });
    expect(nameViolations('link.decoration.thickness', 'dimension', listed)).toEqual([
      { rule: 'property', path: 'link.decoration.thickness', word: 'thickness' },
    ]);
    expect(nameViolations('focus.ring.width', 'dimension', listed)).toEqual([{ rule: 'property', path: 'focus.ring.width', word: 'width' }]);
    expect(nameViolations('focus.ring.color', 'color', listed)).toEqual([{ rule: 'property', path: 'focus.ring.color', word: 'color' }]);
    expect(nameViolations('disclosure.ring.radius', 'dimension', schema())).toEqual([
      { rule: 'property', path: 'disclosure.ring.radius', word: 'radius' },
    ]);
    expect(hint({ rule: 'property', path: 'focus.ring.width', word: 'width' }, listed)).toBe(
      'focus.ring.width: "width" is not a state of focus.ring, whose states are color values of ring. Join a sub-property to its property with a hyphen (e.g. focus.ring-width, link.decoration-offset); if "width" is a part, move it before the property (e.g. field.placeholder.fg).',
    );
  });

  it('accepts a sub-property joined to its property, and a role of the same type as its property', () => {
    const listed = schema({ 'link.decoration-thickness': ['default', 'current'], 'field.fg': ['default', 'placeholder'] });
    expect(nameViolations('focus.ring', 'color', listed)).toEqual([]);
    expect(nameViolations('focus.ring-width', 'dimension', listed)).toEqual([]);
    expect(nameViolations('link.decoration-offset', 'dimension', listed)).toEqual([]);
    expect(nameViolations('link.decoration-thickness.current', 'dimension', listed)).toEqual([]);
    expect(nameViolations('field.fg.placeholder', 'color', listed)).toEqual([]);
    expect(nameViolations('text.leading.default', 'number', listed)).toEqual([]);
    expect(nameViolations('link.decoration-thickness.wide', 'dimension', listed)).toEqual([
      { rule: 'state', path: 'link.decoration-thickness.wide', word: 'wide' },
    ]);
  });

  it('reads each token\'s type from the snapshot', () => {
    const snapshot = snap([
      { path: 'link.decoration.default', cssValue: 'red' },
      { path: 'link.decoration.offset', cssValue: '3px', type: 'dimension' },
    ]);
    const names = collectViolations(snapshot, schema({ 'link.decoration': ['default', 'offset'] }), []).filter(
      (violation) => violation.rule !== 'dead',
    );
    expect(names).toEqual([{ rule: 'property', path: 'link.decoration.offset', word: 'offset' }]);
  });

  it('takes its shared states from the schema file, not a fixed list', () => {
    const custom = parseSchema({ version: 2, states: ['default', 'selected'], statefulProperties: { bg: 'color' } });
    expect(nameViolations('option.bg.selected', 'color', custom)).toEqual([]);
    expect(nameViolations('option.bg.hover', 'color', custom)).toEqual([{ rule: 'state', path: 'option.bg.hover', word: 'hover' }]);
    expect(() => parseSchema({ version: 2, states: ['Selected'], statefulProperties: { bg: 'color' } })).toThrow(/Selected/);
    expect(() => parseSchema({ version: 1, states: ['default'], statefulProperties: ['bg'] })).toThrow(/version must be 2/);
    expect(() => parseSchema({ version: 2, states: ['default'], statefulProperties: ['bg'] })).toThrow(/\$type/);
    expect(() => parseSchema({ version: 2, states: ['default'], statefulProperties: { bg: '' } })).toThrow(/\$type/);
    expect(() => parseSchema({ version: 2, states: ['focus'], statefulProperties: { focus: 'color' } })).toThrow(/both a state and a property/);
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

  it('keeps an unread step of a scale while another step of it is read, outside the contract layer', () => {
    const scales = snap([
      { path: 'color.red.400', cssValue: 'red', layer: 'core' },
      { path: 'color.red.600', cssValue: 'darkred', layer: 'core' },
      { path: 'color.teal.400', cssValue: 'teal', layer: 'core' },
      { path: 'space.7', cssValue: '1.75rem', layer: 'density' },
      { path: 'space.8', cssValue: '2rem', layer: 'density' },
      { path: 'widget.bg.default', cssValue: 'red' },
      { path: 'widget.bg.hover', cssValue: 'red' },
    ]);
    const css = file('src/components/Widget.module.css', '.w { color: var(--todae-color-red-600); gap: var(--todae-space-8); background: var(--todae-widget-bg-default); }');
    expect(deadTokens(scales, [css]).map((violation) => violation.path)).toEqual(['color.teal.400', 'widget.bg.hover']);
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
  const depth: Violation = { rule: 'depth', path: 'steps.marker.progress.dot.halo.size' };
  const state: Violation = { rule: 'state', path: 'option.bg.selected', word: 'selected' };

  it('fails an unlisted name with the hint, a fixed name with the remove line, and a new entry against the base', () => {
    const unlisted = ratchet({ found: [state], list: parseGrandfather({ version: 1, entries: [] }) });
    expect(unlisted.unlisted).toEqual([state]);
    expect(hint(state, schema())).toBe(
      'option.bg.selected: unknown state "selected". Every stateful property takes default, hover, active, pressed, focus, disabled. For a state of this component, list "selected" with the rest of option.bg\'s states in its slots in tokens/resolver.json; if "selected" is a variant, move it before the property (e.g. option.selected.bg).',
    );
    const stale = ratchet({ found: [], list: parseGrandfather({ version: 1, entries: [depth] }) });
    expect(stale.stale).toEqual([depth]);
    expect(staleLine(depth)).toBe('grandfathered name steps.marker.progress.dot.halo.size (depth) is fixed; remove it from tokens/name-grandfather.json');
    const added = ratchet({
      found: [depth],
      list: parseGrandfather({ version: 1, entries: [depth] }),
      base: parseGrandfather({ version: 1, entries: [] }),
    });
    expect(added.added).toEqual([depth]);
    expect(addedLine(depth)).toBe('grandfather list can only shrink; steps.marker.progress.dot.halo.size (depth) is new. Fix the name instead (see hint)');
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
    expect(() => parseGrandfather({ version: 1, entries: [{ rule: 'property', path: 'link.decoration.offset' }] })).toThrow(/needs a word/);
  });

  it('round-trips a sub-property entry and matches it by word', () => {
    const property: Violation = { rule: 'property', path: 'link.decoration.offset', word: 'offset' };
    const list = parseGrandfather(JSON.parse(formatGrandfather([property])) as unknown);
    expect([...list.values()]).toEqual([property]);
    expect(ratchet({ found: [property], list }).unlisted).toEqual([]);
    expect(ratchet({ found: [{ ...property, word: 'other' }], list }).unlisted).toHaveLength(1);
  });

  it('uses the hint for each rule', () => {
    const states = parseSchema({ version: 2, states: ['default', 'selected'], statefulProperties: { bg: 'color' } });
    expect(hint({ rule: 'state', path: 'button.bg.current', word: 'current' }, states)).toBe(
      'button.bg.current: unknown state "current". Every stateful property takes default, selected. For a state of this component, list "current" with the rest of button.bg\'s states in its slots in tokens/resolver.json; if "current" is a variant, move it before the property (e.g. option.selected.bg).',
    );
    expect(hint({ rule: 'depth', path: 'steps.marker.progress.dot.halo.size' }, states)).toBe(
      'steps.marker.progress.dot.halo.size: too deep. Names are a component, up to three parts, the property and an optional state; fold an extra segment into a part or the property (e.g. text.h3-font.size).',
    );
    expect(hint({ rule: 'dead', path: 'color.accent.soft', cssVar: cssVarOf('--todae-color-accent-soft') }, states)).toBe(
      'color.accent.soft (--todae-color-accent-soft): no CSS var() or src string reads this token, directly or through an alias. Read it from a component stylesheet or don\'t add it.',
    );
  });
});

describe('main baseline', () => {
  it('finds no bad name and no dead token on this repo, so the grandfather list is empty', async () => {
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
    expect(names).toEqual([]);
    expect(dead).toEqual([]);
    const list = parseGrandfather(JSON.parse(readFileSync(join(pkgRoot, 'tokens/name-grandfather.json'), 'utf8')) as unknown);
    const result = ratchet({ found, list });
    expect(result.unlisted).toEqual([]);
    expect(result.stale).toEqual([]);
    expect(list.size).toBe(0);
    expect(tallyLine(found, result.unlisted)).toBe('names: 0 grandfathered, 0 new; dead: 0 grandfathered, 0 new');
  });
});

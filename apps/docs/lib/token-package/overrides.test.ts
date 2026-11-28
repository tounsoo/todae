import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { THEME_OVERRIDE_KEYS, themeOverrideType } from '@tounsoo/todae';
import catalog from '@tounsoo/todae/tokens.json';
import { describe, expect, it } from 'vitest';
import { PRESETS } from '../../components/playground/presets';
import { parseCatalogValue } from '../../components/playground/tokenPackage';
import { buildTokenFiles, todaeTokensDir } from '../docs-mcp/build';
import { overridesPackage, type CatalogRow } from './overrides';
import { TODAE_ENTRIES, entryFile, tokenPackage } from './package';

const rows = (catalog as { tokens: CatalogRow[] }).tokens;
const parse = parseCatalogValue;

function exportOf(light: Record<string, unknown>, dark: Record<string, unknown>, name = 'acme') {
  return overridesPackage({ name, light, dark, catalog: rows, parse });
}

function parsed(files: Record<string, string>, path: string): Record<string, unknown> {
  const text = files[path];
  if (text === undefined) throw new Error(`missing ${path}`);
  return JSON.parse(text) as Record<string, unknown>;
}

function at(tree: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], tree);
}

describe('TODAE_ENTRIES', () => {
  it("matches Todae's resolver: its sets and modifiers, their order and their extensions", () => {
    const resolver = JSON.parse(readFileSync(join(todaeTokensDir(), 'resolver.json'), 'utf8')) as {
      sets: Record<string, { $extensions: { 'dev.todae': Record<string, unknown> } }>;
      modifiers: Record<string, { $extensions: { 'dev.todae': Record<string, unknown> } }>;
      resolutionOrder: { $ref: string }[];
    };
    const order = resolver.resolutionOrder.map(({ $ref }) => $ref);
    expect(TODAE_ENTRIES.map(({ kind, name }) => `#/${kind}s/${name}`)).toEqual(order);
    for (const { kind, name, extension } of TODAE_ENTRIES) {
      const todae = (kind === 'set' ? resolver.sets : resolver.modifiers)[name]?.$extensions['dev.todae'] ?? {};
      // A company entry carries Todae's own keys, minus Todae's checks and slots.
      for (const [key, value] of Object.entries(extension)) {
        if (Array.isArray(value)) expect(todae[key], `${name}.${key}`).toEqual(expect.arrayContaining(value));
        else expect(todae[key], `${name}.${key}`).toEqual(value);
      }
      expect(extension.layer).toBe(todae.layer);
    }
  });
});

describe('tokenPackage', () => {
  it('lays files out as Fernway does and wires each into the resolver in order', () => {
    const files = tokenPackage({
      name: 'acme',
      tokens: [
        { path: 'button.soft.bg.default', type: 'color', value: { colorSpace: 'oklch', components: [0.9, 0.05, 150] }, entry: { kind: 'modifier', name: 'buttonVariant', context: 'soft' } },
        { path: 'radius.md', type: 'dimension', value: { value: 0.625, unit: 'rem' }, entry: { kind: 'set', name: 'core' } },
        { path: 'card.shadow', type: 'shadow', value: { $ref: '#/shadow/none/$value' }, entry: { kind: 'set', name: 'contract' } },
        { path: 'button.base.radius', type: 'dimension', value: { $ref: '#/radius/full/$value' }, entry: { kind: 'set', name: 'button' } },
        { path: 'color.accent.default', type: 'color', value: { colorSpace: 'oklch', components: [0.5, 0.1, 150] }, entry: { kind: 'modifier', name: 'appearance', context: 'light' } },
      ],
    });
    expect(Object.keys(files)).toEqual(['resolver.json', 'core.json', 'appearance/light.json', 'button.json', 'button.soft.json', 'contract.json']);
    const resolver = parsed(files, 'resolver.json');
    expect(resolver.resolutionOrder).toEqual([
      { $ref: '#/sets/core' },
      { $ref: '#/modifiers/appearance' },
      { $ref: '#/sets/button' },
      { $ref: '#/modifiers/buttonVariant' },
      { $ref: '#/sets/contract' },
    ]);
    expect(at(resolver, 'sets.core.sources')).toEqual([{ $ref: './core.json' }]);
    expect(at(resolver, 'modifiers.buttonVariant.contexts')).toEqual({ soft: [{ $ref: './button.soft.json' }] });
    expect(at(parsed(files, 'core.json'), 'radius.md')).toEqual({ $type: 'dimension', $value: { value: 0.625, unit: 'rem' } });
    expect(entryFile({ kind: 'modifier', name: 'density', context: 'roomy' })).toBe('density/roomy.json');
  });
});

describe('overridesPackage', () => {
  it('builds every Playground preset, or fails only on contrast the preset itself sets', async () => {
    const built: string[] = [];
    for (const preset of PRESETS) {
      const { files, skipped, unsplit } = exportOf(preset.light, preset.dark, preset.id);
      expect(skipped, preset.id).toEqual([]);
      expect(unsplit, preset.id).toEqual([]);
      const result = await buildTokenFiles(files);
      // A preset may miss an APCA pair the Playground does not check, such as Anvil's selected option.
      if (result.ok) built.push(preset.id);
      else expect(result.error, preset.id).toMatch(/^contrast: \d+ pair\(s\) fail APCA/);
    }
    expect(built).toEqual(expect.arrayContaining(['graphite', 'porcelain', 'acid', 'bloom', 'riso', 'y2k-chrome']));
  }, 120_000);

  it('follows a core token that differs by appearance through the tokens that alias it', () => {
    const { files, split, unsplit } = exportOf(
      { 'color.gray.900': { colorSpace: 'oklch', components: [0.19, 0.01, 65] } },
      { 'color.gray.900': { colorSpace: 'oklch', components: [0.2, 0.03, 300] } },
    );
    expect(split).toEqual(['color.gray.900']);
    expect(unsplit).toEqual([]);
    expect(at(parsed(files, 'core.json'), 'color.gray.900.$value')).toEqual({ colorSpace: 'oklch', components: [0.19, 0.01, 65] });
    expect(at(parsed(files, 'appearance/dark.json'), 'acme.color.gray.900.$value')).toEqual({ colorSpace: 'oklch', components: [0.2, 0.03, 300] });
    const readers = rows.filter((row) => row.ref === 'color.gray.900' && row.context === 'dark' && row.cssValue === 'var(--todae-color-gray-900)');
    expect(readers.length).toBeGreaterThan(0);
    for (const reader of readers) {
      expect(at(parsed(files, 'appearance/dark.json'), `${reader.path}.$value`), reader.path).toEqual({ $ref: '#/acme/color/gray/900/$value' });
    }
    // A relative color keeps its own alpha and reads the split token's channels.
    expect(at(parsed(files, 'appearance/dark.json'), 'color.bg.transparent.$value')).toEqual({
      colorSpace: 'oklch',
      components: [0, 1, 2].map((index) => ({ $ref: `#/acme/color/gray/900/$value/components/${index}` })),
      alpha: 0,
    });
  });

  it("keeps a preset's translucent scrim translucent when its grays split", () => {
    const riso = PRESETS.find((preset) => preset.id === 'riso');
    if (!riso) throw new Error('no Riso preset');
    const { files } = exportOf(riso.light, riso.dark, 'riso');
    for (const side of ['light', 'dark']) {
      const scrim = at(parsed(files, `appearance/${side}.json`), 'color.bg.scrim.$value') as { alpha?: unknown } | undefined;
      expect(scrim?.alpha, side).toMatchObject({ $ref: expect.stringMatching(/^#\/opacity\//) });
    }
    expect((at(parsed(files, 'appearance/dark.json'), 'color.bg.transparent.$value') as { alpha?: unknown }).alpha).toBe(0);
  });

  it('builds an edit made in one appearance only, wherever Todae declares the token', async () => {
    const edits: [string, unknown][] = [
      ['field.error.motion.duration.enter', { value: 300, unit: 'ms' }],
      ['button.base.padding.x', { value: 2, unit: 'rem' }],
      ['button.primary.ring.focus', { colorSpace: 'oklch', components: [0.5, 0.2, 250] }],
      ['space.control.x', { value: 1, unit: 'rem' }],
      ['space.1', { value: 0.5, unit: 'rem' }],
      ['motion.duration.fast', { value: 90, unit: 'ms' }],
    ];
    for (const [path, value] of edits) {
      const { files } = exportOf({ [path]: value }, {});
      const built = await buildTokenFiles(files);
      expect(built.ok ? '' : built.error, path).toBe('');
    }
  }, 120_000);

  it('follows a split opacity through the alpha of the colors that read it', async () => {
    const { files, unsplit } = exportOf({}, { 'opacity.70': 0.85, 'color.gray.950': { colorSpace: 'oklch', components: [0.15, 0.03, 300] } });
    expect(unsplit).toEqual([]);
    expect(at(parsed(files, 'appearance/dark.json'), 'color.bg.scrim.$value')).toEqual({
      colorSpace: 'oklch',
      components: [0, 1, 2].map((index) => ({ $ref: `#/acme/color/gray/950/$value/components/${index}` })),
      alpha: { $ref: '#/acme/opacity/70/$value' },
    });
    const built = await buildTokenFiles(files);
    expect(built.ok ? '' : built.error).toBe('');
  }, 60_000);

  it('reads a px default back, so a one-sided px edit splits', () => {
    const { split, unsplit } = exportOf({ 'border.width': { value: 2, unit: 'px' } }, {});
    expect(split).toEqual(['border.width']);
    expect(unsplit).toEqual([]);
  });

  it('gives a one-sided contract edit the split core value in the other appearance', async () => {
    const { files } = exportOf(
      { 'radius.md': { value: 0.25, unit: 'rem' }, 'button.base.radius': { value: 2, unit: 'rem' } },
      { 'radius.md': { value: 1, unit: 'rem' } },
    );
    expect(at(parsed(files, 'appearance/dark.json'), 'acme.button.base.radius.$value')).toEqual({ $ref: '#/acme/radius/md/$value' });
    const built = await buildTokenFiles(files);
    expect(built.ok ? '' : built.error).toBe('');
  }, 60_000);

  it('carries every motion token the Playground can set, with no list of its own', async () => {
    // Motion tokens are read from the override keys, so tokens added later are covered too.
    const motion = THEME_OVERRIDE_KEYS.filter((key) => key.includes('motion') || ['duration', 'cubicBezier'].includes(themeOverrideType(key)));
    expect(motion.length).toBeGreaterThan(10);
    const overrides: Record<string, unknown> = {};
    for (const key of motion) {
      const type = themeOverrideType(key);
      if (type === 'duration') overrides[key] = { value: 240, unit: 'ms' };
      else if (type === 'cubicBezier') overrides[key] = [0.2, 0, 0, 1];
      else overrides[key] = parse(key, rows.find((row) => row.path === key)?.cssValue ?? '');
    }
    for (const key of Object.keys(overrides)) if (overrides[key] === null) delete overrides[key];
    const { files, skipped } = exportOf(overrides, overrides);
    expect(skipped).toEqual([]);
    const trees = Object.fromEntries(Object.entries(files).map(([path, text]) => [path, JSON.parse(text) as unknown]));
    for (const key of Object.keys(overrides)) {
      const row = rows.find((candidate) => candidate.path === key);
      if (!row) throw new Error(key);
      const file = row.entry.kind === 'set' ? `${row.entry.name}.json` : entryFile({ kind: 'modifier', name: row.entry.name, context: row.entry.context ?? row.context ?? '' });
      expect(at(trees[file], key), key).toEqual({ $type: row.type, $value: overrides[key] });
    }
    const built = await buildTokenFiles(files);
    expect(built.ok ? '' : built.error).toBe('');
    if (built.ok) expect(built.css).toContain('--todae-motion-duration-fast: 240ms');
  }, 60_000);

  it('splits a set token whose light and dark values differ into appearance tokens of its own', async () => {
    const ink = { colorSpace: 'oklch', components: [0.2, 0.02, 120] };
    const { files, split } = exportOf({ 'button.primary.border.default': ink, 'radius.md': { value: 1, unit: 'rem' } }, { 'radius.md': { value: 1, unit: 'rem' } });
    expect(split).toEqual(['button.primary.border.default']);
    expect(at(parsed(files, 'button.primary.json'), 'button.primary.border.default')).toEqual({
      $type: 'color',
      $value: { $ref: '#/acme/button/primary/border/default/$value' },
    });
    expect(at(parsed(files, 'appearance/light.json'), 'acme.button.primary.border.default.$value')).toEqual(ink);
    // Dark had no override, so it keeps what Todae sets.
    const todae = rows.find((row) => row.path === 'button.primary.border.default');
    expect(at(parsed(files, 'appearance/dark.json'), 'acme.button.primary.border.default.$value')).toEqual({
      $ref: `#/${(todae?.ref ?? '').split('.').join('/')}/$value`,
    });
    expect(at(parsed(files, 'core.json'), 'radius.md.$value')).toEqual({ value: 1, unit: 'rem' });
    const built = await buildTokenFiles(files);
    expect(built.ok ? '' : built.error).toBe('');
  }, 60_000);

  it('puts a density token in each density, and skips keys the catalog lacks', () => {
    const row = rows.find((candidate) => candidate.entry.name === 'density');
    if (!row) throw new Error('no density token');
    const value = parse(row.path, row.cssValue);
    const { files, skipped } = exportOf({ [row.path]: value, 'nope.token': 1 }, { [row.path]: value });
    expect(skipped).toEqual(['nope.token']);
    const contexts = rows.filter((candidate) => candidate.path === row.path).map((candidate) => candidate.context);
    expect(contexts.length).toBe(3);
    for (const context of contexts) expect(at(parsed(files, `density/${context}.json`), `${row.path}.$value`)).toEqual(value);
  });

  it('lists a one-sided override whose Todae value it cannot read back, instead of hiding it', () => {
    const { split, unsplit, files } = overridesPackage({
      name: 'acme',
      light: { 'radius.md': { value: 1, unit: 'rem' } },
      dark: {},
      catalog: rows,
      parse: () => null,
    });
    expect(split).toEqual([]);
    expect(unsplit).toEqual(['radius.md']);
    expect(at(parsed(files, 'core.json'), 'radius.md.$value')).toEqual({ value: 1, unit: 'rem' });
  });

  it('exports nothing but a resolver for no overrides', () => {
    expect(Object.keys(exportOf({}, {}).files)).toEqual(['resolver.json']);
  });
});

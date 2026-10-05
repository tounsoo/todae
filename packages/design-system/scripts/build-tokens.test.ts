import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  PATH_RE,
  buildTokensGraph,
  catalogSelectors,
  flattenTokens,
  pathToPointer,
  parseExtension,
  pointerToPath,
  serializeValue,
  validateDensitySpaceOnly,
  validateInteractive,
  validateParity,
  validatePaths,
  validateRefs,
  validateFieldChipSlots,
  validatePaintPacks,
  type FlatToken,
  type TokenNode,
} from './build-tokens';

const color = (ref: string): TokenNode => ({ $type: 'color', $value: { $ref: pathToPointer(ref) } });

function tokenMap(tree: Record<string, TokenNode>): Map<string, TokenNode> {
  return new Map(Object.entries(tree));
}

describe('build-tokens validations', () => {
  it('accepts lowercase paths and rejects others', () => {
    expect(PATH_RE.test('color.gray.50')).toBe(true);
    expect(PATH_RE.test('color.on-accent')).toBe(true);
    expect(PATH_RE.test('color.fg.onAccent')).toBe(false);
    expect(() => validatePaths(['Color.Gray.50'], 'core')).toThrow(/lowercase/);
    expect(() => validatePaths(['hue.primary'], 'core')).toThrow(/hue/);
  });

  it('requires light/dark parity', () => {
    const light = tokenMap({ 'color.bg.canvas': color('color.gray.50') });
    const dark = tokenMap({ 'color.bg.canvas': color('color.gray.900'), 'color.fg.default': color('color.gray.50') });
    expect(() => validateParity(light, dark)).toThrow(/light\/dark/);
  });

  it('requires density tokens under space.*', () => {
    expect(() => validateDensitySpaceOnly(tokenMap({ 'color.bg.canvas': color('color.gray.50') }), 'density')).toThrow(
      /space\.\*/,
    );
  });

  it('requires chip and field slot packs', () => {
    expect(() =>
      validateFieldChipSlots(
        flattenTokens({
          chip: { bg: { default: color('color.bg.subtle') } },
        }),
        'contract',
      ),
    ).toThrow(/default\|hover\|focus\|disabled/);
    expect(() =>
      validateFieldChipSlots(
        flattenTokens({
          field: { border: { default: color('color.border.default'), invalid: color('color.danger.default') } },
        }),
        'contract',
      ),
    ).toThrow(/default\|hover\|focus\|disabled\|invalid/);
  });

  it('requires interactive slots and ring.focus only', () => {
    expect(() =>
      validateInteractive(
        flattenTokens({
          button: { primary: { bg: { default: color('color.accent.default') } } },
        }),
        'contract',
      ),
    ).toThrow(/default\|hover\|active\|focus\|disabled/);
    expect(() =>
      validateInteractive(
        flattenTokens({
          button: {
            primary: { ring: { default: color('color.accent.default'), focus: color('color.accent.default') } },
          },
        }),
        'contract',
      ),
    ).toThrow(/ring\.focus only/);
    expect(() =>
      validateInteractive(
        flattenTokens({
          button: { bg: { default: color('color.accent.default') } },
        }),
        'contract',
      ),
    ).toThrow(/button\.primary\|secondary\|ghost/);
  });

  it('requires paint packs to match primary keys', () => {
    const primary = flattenTokens({
      button: { primary: { bg: { default: color('color.accent.default') } } },
    });
    const secondary = flattenTokens({
      button: { secondary: { bg: { default: color('color.bg.surface') } } },
    });
    const ghost = flattenTokens({
      button: { ghost: { fg: { default: color('color.fg.default') } } },
    });
    expect(() => validatePaintPacks({ primary, secondary, ghost })).toThrow(/ghost/);
  });

  it('rejects same-or-higher-layer refs and cycles', () => {
    const tokens: FlatToken[] = [
      {
        path: 'color.bg.canvas',
        type: 'color',
        value: { $ref: '#/button/bg/default/$value' },
        ref: 'button.bg.default',
        cssVar: '--todae-color-bg-canvas',
        cssValue: 'var(--todae-button-bg-default)',
        layer: 'appearance',
        context: 'light',
      },
      {
        path: 'button.bg.default',
        type: 'color',
        value: { $ref: '#/color/bg/canvas/$value' },
        ref: 'color.bg.canvas',
        cssVar: '--todae-button-bg-default',
        cssValue: 'var(--todae-color-bg-canvas)',
        layer: 'contract',
      },
    ];
    const known = new Map<FlatToken['path'], FlatToken['layer']>([
      ['color.bg.canvas', 'appearance'],
      ['button.bg.default', 'contract'],
    ]);
    expect(() => validateRefs(tokens, known)).toThrow(/lower layer/);
  });

  it('parses DTCG JSON Pointer aliases to token paths', () => {
    expect(pointerToPath('#/color/gray/50/$value', 'test')).toBe('color.gray.50');
    expect(pointerToPath('#/color/on-accent/$value', 'test')).toBe('color.on-accent');
    expect(pathToPointer('color.gray.50')).toBe('#/color/gray/50/$value');
  });

  it('rejects the old dot form and unsupported pointers', () => {
    expect(() => pointerToPath('color.gray.50', 'test')).toThrow(/JSON Pointer.*write "#\/color\/gray\/50\/\$value"/);
    expect(() => pointerToPath('#/color/gray/50', 'test')).toThrow(/\/\$value/);
    expect(() => pointerToPath('#/color/gray/50/$value/components/0', 'test')).toThrow(/\/\$value/);
    expect(() => pointerToPath('#/color/gray/50/$value/$value', 'test')).toThrow(/whole-value/);
    expect(() => pointerToPath('#/color/gray.50/$value', 'test')).toThrow(/lowercase segments/);
    expect(() => pointerToPath('#/color//50/$value', 'test')).toThrow(/lowercase segments/);
    expect(() => pointerToPath('#/Color/Gray/$value', 'test')).toThrow(/lowercase segments/);
    expect(() => pointerToPath('#/$value', 'test')).toThrow(/lowercase segments/);
    expect(() =>
      serializeValue({ $type: 'color', $value: { $ref: 'color.accent.default' } }, 'button.bg.default'),
    ).toThrow(/Token "button\.bg\.default" \$ref "color\.accent\.default" must be a JSON Pointer/);
  });

  it('emits var chains, not resolved literals', () => {
    const serialized = serializeValue(
      { $type: 'color', $value: { $ref: '#/color/accent/default/$value' } },
      'button.bg.default',
    );
    expect(serialized.ref).toBe('color.accent.default');
    expect(serialized.cssValue).toBe('var(--todae-color-accent-default)');
    expect(serialized.cssValue).not.toMatch(/oklch\(/);
  });
});

describe('committed token graph', () => {
  it('writes every source alias as a JSON Pointer and keeps dot paths in the catalog', async () => {
    const graph = await buildTokensGraph(join(import.meta.dirname, '../tokens'));
    const aliases = graph.tokens.filter((t) => t.ref !== null);
    expect(aliases.length).toBeGreaterThan(0);
    for (const token of aliases) {
      expect((token.value as { $ref: string }).$ref).toBe(pathToPointer(token.ref!));
      expect(token.ref).toMatch(PATH_RE);
    }
  });

  it('builds and snapshots CSS selectors', async () => {
    const graph = await buildTokensGraph(join(import.meta.dirname, '../tokens'));
    expect(graph.css).toContain('@layer todae.base');
    expect(graph.css).toContain(':root,\n[data-appearance="light"]');
    expect(graph.css).toContain('[data-appearance],\n[data-density]');
    expect(graph.css).toContain('[data-button-variant="primary"]');
    expect(graph.css).toContain('[data-button-variant="ghost"]');
    expect(graph.tokens.some((t) => t.layer === 'contract' && t.cssValue.startsWith('var('))).toBe(true);
    expect(catalogSelectors(graph.css)).toMatchSnapshot();
  });

  it('loads field and chip contracts through danger and chip density chains', async () => {
    const graph = await buildTokensGraph(join(import.meta.dirname, '../tokens'));
    expect(graph.tokens.find((t) => t.path === 'field.leading')?.cssValue).toBe(
      'var(--todae-font-leading-default)',
    );
    const light = graph.css.slice(
      graph.css.indexOf(':root,\n[data-appearance="light"]'),
      graph.css.indexOf('[data-appearance="dark"]'),
    );
    const dark = graph.css.slice(
      graph.css.indexOf('[data-appearance="dark"]'),
      graph.css.indexOf('[data-density="compact"]'),
    );
    expect(light).toContain('color-scheme: light;');
    expect(light).not.toContain('color-scheme: dark');
    expect(dark).toContain('color-scheme: dark;');
    expect(dark).not.toContain('color-scheme: light');
    const invalid = graph.tokens.find((t) => t.path === 'field.border.invalid');
    const pad = graph.tokens.find((t) => t.path === 'chip.padding.x');
    expect(invalid?.cssValue).toBe('var(--todae-color-danger-default)');
    expect(pad?.cssValue).toBe('var(--todae-space-chip-x)');
    for (const context of ['light', 'dark'] as const) {
      expect(
        graph.tokens.some((t) => t.layer === 'appearance' && t.context === context && t.path === 'color.danger.default'),
      ).toBe(true);
    }
    expect(graph.tokens.some((t) => t.path === 'field.radius')).toBe(true);
    expect(graph.tokens.some((t) => t.path === 'field.label.fg')).toBe(true);
    expect(graph.tokens.find((t) => t.path === 'field.label.fg')?.cssValue).toBe('var(--todae-color-fg-default)');
    const labelGap = graph.tokens.find((t) => t.path === 'field.label.gap');
    expect(labelGap?.cssValue).toBe('0.4rem');
    expect(labelGap?.ref).toBeNull();
    expect(labelGap?.layer).toBe('contract');
    const messagesGap = graph.tokens.find((t) => t.path === 'field.messages.gap');
    expect(messagesGap?.cssValue).toBe('0.2rem');
    expect(messagesGap?.ref).toBeNull();
    expect(messagesGap?.layer).toBe('contract');
    expect(graph.tokens.some((t) => t.path === 'chip.bg.default')).toBe(true);
    expect(graph.tokens.find((t) => t.path === 'field.description.fg')?.cssValue).toBe(
      'var(--todae-color-fg-muted)',
    );
    expect(graph.tokens.find((t) => t.path === 'field.error.fg')?.cssValue).toBe(
      'var(--todae-color-danger-default)',
    );
    expect(graph.tokens.find((t) => t.path === 'selection.size')?.cssValue).toBe(
      'var(--todae-space-selection-size)',
    );
    expect(graph.tokens.find((t) => t.path === 'selection.indicator.fg')?.cssValue).toBe(
      'var(--todae-color-on-accent)',
    );
    expect(graph.tokens.find((t) => t.path === 'tooltip.bg')?.cssValue).toBe(
      'var(--todae-color-bg-elevated)',
    );
    expect(graph.tokens.find((t) => t.path === 'tooltip.max-width')?.cssValue).toBe('16rem');
    expect(graph.tokens.find((t) => t.path === 'tooltip.padding.y')?.cssValue).toBe(
      'var(--todae-space-1)',
    );
  });

  it('emits distinct accent hover and active var chains', async () => {
    const graph = await buildTokensGraph(join(import.meta.dirname, '../tokens'));
    for (const context of ['light', 'dark'] as const) {
      const accent = Object.fromEntries(
        (['default', 'hover', 'active'] as const).map((slot) => {
          const path = `color.accent.${slot}`;
          const token = graph.tokens.find((t) => t.layer === 'appearance' && t.context === context && t.path === path);
          expect(token, path).toBeDefined();
          return [slot, token!.cssValue];
        }),
      );
      expect(accent.hover).toMatch(/^var\(--todae-color-/);
      expect(accent.active).toMatch(/^var\(--todae-color-/);
      expect(accent.hover).not.toBe(accent.default);
      expect(accent.active).not.toBe(accent.default);
      expect(accent.hover).not.toBe(accent.active);
    }
    const buttonHover = graph.tokens.find((t) => t.path === 'button.primary.bg.hover');
    const buttonActive = graph.tokens.find((t) => t.path === 'button.primary.bg.active');
    const buttonFg = graph.tokens.find((t) => t.path === 'button.primary.fg.default');
    expect(buttonHover?.cssValue).toBe('var(--todae-color-accent-hover)');
    expect(buttonActive?.cssValue).toBe('var(--todae-color-accent-active)');
    expect(buttonFg?.cssValue).toBe('var(--todae-color-on-accent)');
    expect(graph.css).toContain('--todae-button-bg-hover: var(--todae-button-primary-bg-hover)');
    expect(graph.css).toContain('--todae-button-bg-active: var(--todae-button-primary-bg-active)');
    expect(graph.css).toContain('--todae-button-radius: var(--todae-button-base-radius)');
  });
});

describe('resolver-driven build', () => {
  const tokensDir = join(import.meta.dirname, '../tokens');
  const temps: string[] = [];

  afterEach(async () => {
    await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  type Resolver = {
    sets: Record<string, Record<string, unknown>>;
    modifiers: Record<string, { default: string; contexts: Record<string, unknown[]>; [key: string]: unknown }>;
    resolutionOrder: unknown[];
  };

  async function fixture(edit: (resolver: Resolver, root: string) => Promise<void> | void): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), 'todae-tokens-'));
    temps.push(root);
    await cp(tokensDir, root, { recursive: true });
    const resolver = JSON.parse(await readFile(join(root, 'resolver.json'), 'utf8')) as Resolver;
    await edit(resolver, root);
    await writeFile(join(root, 'resolver.json'), JSON.stringify(resolver));
    return root;
  }

  it('takes density and button variant names from the resolver contexts', async () => {
    const root = await fixture(async (resolver, dir) => {
      const roomy = await readFile(join(dir, 'density/spacious.json'), 'utf8');
      await writeFile(join(dir, 'density/roomy.json'), roomy);
      const outline = (await readFile(join(dir, 'components/button.secondary.json'), 'utf8')).replace(
        '"secondary"',
        '"outline"',
      );
      await writeFile(join(dir, 'components/button.outline.json'), outline);
      resolver.modifiers.density!.contexts.roomy = [{ $ref: './density/roomy.json' }];
      resolver.modifiers.buttonVariant!.contexts.outline = [{ $ref: './components/button.outline.json' }];
    });
    const graph = await buildTokensGraph(root);
    expect(catalogSelectors(graph.css)).toContain('[data-density="roomy"]');
    expect(catalogSelectors(graph.css)).toContain('[data-button-variant="outline"]');
    expect(graph.css).toContain('--todae-button-bg-default: var(--todae-button-outline-bg-default)');
    expect(graph.tokens.find((t) => t.path === 'button.outline.bg.default')).toMatchObject({
      layer: 'contract',
      context: 'outline',
    });
  });

  it('merges sources in order, accepting inline token trees', async () => {
    const root = await fixture((resolver) => {
      (resolver.sets.contract!.sources as unknown[]).push({
        tooltip: { 'max-width': { $type: 'dimension', $value: { value: 20, unit: 'rem' } } },
      });
    });
    const graph = await buildTokensGraph(root);
    expect(graph.tokens.filter((t) => t.path === 'tooltip.max-width')).toHaveLength(1);
    expect(graph.tokens.find((t) => t.path === 'tooltip.max-width')?.cssValue).toBe('20rem');
  });

  it('validates slot completeness after merging, so a later source can override part of a group', async () => {
    const root = await fixture((resolver) => {
      (resolver.sets.button!.sources as unknown[]).push({
        button: { base: { radius: { $type: 'dimension', $value: { value: 2, unit: 'px' } } } },
      });
      (resolver.sets.contract!.sources as unknown[]).push({
        field: { border: { hover: { $type: 'color', $value: { $ref: '#/color/accent/default/$value' } } } },
      });
    });
    const graph = await buildTokensGraph(root);
    expect(graph.tokens.find((t) => t.path === 'button.base.radius')?.cssValue).toBe('2px');
    expect(graph.tokens.find((t) => t.path === 'field.border.hover')?.cssValue).toBe('var(--todae-color-accent-default)');
  });

  it('emits consume aliases for sets declared on :root', async () => {
    const root = await fixture((resolver) => {
      const px = (value: number) => ({ $type: 'dimension', $value: { value, unit: 'px' } });
      resolver.sets.button!.sources = [
        {
          button: {
            base: {
              radius: px(4),
              padding: { x: px(12), y: px(6) },
              font: { size: px(14), weight: { $type: 'fontWeight', $value: 500 } },
              gap: px(8),
            },
          },
        },
      ];
      resolver.resolutionOrder = [
        { $ref: '#/sets/core' },
        { $ref: '#/sets/button' },
        { $ref: '#/modifiers/appearance' },
        { $ref: '#/modifiers/density' },
        { $ref: '#/modifiers/buttonVariant' },
        { $ref: '#/sets/contract' },
      ];
    });
    const graph = await buildTokensGraph(root);
    const rootBlock = graph.css.slice(graph.css.indexOf(':root {'), graph.css.indexOf(':root,\n'));
    expect(rootBlock).toContain('--todae-button-radius: var(--todae-button-base-radius);');
  });

  it('rejects an alias to a token from a later resolution entry', async () => {
    const root = await fixture((resolver) => {
      resolver.resolutionOrder = [
        { $ref: '#/sets/core' },
        { $ref: '#/sets/button' },
        { $ref: '#/sets/contract' },
        { $ref: '#/modifiers/appearance' },
        { $ref: '#/modifiers/density' },
        { $ref: '#/modifiers/buttonVariant' },
      ];
    });
    await expect(buildTokensGraph(root)).rejects.toThrow(
      /token "button\.base\.[a-z.]+" references "space\.[a-z0-9.-]+" from modifier "density", which must come earlier/,
    );
  });

  it('rejects an alias from one scoped modifier to another', async () => {
    const root = await fixture((resolver) => {
      for (const context of Object.keys(resolver.modifiers.density!.contexts)) {
        resolver.modifiers.density!.contexts[context]!.push({
          space: { tint: { $type: 'color', $value: { $ref: '#/color/accent/default/$value' } } },
        });
      }
    });
    await expect(buildTokensGraph(root)).rejects.toThrow(
      /token "space\.tint" in modifier "density" depends on "color\.accent\.default" from modifier "appearance"; scoped modifiers may not alias each other/,
    );
  });

  it('rejects a scoped modifier depending on another through an intermediate set', async () => {
    // Todae's own layer ranks rule this chain out, so build a minimal resolver
    // whose second modifier sits on a higher layer than the set between them.
    const color = (ref: string) => ({ $type: 'color', $value: { $ref: ref } });
    const oklch = { $type: 'color', $value: { colorSpace: 'oklch', components: [0.5, 0.1, 30] } };
    const root = await fixture((resolver) => {
      const ext = (value: Record<string, unknown>) => ({ $extensions: { 'dev.todae': value } });
      resolver.sets = {
        core: { sources: [{ color: { base: oklch } }], ...ext({ layer: 'core' }) },
        tint: { sources: [{ space: { accent: color('#/color/accent/$value') } }], ...ext({ layer: 'density' }) },
      };
      resolver.modifiers = {
        appearance: {
          default: 'light',
          contexts: { light: [{ color: { accent: color('#/color/base/$value') } }] },
          ...ext({ layer: 'appearance', attribute: 'data-appearance' }),
        },
        size: {
          default: 'm',
          contexts: { m: [{ space: { tint: color('#/space/accent/$value') } }] },
          ...ext({ layer: 'contract', attribute: 'data-size' }),
        },
      };
      resolver.resolutionOrder = [
        { $ref: '#/sets/core' },
        { $ref: '#/modifiers/appearance' },
        { $ref: '#/sets/tint' },
        { $ref: '#/modifiers/size' },
      ];
    });
    await expect(buildTokensGraph(root)).rejects.toThrow(
      /token "space\.tint" in modifier "size" depends on "color\.accent" from modifier "appearance"/,
    );
  });

  it('requires every context of a scoped modifier to declare the same tokens', async () => {
    const root = await fixture((resolver) => {
      resolver.modifiers.density!.contexts.compact = [
        { space: { 1: { $type: 'dimension', $value: { value: 1, unit: 'px' } } } },
      ];
    });
    await expect(buildTokensGraph(root)).rejects.toThrow(/modifier "density" comfortable\/compact key trees differ/);
  });

  it('rejects a token declared by two resolution entries', async () => {
    const root = await fixture((resolver) => {
      (resolver.sets.contract!.sources as unknown[]).push({ $ref: './components/button.base.json' });
    });
    await expect(buildTokensGraph(root)).rejects.toThrow(/token "button\.base\.[a-z.]+" is declared by both set "button" and set "contract"/);
  });

  it('rejects malformed resolver entries', async () => {
    const cases: [(resolver: Resolver) => void, RegExp][] = [
      [(r) => r.resolutionOrder.push({ type: 'set', name: 'inline', sources: [] }), /resolutionOrder\[6\] must be/],
      [(r) => r.resolutionOrder.push({ $ref: '#/sets/missing' }), /#\/sets\/missing does not exist/],
      [(r) => r.resolutionOrder.push({ $ref: '#/sets/core' }), /lists #\/sets\/core twice/],
      [(r) => void (r.modifiers.density!.default = 'huge'), /default must name one of its contexts/],
      [(r) => void (r.modifiers.density!.default = 'toString'), /default must name one of its contexts/],
      [(r) => void delete r.sets.core!.$extensions, /set "core" must declare \$extensions\["dev.todae"\]/],
      [(r) => void (r.sets.core!.sources = [{ $ref: '../package.json' }]), /escapes tokens/],
      [(r) => void (r.sets.core!.sources = [{ $ref: '#/sets/contract' }]), /relative token file path/],
      [
        (r) => void ((r.modifiers.density!.$extensions as Record<string, Record<string, unknown>>)['dev.todae']!.attribute = 'data-appearance'),
        /modifier "density" reuses attribute data-appearance/,
      ],
      [
        (r) => void (r.modifiers.appearance!.contexts['high-contrast'] = r.modifiers.appearance!.contexts.dark!),
        /contexts must be light or dark, not "high-contrast"/,
      ],
    ];
    for (const [edit, error] of cases) {
      const root = await fixture(edit);
      await expect(buildTokensGraph(root)).rejects.toThrow(error);
    }
  });

  it('validates the dev.todae extension', () => {
    const ext = (value: unknown) => ({ $extensions: { 'dev.todae': value } });
    expect(parseExtension(ext({ layer: 'core' }), 'set', 'set "x"')).toEqual({ layer: 'core' });
    expect(() => parseExtension(ext({ layer: 'brand' }), 'set', 'set "x"')).toThrow(/layer must be one of/);
    expect(() => parseExtension(ext({ layer: 'toString' }), 'set', 'set "x"')).toThrow(/layer must be one of/);
    expect(() => parseExtension(ext({ layer: 'core', attribute: 'data-x' }), 'set', 'set "x"')).toThrow(
      /only apply to modifiers/,
    );
    expect(() => parseExtension(ext({ layer: 'density' }), 'modifier', 'modifier "x"')).toThrow(/data-\* attribute/);
    expect(() =>
      parseExtension(ext({ layer: 'contract', attribute: 'data-x', alias: true, root: true }), 'modifier', 'modifier "x"'),
    ).toThrow(/alias modifier cannot/);
    expect(
      parseExtension(ext({ layer: 'appearance', attribute: 'data-a', root: true, colorScheme: false }), 'modifier', 'm'),
    ).toEqual({ layer: 'appearance', attribute: 'data-a', root: true });
  });
});

import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  PATH_RE,
  buildCompanyTokens,
  buildTokensGraph,
  cli,
  todaeTokensRoot,
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
  validateReservedRoots,
  validateSlots,
  validateAliasParity,
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
    expect(() => validatePaths(['hue.primary'], 'core')).not.toThrow();
    expect(() => validateReservedRoots(['hue.primary'], 'core')).toThrow(/hue/);
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

  it('requires declared slot groups to have exactly their leaves', () => {
    const chip = { 'chip.bg': ['default', 'hover', 'focus', 'disabled'] };
    const field = { 'field.border': ['default', 'hover', 'focus', 'disabled', 'invalid'] };
    const card = { 'card.*.bg': ['default', 'hover'] };
    expect(() =>
      validateSlots(flattenTokens({ chip: { bg: { default: color('color.bg.subtle') } } }), chip, 'contract'),
    ).toThrow(/"chip\.bg" must have exactly default\|hover\|focus\|disabled/);
    expect(() =>
      validateSlots(
        flattenTokens({
          field: { border: { default: color('color.border.default'), invalid: color('color.danger.default') } },
        }),
        field,
        'contract',
      ),
    ).toThrow(/default\|hover\|focus\|disabled\|invalid/);
    const cards = (leaves: string[]) =>
      flattenTokens({ card: { raised: { bg: Object.fromEntries(leaves.map((leaf) => [leaf, color('color.bg.subtle')])) } } });
    expect(() => validateSlots(cards(['default', 'hover']), card, 'contract')).not.toThrow();
    expect(() => validateSlots(cards(['default']), card, 'contract')).toThrow(/"card\.raised\.bg" must have exactly/);
    expect(() => validateSlots(flattenTokens({ chip: { gap: color('color.bg.subtle') } }), chip, 'contract')).toThrow(
      /slot group "chip\.bg" matches no tokens/,
    );
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

  it('applies Todae rules only to sets that opt in', async () => {
    const brand = { brand: { ink: { $type: 'color', $value: { $ref: '#/color/gray/900/$value' } } } };
    const generic = await fixture((resolver) => {
      resolver.sets.brand = { sources: [brand], $extensions: { 'dev.todae': { layer: 'contract' } } };
      resolver.resolutionOrder.push({ $ref: '#/sets/brand' });
    });
    const graph = await buildTokensGraph(generic);
    expect(graph.tokens.find((t) => t.path === 'brand.ink')?.cssValue).toBe('var(--todae-color-gray-900)');

    const strict = await fixture((resolver) => {
      resolver.sets.brand = {
        sources: [brand],
        $extensions: { 'dev.todae': { layer: 'contract', rules: ['reserved-roots'] } },
      };
      resolver.resolutionOrder.push({ $ref: '#/sets/brand' });
    });
    await expect(buildTokensGraph(strict)).rejects.toThrow(/token "brand\.ink" uses reserved-root-violating category "brand"/);
  });

  it('checks alias contexts against the default even without the button rule', () => {
    const contexts = new Map([
      ['solid', ['badge.solid.bg', 'badge.solid.fg']],
      ['soft', ['badge.soft.bg']],
    ]);
    expect(() => validateAliasParity(contexts, 'solid', 'modifier "badge"')).toThrow(
      /modifier "badge" context "soft" must declare the same tokens as "solid"/,
    );
    contexts.set('soft', ['badge.soft.bg', 'badge.soft.fg']);
    expect(() => validateAliasParity(contexts, 'solid', 'modifier "badge"')).not.toThrow();
  });

  it('rejects a ghost variant missing a token when the button rule is off', async () => {
    const root = await fixture(async (resolver, dir) => {
      const ext = (resolver.modifiers.buttonVariant!.$extensions as Record<string, Record<string, unknown>>)['dev.todae']!;
      ext.rules = ['reserved-roots'];
      const file = join(dir, 'components/button.ghost.json');
      const ghost = JSON.parse(await readFile(file, 'utf8'));
      delete ghost.button.ghost.bg.hover;
      await writeFile(file, JSON.stringify(ghost));
    });
    await expect(buildTokensGraph(root)).rejects.toThrow(/context "ghost" must declare the same tokens as "primary"/);
  });

  it('lets a company opt its own components into slot rules', async () => {
    const root = await fixture((resolver) => {
      resolver.sets.card = {
        sources: [{ card: { bg: { default: { $type: 'color', $value: { $ref: '#/color/bg/surface/$value' } } } } }],
        $extensions: { 'dev.todae': { layer: 'contract', slots: { 'card.bg': ['default', 'hover'] } } },
      };
      resolver.resolutionOrder.push({ $ref: '#/sets/card' });
    });
    await expect(buildTokensGraph(root)).rejects.toThrow(/"card\.bg" must have exactly default\|hover/);
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
      /unknown dev\.todae key "attribute" \(allowed: layer, rules, slots\)/,
    );
    expect(() => parseExtension(ext({ layer: 'core', rule: ['button'] }), 'set', 'set "x"')).toThrow(/unknown dev\.todae key "rule"/);
    expect(() => parseExtension(ext({ layer: 'core', rules: ['slots'] }), 'set', 'set "x"')).toThrow(
      /rule "slots" must be one of reserved-roots\|density-space\|button/,
    );
    expect(() => parseExtension(ext({ layer: 'core', rules: ['button', 'button'] }), 'set', 'set "x"')).toThrow(
      /must not repeat/,
    );
    expect(() => parseExtension(ext({ layer: 'core', slots: { 'Chip.bg': ['default'] } }), 'set', 'set "x"')).toThrow(
      /slot group "Chip\.bg"/,
    );
    expect(() => parseExtension(ext({ layer: 'core', slots: { 'chip.bg': [] } }), 'set', 'set "x"')).toThrow(
      /distinct lowercase leaf names/,
    );
    expect(
      parseExtension(ext({ layer: 'contract', rules: ['button'], slots: { 'card.*.bg': ['default'] } }), 'set', 'set "x"'),
    ).toEqual({ layer: 'contract', rules: ['button'], slots: { 'card.*.bg': ['default'] } });
    expect(() => parseExtension(ext({ layer: 'density' }), 'modifier', 'modifier "x"')).toThrow(/data-\* attribute/);
    expect(() =>
      parseExtension(ext({ layer: 'contract', attribute: 'data-x', alias: true, root: true }), 'modifier', 'modifier "x"'),
    ).toThrow(/alias modifier cannot/);
    expect(
      parseExtension(ext({ layer: 'appearance', attribute: 'data-a', root: true, colorScheme: false }), 'modifier', 'm'),
    ).toEqual({ layer: 'appearance', attribute: 'data-a', root: true });
  });
});

describe('company token build', () => {
  const tokensDir = join(import.meta.dirname, '../tokens');
  const acme = join(import.meta.dirname, '__fixtures__/acme');
  const temps: string[] = [];

  afterEach(async () => {
    await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function company(edit: (resolver: Record<string, any>, root: string) => Promise<void> | void): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), 'todae-acme-'));
    temps.push(root);
    await cp(acme, root, { recursive: true });
    const resolver = JSON.parse(await readFile(join(root, 'resolver.json'), 'utf8'));
    await edit(resolver, root);
    await writeFile(join(root, 'resolver.json'), JSON.stringify(resolver));
    return join(root, 'resolver.json');
  }

  function blockOf(css: string, selector: string): string {
    const start = css.indexOf(`${selector} {`);
    expect(start, selector).toBeGreaterThan(-1);
    return css.slice(start, css.indexOf('\n}', start));
  }

  it('finds Todae tokens from the builder module', () => {
    expect(todaeTokensRoot()).toBe(tokensDir);
  });

  it('emits only the company layer, after Todae\'s', async () => {
    const result = await buildCompanyTokens({ resolver: join(acme, 'resolver.json'), base: tokensDir });
    expect(result.css.startsWith('@layer todae.reset, todae.base, todae.components, todae.theme;\n\n@layer todae.theme {')).toBe(
      true,
    );
    expect(catalogSelectors(result.css.slice(result.css.indexOf('@layer todae.theme {')))).toEqual([
      '@layer todae.theme',
      ':root:not([data-appearance]), [data-appearance="light"]',
      '[data-appearance="dark"]',
      '[data-density="roomy"]',
      '[data-appearance], [data-density]',
      '[data-button-variant="outline"]',
    ]);
    const light = blockOf(result.css, ':root:not([data-appearance]),\n[data-appearance="light"]');
    expect(light).toContain('--todae-color-accent-default: oklch(0.45 0.16 25);');
    expect(light).toContain('--todae-brand-ink: var(--todae-color-gray-900);');
    expect(light).not.toContain('--todae-color-bg-canvas');
    const rescoped = blockOf(result.css, '[data-appearance],\n[data-density]');
    expect(rescoped).toContain('--todae-button-outline-bg-default: var(--todae-color-bg-transparent);');
    expect(rescoped).toContain('--todae-brand-logo-fg: var(--todae-brand-ink);');
    expect(rescoped).not.toContain('--todae-button-primary-');
    expect(blockOf(result.css, '[data-button-variant="outline"]')).toContain(
      '--todae-button-bg-default: var(--todae-button-outline-bg-default);',
    );
    expect(blockOf(result.css, '[data-density="roomy"]')).toContain('--todae-space-overlay-padding: var(--todae-space-8);');
  });

  it('never re-points Todae aliases from the company layer', async () => {
    const resolver = await company((r) => {
      r.sets.button = {
        sources: [{ button: { base: { radius: { $type: 'dimension', $value: { value: 1, unit: 'rem' } } } } }],
        $extensions: { 'dev.todae': { layer: 'contract' } },
      };
      r.modifiers.buttonVariant.contexts.primary = [
        { button: { primary: { bg: { default: { $type: 'color', $value: { $ref: '#/color/red/500/$value' } } } } } },
      ];
      r.resolutionOrder.splice(2, 0, { $ref: '#/sets/button' });
    });
    const { css } = await buildCompanyTokens({ resolver, base: tokensDir });
    const rescoped = blockOf(css, '[data-appearance],\n[data-density]');
    expect(rescoped).toContain('--todae-button-primary-bg-default: var(--todae-color-red-500);');
    expect(rescoped).toContain('--todae-button-base-radius: 1rem;');
    expect(rescoped).not.toMatch(/--todae-button-(bg-default|radius): /);
    expect(css.match(/--todae-button-(bg-default|radius): /g)).toHaveLength(1);
    expect(css).not.toContain('[data-button-variant="primary"]');
    expect(blockOf(css, '[data-button-variant="outline"]')).toContain('--todae-button-bg-default: var(--todae-button-outline-bg-default);');
  });

  it('declares aliases for new tokens in Todae entries', async () => {
    const px = (value: number) => ({ $type: 'dimension', $value: { value, unit: 'px' } });
    const resolver = await company((r) => {
      for (const paint of ['primary', 'secondary', 'ghost', 'outline']) {
        r.modifiers.buttonVariant.contexts[paint] = [
          ...(r.modifiers.buttonVariant.contexts[paint] ?? []),
          { button: { [paint]: { shadow: px(2) } } },
        ];
      }
    });
    const { css } = await buildCompanyTokens({ resolver, base: tokensDir });
    const rescoped = blockOf(css, '[data-appearance],\n[data-density]');
    expect(rescoped).toContain('--todae-button-shadow: var(--todae-button-primary-shadow);');
    expect(rescoped).not.toContain('--todae-button-bg-default:');
    expect(blockOf(css, '[data-button-variant="secondary"]')).toBe(
      '[data-button-variant="secondary"] {\n  --todae-button-shadow: var(--todae-button-secondary-shadow);',
    );
  });

  it('keeps each token one $type, across contexts and over Todae', async () => {
    const mixed = await company((r) => {
      r.modifiers.appearance.contexts.dark = [
        { color: { accent: { default: { $type: 'color', $value: { $ref: '#/color/gray/50/$value' } } } } },
        { brand: { ink: { $type: 'dimension', $value: { value: 1, unit: 'rem' } } } },
      ];
    });
    await expect(buildCompanyTokens({ resolver: mixed, base: tokensDir })).rejects.toThrow(
      /token "brand\.ink" has \$type color and dimension across contexts/,
    );
    const retyped = await company((r) => {
      r.sets.core = {
        sources: [{ radius: { md: { $type: 'number', $value: 3 } } }],
        $extensions: { 'dev.todae': { layer: 'core' } },
      };
      r.resolutionOrder.unshift({ $ref: '#/sets/core' });
    });
    await expect(buildCompanyTokens({ resolver: retyped, base: tokensDir })).rejects.toThrow(
      /set "core" token "radius\.md" overrides a dimension with a number/,
    );
  });

  it('places new entries where the company lists them', async () => {
    const resolver = await company((r) => {
      r.sets.palette = {
        sources: [{ palette: { ember: { $type: 'color', $value: { colorSpace: 'oklch', components: [0.5, 0.17, 30] } } } }],
        $extensions: { 'dev.todae': { layer: 'core' } },
      };
      r.resolutionOrder.unshift({ $ref: '#/sets/palette' });
      r.modifiers.appearance.contexts.light = [
        { color: { accent: { default: { $type: 'color', $value: { $ref: '#/palette/ember/$value' } } } } },
        { brand: { ink: { $type: 'color', $value: { $ref: '#/color/gray/900/$value' } } } },
      ];
    });
    const { css, tokens } = await buildCompanyTokens({ resolver, base: tokensDir });
    expect(blockOf(css, ':root')).toContain('--todae-palette-ember: oklch(0.5 0.17 30);');
    expect(tokens.find((t) => t.path === 'color.accent.default' && t.context === 'light')?.ref).toBe('palette.ember');
  });

  it('declares default aliases for a company-only alias modifier', async () => {
    const resolver = await company((r) => {
      const color = (ref: string) => ({ $type: 'color', $value: { $ref: ref } });
      r.modifiers.badgeTone = {
        default: 'solid',
        contexts: {
          solid: [{ badge: { solid: { bg: color('#/color/accent/default/$value') } } }],
          soft: [{ badge: { soft: { bg: color('#/color/accent/soft/$value') } } }],
        },
        $extensions: { 'dev.todae': { layer: 'contract', attribute: 'data-badge-tone', alias: true } },
      };
      r.resolutionOrder.push({ $ref: '#/modifiers/badgeTone' });
    });
    const { css } = await buildCompanyTokens({ resolver, base: tokensDir });
    expect(blockOf(css, '[data-appearance],\n[data-density]')).toContain('--todae-badge-bg: var(--todae-badge-solid-bg);');
    expect(blockOf(css, '[data-badge-tone="soft"]')).toContain('--todae-badge-bg: var(--todae-badge-soft-bg);');
  });

  it('merges the catalog and types only the company tokens', async () => {
    const result = await buildCompanyTokens({ resolver: join(acme, 'resolver.json'), base: tokensDir });
    const rows = JSON.parse(result.json).tokens as { path: string; context: string | null; cssValue: string }[];
    expect(rows.some((row) => row.path === 'color.gray.50')).toBe(true);
    expect(rows.some((row) => row.path === 'button.outline.bg.default' && row.context === 'outline')).toBe(true);
    expect(rows.filter((row) => row.path === 'color.accent.default').map((row) => row.cssValue)).toEqual([
      'oklch(0.45 0.16 25)',
      'oklch(0.72 0.14 25)',
    ]);
    expect(rows.filter((row) => row.path === 'space.control.x').map((row) => row.context)).toEqual([
      'compact',
      'comfortable',
      'spacious',
      'roomy',
    ]);
    expect(result.overrideTypes).toContain("  'brand.ink': 'color',");
    expect(result.overrideTypes).toContain("  'brand.logo.size': 'dimension',");
    expect(result.overrideTypes).not.toContain("'color.gray.50'");
  });

  it('requires new contexts and additions to keep context parity with Todae', async () => {
    const roomy = await company(async (_resolver, root) => {
      const file = join(root, 'density/roomy.json');
      const tokens = JSON.parse(await readFile(file, 'utf8'));
      delete tokens.space.overlay;
      await writeFile(file, JSON.stringify(tokens));
    });
    await expect(buildCompanyTokens({ resolver: roomy, base: tokensDir })).rejects.toThrow(
      /modifier "density" comfortable\/roomy key trees differ/,
    );
    const brand = await company((resolver) => {
      resolver.modifiers.appearance.contexts.dark = [{ color: {} }];
    });
    await expect(buildCompanyTokens({ resolver: brand, base: tokensDir })).rejects.toThrow(/appearance light\/dark key trees differ/);
    const outline = await company(async (_resolver, root) => {
      const file = join(root, 'button.outline.json');
      const tokens = JSON.parse(await readFile(file, 'utf8'));
      delete tokens.button.outline.ring;
      await writeFile(file, JSON.stringify(tokens));
    });
    await expect(buildCompanyTokens({ resolver: outline, base: tokensDir })).rejects.toThrow(
      /variant "outline" paint keys must match button\.primary/,
    );
  });

  it('rejects extensions that change Todae\'s placement or redeclare its tokens', async () => {
    const cases: [(resolver: Record<string, any>) => void, RegExp][] = [
      [
        (r) => (r.modifiers.density.$extensions['dev.todae'].attribute = 'data-space'),
        /modifier "density" extends Todae's modifier "density", so its attribute must match/,
      ],
      [(r) => (r.modifiers.density.default = 'roomy'), /so its default must stay "comfortable"/],
      [
        (r) => (r.sets.brand.sources = [{ color: { gray: { 50: { $type: 'color', $value: { $ref: '#/brand/ink/$value' } } } } }]),
        /token "color\.gray\.50" is declared by both set "core" and set "brand"/,
      ],
      [
        (r) => {
          r.modifiers.contrast = {
            default: 'more',
            contexts: { more: [{ space: { hairline: { $type: 'dimension', $value: { value: 2, unit: 'px' } } } }] },
            $extensions: { 'dev.todae': { layer: 'density', attribute: 'data-appearance' } },
          };
          r.resolutionOrder.push({ $ref: '#/modifiers/contrast' });
        },
        /modifier "contrast" reuses attribute data-appearance/,
      ],
      [
        (r) => (r.modifiers.buttonVariant.contexts.base = r.modifiers.buttonVariant.contexts.outline),
        /context "base" is reserved/,
      ],
      [
        (r) => {
          delete r.modifiers.density.$extensions['dev.todae'].rules;
          r.modifiers.density.contexts.comfortable = [
            { radius: { huge: { $type: 'dimension', $value: { value: 2, unit: 'rem' } } } },
          ];
        },
        /density token "radius\.huge" must be under space\.\*/,
      ],
      [
        (r) => {
          r.sets.button = {
            sources: [{ button: { base: { lift: { $type: 'dimension', $value: { value: 1, unit: 'px' } } } } }],
            $extensions: { 'dev.todae': { layer: 'contract' } },
          };
          r.resolutionOrder.push({ $ref: '#/sets/button' });
        },
        /button\.base must be radius, padding\.x\/y, font\.size\/weight, gap/,
      ],
      [
        (r) => {
          r.sets.contract = {
            sources: [{ chip: { bg: { pressed: { $type: 'color', $value: { $ref: '#/color/bg/subtle/$value' } } } } }],
            $extensions: { 'dev.todae': { layer: 'contract' } },
          };
          r.resolutionOrder.push({ $ref: '#/sets/contract' });
        },
        /"chip\.bg" must have exactly default\|hover\|focus\|disabled/,
      ],
    ];
    for (const [edit, error] of cases) {
      const resolver = await company(edit);
      await expect(buildCompanyTokens({ resolver, base: tokensDir })).rejects.toThrow(error);
    }
  });

  it('can be imported when argv[1] is not a file', () => {
    const out = execFileSync(
      process.execPath,
      [
        '--experimental-strip-types',
        '--no-warnings',
        '--input-type=module',
        '-e',
        `await import(${JSON.stringify(join(import.meta.dirname, 'build-tokens.ts'))}); process.stdout.write('ok');`,
        'not-a-file',
      ],
      { encoding: 'utf8' },
    );
    expect(out).toBe('ok');
  });

  it('writes, checks and reports drift from the CLI', async () => {
    const out = await mkdtemp(join(tmpdir(), 'todae-cli-'));
    temps.push(out);
    const args = (...extra: string[]) => [
      'build',
      '--resolver',
      join(acme, 'resolver.json'),
      '--base',
      tokensDir,
      '--css',
      join(out, 'acme.css'),
      '--catalog',
      join(out, 'acme.json'),
      '--types',
      join(out, 'acme.types.ts'),
      ...extra,
    ];
    await expect(cli(args('--check'))).rejects.toThrow(/acme\.css is missing/);
    await cli(args());
    await expect(cli(args('--check'))).resolves.toBeUndefined();
    expect(await readFile(join(out, 'acme.types.ts'), 'utf8')).toContain("'brand.ink': 'color'");
    await writeFile(join(out, 'acme.css'), '');
    await expect(cli(args('--check'))).rejects.toThrow(/acme\.css drifted/);
    await expect(cli(['build'])).rejects.toThrow(/Usage: todae-tokens build/);
    await expect(cli(['buld', '--resolver', join(acme, 'resolver.json')])).rejects.toThrow(/Usage: todae-tokens build/);
    await expect(cli([])).rejects.toThrow(/Usage: todae-tokens build/);
  });
});
